/** Fixed weekly screenshot checks; paced public reads, no production writes. */
import fs from "node:fs";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {providerJson} from "../lib/provider-http.ts";
import {aggregateWeekly,validateCandles} from "../lib/market-data.ts";
import {aggregateStockWeeks} from "../lib/stocks.ts";
import {normalizeYahooHistory} from "../lib/yahoo.ts";
import {calculateIndicators,type Candle} from "../lib/regimes.ts";

const root="research/kk-2026-09-21",cutoff=Date.UTC(2026,8,21),DAY=86400000;
const refs=[
 {asset:"btc",file:"btc6.png",target:60739.59,state:"bull",source:"Binance USDT proxy for TradingView CRYPTO USD",previous:[10,3]},
 {asset:"eth",file:"eth6.png",target:2074.75,state:"bull",source:"Bitfinex USD",previous:[10,2]},
 {asset:"sol",file:"sol6.png",target:80.72,state:"bull",source:"Coinbase USD",previous:[10,2]},
 {asset:"bnb",file:"bnb6.png",target:612.40,state:"bull",source:"Binance USDT proxy for screenshot Binance USD",previous:[15,2]},
 {asset:"zec",file:"zec6.png",target:954.01,state:"bull",source:"Binance USDT",previous:[15,2]},
 {asset:"avax",file:"avax6.png",target:6.339,state:"bull",source:"Coinbase USD",previous:null},
 {asset:"sui",file:"sui6.png",target:1.0413,state:"bear",source:"Coinbase USD",previous:[15,2]},
 {asset:"ada",file:"ada6.png",target:.254943,state:"bear",source:"Kraken USD",previous:[15,2]},
 {asset:"mstr",file:"mstr6.png",target:90.66,state:"bull",source:"Yahoo split-adjusted NASDAQ",previous:null},
];
fs.mkdirSync(root,{recursive:true});
const fixtures:{asset:string;source:string;retrievedAt:string;candles:Candle[]}[]=[];
for(const ref of refs){
 const file=`${root}/${ref.asset}.json`;
 if(fs.existsSync(file)){fixtures.push(JSON.parse(fs.readFileSync(file,"utf8")));continue;}
 let candles:Candle[];
 if(["btc","bnb","zec"].includes(ref.asset)){
  const {body}=await providerJson(`https://data-api.binance.vision/api/v3/klines?symbol=${ref.asset.toUpperCase()}USDT&interval=1w&limit=1000&endTime=${cutoff-1}`);
  candles=(body as number[][]).map(r=>({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],complete:true}));
 }else if(ref.asset==="eth"){
  const {body}=await providerJson(`https://api-pub.bitfinex.com/v2/candles/trade:1D:tETHUSD/hist?start=${Date.UTC(2017,0,1)}&end=${cutoff-1}&limit=10000&sort=1`);
  const daily=(body as number[][]).map(r=>({time:+r[0],open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5],complete:true}));
  candles=aggregateWeekly(daily);
 }else if(ref.asset==="ada"){
  const {body}=await providerJson("https://api.kraken.com/0/public/OHLC?pair=ADAUSD&interval=1440");
  const result=(body as {result:Record<string,unknown>}).result;
  const rows=Object.entries(result).find(([key])=>key!=="last")![1] as number[][];
  candles=aggregateWeekly(rows.map(r=>({time:+r[0]*1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[6],complete:true})).filter(r=>r.time<cutoff));
 }else if(ref.asset==="mstr"){
  const {body}=await providerJson(`https://query1.finance.yahoo.com/v8/finance/chart/MSTR?period1=${Date.UTC(2015,0,1)/1000}&period2=${cutoff/1000}&interval=1d&events=splits`,{"User-Agent":"Regime-Lab/1.0"});
  const history=normalizeYahooHistory(body,cutoff);
  if(Object.values(history.quality).some(Boolean))throw new Error("MSTR history quality failure");
  candles=aggregateStockWeeks(history.candles,cutoff);
 }else{
  const db=new DatabaseSync("data/bitcoin-regime.sqlite",{readOnly:true});
  const saved=db.prepare("SELECT time,open,high,low,close,volume FROM market_candles WHERE asset=? AND source='coinbase' AND timeframe='1d' ORDER BY time").all(ref.asset) as unknown as Candle[];db.close();
  const merged=new Map<number,Candle>(saved.map(r=>[r.time,{...r,complete:true}]));
  let start=saved.at(-1)?.time??Date.UTC(2021,8,30);
  while(start<cutoff){
   const end=Math.min(start+299*DAY,cutoff);
   const {body}=await providerJson(`https://api.exchange.coinbase.com/products/${ref.asset.toUpperCase()}-USD/candles?granularity=86400&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`);
   for(const r of body as number[][]){const time=+r[0]*1000;if(time<cutoff)merged.set(time,{time,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true});}
   start=end;
  }
  candles=aggregateWeekly([...merged.values()].filter(c=>c.time<cutoff).sort((a,b)=>a.time-b.time));
 }
 candles=candles.filter(c=>c.time<cutoff);
 const q=validateCandles(candles,7*DAY);
 if(q.gaps||q.duplicates||q.malformed||candles.some(c=>new Date(c.time).getUTCDay()!==1))throw new Error(`${ref.asset}: invalid weekly candles`);
 const fixture={asset:ref.asset,source:ref.source,retrievedAt:new Date().toISOString(),candles};
 fs.writeFileSync(file,JSON.stringify(fixture)+"\n");fixtures.push(fixture);
}
const results=refs.map(ref=>{
 const candles=fixtures.find(f=>f.asset===ref.asset)!.candles;
 const candidates=[[10,3],[10,2],[15,2],[15,3]].map(([atrLength,factor])=>{
  const s=calculateIndicators(candles,"1w",{indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
  return {atrLength,factor,value:s.values.supertrend,state:s.state,errorPct:100*(s.values.supertrend!/ref.target-1),lastFlip:s.lastFlip==null?null:new Date(s.lastFlip).toISOString().slice(0,10)};
 });
 return {...ref,imageSha256:createHash("sha256").update(fs.readFileSync(`/home/kos/Downloads/${ref.file}`)).digest("hex"),candles:candles.length,through:new Date(candles.at(-1)!.time).toISOString().slice(0,10),candidates};
});
fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results,null,2));
