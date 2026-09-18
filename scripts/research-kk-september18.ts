/** Offline-replayable screenshot analysis. Does not change app presets or stores. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { providerJson } from "../lib/provider-http.ts";
import { aggregateWeekly, validateCandles } from "../lib/market-data.ts";
import { aggregateStockWeeks } from "../lib/stocks.ts";
import { normalizeYahooHistory } from "../lib/yahoo.ts";
import { aggregateCommodityWeeks } from "../lib/commodities.ts";
import { fetchCommodityHistory } from "../lib/yahoo-commodities.ts";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

const root="research/kk-2026-09-18", cutoff=Date.UTC(2026,8,14), asOf=Date.UTC(2026,8,18,9), DAY=86400000;
const refs=[
  {asset:"btc",target:60600.44,state:"bull",file:"btc5.png",source:"Binance USDT",current:[10,3]},
  {asset:"sol",target:79.59,state:"bull",file:"sol5.png",source:"Coinbase USD",current:[10,2]},
  {asset:"ltc",target:56.246,state:"bear",file:"ltc5.png",source:"Coinbase USD",current:null},
  {asset:"near",target:1.7031,state:"bull",file:"near5.png",source:"Coinbase USD",current:null},
  {asset:"mstr",target:90.66,state:"bull",file:"mstr5.png",source:"Yahoo split-adjusted NASDAQ",current:null},
  {asset:"meta",target:670.63,state:"bear",file:"meta5.png",source:"Yahoo split-adjusted NASDAQ; screenshot has pending Bullish 1/1",current:null},
  {asset:"gold",target:4076.188,state:"bull",file:"gold5.png",source:"Yahoo GC=F futures proxy; screenshot is OANDA spot XAUUSD",current:[10,2]},
];
fs.mkdirSync(root,{recursive:true});
const fixtures:{asset:string;source:string;retrievedAt:string;candles:Candle[]}[]=[];
for(const ref of refs){
  const path=`${root}/${ref.asset}.json`;
  if(fs.existsSync(path)){fixtures.push(JSON.parse(fs.readFileSync(path,"utf8")));continue;}
  let candles:Candle[];
  if(ref.asset==="btc")candles=JSON.parse(fs.readFileSync("research/kk-2026-09-17/fixtures.json","utf8")).find((r:{asset:string})=>r.asset==="btc").candles;
  else if(["sol","ltc","near"].includes(ref.asset)){
    const merged=new Map<number,Candle>();let start=Date.UTC(2022,0,3);
    if(ref.asset==="sol"){
      const db=new DatabaseSync("data/bitcoin-regime.sqlite",{readOnly:true});
      const saved=db.prepare("SELECT time,open,high,low,close,volume FROM market_candles WHERE asset='sol' AND source='coinbase' AND timeframe='1d' ORDER BY time").all() as unknown as Candle[];db.close();
      for(const row of saved)merged.set(row.time,{...row,complete:true});
      if(saved.length)start=saved.at(-1)!.time;
    }
    while(start<cutoff){
      const end=Math.min(start+299*DAY,cutoff);
      const {body}=await providerJson(`https://api.exchange.coinbase.com/products/${ref.asset.toUpperCase()}-USD/candles?granularity=86400&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`);
      for(const r of body as number[][]){const time=+r[0]*1000;if(time<cutoff)merged.set(time,{time,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true});}
      start=end;
    }
    candles=aggregateWeekly([...merged.values()].filter(r=>r.time<cutoff).sort((a,b)=>a.time-b.time));
  }else if(ref.asset==="gold"){
    const history=await fetchCommodityHistory("GC=F",fetch,cutoff,"2019-01-02");candles=aggregateCommodityWeeks(history.candles,cutoff);
  }else{
    const {body}=await providerJson(`https://query1.finance.yahoo.com/v8/finance/chart/${ref.asset.toUpperCase()}?period1=${Date.UTC(2015,0,1)/1000}&period2=${cutoff/1000}&interval=1d&events=splits`,{"User-Agent":"Regime-Lab/1.0"});
    const history=normalizeYahooHistory(body,asOf);
    if(Object.values(history.quality).some(Boolean))throw new Error(`${ref.asset} quality: ${JSON.stringify(history.quality)}`);
    candles=aggregateStockWeeks(history.candles,cutoff);
  }
  candles=candles.filter(c=>c.time<cutoff);
  const quality=validateCandles(candles,7*DAY);if(quality.gaps||quality.duplicates||quality.malformed)throw new Error(`${ref.asset} weekly quality: ${JSON.stringify({...quality,candles:undefined})}`);
  const fixture={asset:ref.asset,source:ref.source,retrievedAt:new Date().toISOString(),candles};
  fs.writeFileSync(path,JSON.stringify(fixture)+"\n");fixtures.push(fixture);
}
const results=refs.map(ref=>{
  const candles=fixtures.find(f=>f.asset===ref.asset)!.candles;
  const candidates=[[10,3],[10,2],[15,2],[15,3]].map(([atrLength,factor])=>{
    const s=calculateIndicators(candles,"1w",{indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
    return {atrLength,factor,value:s.values.supertrend,state:s.state,errorPct:100*(s.values.supertrend!/ref.target-1),lastFlip:s.lastFlip==null?null:new Date(s.lastFlip).toISOString().slice(0,10)};
  });return {...ref,imageSha256:createHash("sha256").update(fs.readFileSync(`/home/kos/Downloads/${ref.file}`)).digest("hex"),candles:candles.length,through:new Date(candles.at(-1)!.time).toISOString().slice(0,10),candidates};
});
fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results,null,2));
