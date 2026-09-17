/** Reproduce six weekly screenshot checks; public reads only, no production writes. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { providerJson } from "../lib/provider-http.ts";
import { aggregateWeekly, validateCandles } from "../lib/market-data.ts";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

const root = "research/kk-2026-09-17";
const cutoff = Date.UTC(2026, 8, 14);
const references = [
  { asset: "btc", file: "btc4.png", target: 60739.59, state: "bull", source: "Binance USDT proxy for TradingView CRYPTO USD", previous: [10,3] },
  { asset: "bnb", file: "bnb4.png", target: 605.67, state: "bull", source: "Binance USDT proxy for Binance USD", previous: null },
  { asset: "zec", file: "zcash.png", target: 863.79, state: "bull", source: "Binance USDT", previous: null },
  { asset: "dot", file: "dot4.png", target: 1.1893, state: "bear", source: "Kraken USD", previous: [15,2] },
  { asset: "link", file: "link4.png", target: 9.346, state: "bull", source: "Coinbase USD", previous: [15,2] },
  { asset: "hype", file: "hype4.png", target: 64.551, state: "bull", source: "KuCoin USDT, Monday weeks", previous: [15,2] },
];
const fixtureFile = `${root}/fixtures.json`;
let fixtures: {asset:string; source:string; retrievedAt:string; candles:Candle[]}[];
if (fs.existsSync(fixtureFile) && !process.argv.includes("--refresh-link")) fixtures=JSON.parse(fs.readFileSync(fixtureFile,"utf8"));
else {
  fixtures=fs.existsSync(fixtureFile)?JSON.parse(fs.readFileSync(fixtureFile,"utf8")):[];
  for (const ref of references) {
    if(fixtures.some(f=>f.asset===ref.asset) && ref.asset!=="link")continue;
    let candles:Candle[];
    if (["btc","bnb","zec"].includes(ref.asset)) {
      const {body}=await providerJson(`https://data-api.binance.vision/api/v3/klines?symbol=${ref.asset.toUpperCase()}USDT&interval=1w&limit=1000&endTime=${cutoff-1}`);
      candles=(body as number[][]).map(r=>({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],complete:true}));
    } else if(ref.asset==="hype") {
      const {body}=await providerJson(`https://api.kucoin.com/api/v1/market/candles?symbol=HYPE-USDT&type=1day&startAt=1730419200&endAt=${cutoff/1000-1}`);
      const daily=(body as {data:number[][]}).data.map(r=>({time:+r[0]*1000,open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5],complete:true})).sort((a,b)=>a.time-b.time);
      candles=aggregateWeekly(daily);
    } else if(ref.asset==="dot") {
      const {body}=await providerJson("https://api.kraken.com/0/public/OHLC?pair=DOTUSD&interval=1440");
      const result=(body as {result:Record<string,unknown>}).result;
      const rows=Object.entries(result).find(([key])=>key!=="last")![1] as number[][];
      candles=aggregateWeekly(rows.map(r=>({time:+r[0]*1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[6],complete:true})).filter(r=>r.time<cutoff));
    } else {
      const db=new DatabaseSync("data/bitcoin-regime.sqlite",{readOnly:true});
      const saved=db.prepare("SELECT time,open,high,low,close,volume FROM market_candles WHERE asset='link' AND source='coinbase' AND timeframe='1d' ORDER BY time").all() as unknown as Candle[];
      db.close();
      const baseline=saved.map(r=>({...r,complete:true}));
      if(!baseline.length)throw new Error("Coinbase LINK baseline unavailable");
      const start=baseline.at(-1)!.time;
      const {body}=await providerJson(`https://api.exchange.coinbase.com/products/LINK-USD/candles?granularity=86400&start=${new Date(start).toISOString()}&end=${new Date(cutoff).toISOString()}`);
      const tail=(body as number[][]).map(r=>({time:+r[0]*1000,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true})).filter(r=>r.time<cutoff);
      const merged=new Map<number,Candle>(baseline.map((r:Candle)=>[r.time,r]));for(const r of tail)merged.set(r.time,r);
      candles=aggregateWeekly([...merged.values()].filter(r=>r.time<cutoff).sort((a,b)=>a.time-b.time));
    }
    candles=candles.filter(r=>r.time<cutoff);
    const quality=validateCandles(candles,604800000);
    if(quality.gaps||quality.duplicates||quality.malformed||candles.some(r=>new Date(r.time).getUTCDay()!==1))throw new Error(`Invalid ${ref.asset} history`);
    fixtures=fixtures.filter(f=>f.asset!==ref.asset);
    fixtures.push({asset:ref.asset,source:ref.source,retrievedAt:new Date().toISOString(),candles});
  }
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(fixtureFile,JSON.stringify(fixtures)+"\n");
}
const results=references.map(ref=>{
  const fixture=fixtures.find(f=>f.asset===ref.asset)!;
  const candidates=[[10,3],[10,2],[15,2],[15,3]].map(([atrLength,factor])=>{
    const result=calculateIndicators(fixture.candles,"1w",{indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
    return {atrLength,factor,value:result.values.supertrend,state:result.state,errorPct:100*(result.values.supertrend!/ref.target-1),lastFlip:result.lastFlip===null?null:new Date(result.lastFlip).toISOString().slice(0,10)};
  });
  return {...ref,imageSha256:createHash("sha256").update(fs.readFileSync(`/home/kos/Downloads/${ref.file}`)).digest("hex"),candles:fixture.candles.length,through:new Date(fixture.candles.at(-1)!.time).toISOString().slice(0,10),candidates};
});
fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results,null,2));
