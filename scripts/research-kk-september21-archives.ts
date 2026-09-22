/** Reproducible archive research. Public, paced reads; no production writes. */
import fs from "node:fs";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {providerJson} from "../lib/provider-http.ts";
import {aggregateWeekly,validateCandles} from "../lib/market-data.ts";
import {aggregateStockWeeks} from "../lib/stocks.ts";
import {aggregateCommodityWeeks} from "../lib/commodities.ts";
import {normalizeYahooHistory} from "../lib/yahoo.ts";
import {normalizeCommodityHistory} from "../lib/yahoo-commodities.ts";
import {calculateIndicators,KK_SUPERTREND_PRESETS,KK_SUPERTREND_STOCK_PRESETS,KK_SUPERTREND_COMMODITY_PRESETS,type Candle,type Timeframe} from "../lib/regimes.ts";

export const root="research/kk-2026-09-21-archives";
const cutoff=Date.UTC(2026,8,21),DAY=86400000;
type Ref={asset:string;source:string;time:string;target:number|null;state:string;pending?:number};
const weekly:Ref[]=[
 {asset:"btc",source:"bitstamp",time:"9.24",target:null,state:"bull"},
 {asset:"eth",source:"coinbase",time:"9.27",target:2053.01,state:"bull"},
 {asset:"sol",source:"coinbase",time:"9.30",target:80.72,state:"bull"},
 {asset:"doge",source:"binance",time:"9.32",target:.0979,state:"bear"},
 {asset:"link",source:"coinbase",time:"9.34",target:9.346,state:"bull"},
 {asset:"xmr",source:"bitfinex",time:"9.36",target:416.3,state:"bull"},
 {asset:"sui",source:"coinbase",time:"9.38",target:1.0413,state:"bear"},
 {asset:"jup",source:"kraken",time:"9.39",target:.15338,state:"bull"},
 {asset:"op",source:"bitstamp",time:"9.41",target:.150700,state:"bear"},
 {asset:"bonk",source:"bitstamp",time:"9.43",target:.00000513,state:"bear"},
 {asset:"ada",source:"kraken",time:"9.45",target:.254943,state:"bear"},
 {asset:"atom",source:"kraken",time:"9.46",target:1.8602,state:"bear"},
 {asset:"hype",source:"coinbase",time:"9.48",target:65.03,state:"bull"},
 {asset:"dot",source:"coinbase",time:"9.51",target:1.1872,state:"bear"},
 {asset:"bnb",source:"binance",time:"9.52",target:612.4,state:"bull"},
 {asset:"zec",source:"coinbase",time:"9.53",target:945.98,state:"bull"},
 {asset:"tsla",source:"yahoo",time:"9.56",target:383.88,state:"bear"},
 {asset:"googl",source:"yahoo",time:"9.57",target:380.37,state:"bear"},
 {asset:"nvda",source:"yahoo",time:"9.59",target:192.15,state:"bull"},
 {asset:"spcx",source:"yahoo",time:"10.00",target:null,state:"unavailable"},
 {asset:"mu",source:"yahoo",time:"10.02",target:1097.54,state:"bear"},
 {asset:"sndk",source:"yahoo",time:"10.04",target:1808.89,state:"bear"},
 {asset:"bmnr",source:"yahoo",time:"10.06",target:17.57,state:"bull"},
 {asset:"gold",source:"yahoo",time:"10.08",target:4123.7,state:"bull"},
 {asset:"silver",source:"yahoo",time:"10.09",target:75.728,state:"bear"},
];
const daily:Ref[]=[
 {asset:"btc",source:"bitstamp",time:"9.48",target:76922,state:"bull"},
 {asset:"eth",source:"bitstamp",time:"9.50",target:2275.9,state:"bull"},
 {asset:"sol",source:"coinbase",time:"9.53",target:101.04,state:"bull"},
 {asset:"doge",source:"coinbase",time:"9.56",target:.06573,state:"bull"},
 {asset:"link",source:"coinbase",time:"9.57",target:10.751,state:"bull"},
 {asset:"xmr",source:"kraken",time:"9.59",target:450.51,state:"bull"},
 {asset:"sui",source:"coinbase",time:"10.01",target:.7885,state:"bear",pending:4},
 {asset:"jup",source:"bitstamp",time:"10.06",target:.235130,state:"bull"},
 {asset:"op",source:"bitstamp",time:"10.08",target:.104231,state:"bear",pending:4},
 {asset:"bonk",source:"coinbase",time:"10.12",target:.00000322,state:"bear",pending:1},
 {asset:"ada",source:"coinbase",time:"10.14",target:.16664,state:"bull"},
 {asset:"atom",source:"kraken",time:"10.15",target:1.4559,state:"bull"},
 {asset:"hype",source:"coinbase",time:"10.17",target:71.48,state:"bull"},
 {asset:"dot",source:"coinbase",time:"10.19",target:.7976,state:"bull"},
 {asset:"bnb",source:"binance",time:"10.21",target:677.44,state:"bull"},
 {asset:"zec",source:"coinbase",time:"10.23",target:1206.85,state:"bull"},
 {asset:"tsla",source:"yahoo",time:"10.25",target:290.35,state:"bull"},
 {asset:"googl",source:"yahoo",time:"10.27",target:370.44,state:"bear"},
 {asset:"nvda",source:"yahoo",time:"10.28",target:225.58,state:"bear",pending:1},
 {asset:"spcx",source:"yahoo",time:"10.30",target:115.88,state:"bull"},
 {asset:"mu",source:"yahoo",time:"10.31",target:987.92,state:"bear",pending:2},
 {asset:"sndk",source:"yahoo",time:"10.33",target:1205.8,state:"bull"},
 {asset:"bmnr",source:"yahoo",time:"10.34",target:21.51,state:"bull"},
 {asset:"gold",source:"yahoo",time:"10.35",target:4316.7,state:"bull"},
 {asset:"silver",source:"yahoo",time:"10.37",target:71.286,state:"bear"},
];
const refs=[...weekly.map(r=>({...r,timeframe:"1w" as Timeframe})),...daily.map(r=>({...r,timeframe:"1d" as Timeframe}))];
fs.mkdirSync(root,{recursive:true});
const db=new DatabaseSync("data/bitcoin-regime.sqlite",{readOnly:true});
async function history(ref:Ref):Promise<Candle[]>{
 const isMetal=["gold","silver"].includes(ref.asset);
 const file=`${root}/${ref.asset}-${ref.source}${isMetal?"-futures":""}.json`;
 if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,"utf8")).candles;
 let candles:Candle[]=[];
 if(ref.source==="yahoo"){
  const symbol=ref.asset==="gold"?"GC=F":ref.asset==="silver"?"SI=F":ref.asset.toUpperCase();
  const {body}=await providerJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Date.UTC(isMetal?2019:2015,0,isMetal?2:1)/1000}&period2=${cutoff/1000}&interval=1d&events=splits`,{"User-Agent":"Regime-Lab/1.0"});
  candles=isMetal?normalizeCommodityHistory((body as {chart:{result:Parameters<typeof normalizeCommodityHistory>[0][]}}).chart.result[0],ref.asset==="gold"?"GC=F":"SI=F","2019-01-02",cutoff).candles:normalizeYahooHistory(body,cutoff).candles;
 }else if(ref.source==="binance"){
  const {body}=await providerJson(`https://data-api.binance.vision/api/v3/klines?symbol=${ref.asset.toUpperCase()}USDT&interval=1d&limit=1000&endTime=${cutoff-1}`);
  candles=(body as number[][]).map(r=>({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],complete:true}));
 }else if(ref.source==="bitfinex"){
  const {body}=await providerJson(`https://api-pub.bitfinex.com/v2/candles/trade:1D:tXMRUSD/hist?start=${Date.UTC(2017,0,1)}&end=${cutoff-1}&limit=10000&sort=1`);
  candles=(body as number[][]).map(r=>({time:+r[0],open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5],complete:true}));
 }else if(ref.source==="kraken"){
  const {body}=await providerJson(`https://api.kraken.com/0/public/OHLC?pair=${ref.asset.toUpperCase()}USD&interval=1440`);
  const result=(body as {result:Record<string,unknown>}).result;
  const rows=Object.entries(result).find(([key])=>key!=="last")![1] as number[][];
  candles=rows.map(r=>({time:+r[0]*1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[6],complete:true}));
 }else{
  const saved=db.prepare("SELECT time,open,high,low,close,volume FROM market_candles WHERE asset=? AND source=? AND timeframe='1d' ORDER BY time").all(ref.asset,ref.source) as unknown as Candle[];
  const merged=new Map<number,Candle>(saved.map(r=>[r.time,{...r,complete:true}]));
  let start=saved.at(-1)?.time??(ref.asset==="hype"?Date.UTC(2026,0,1):Date.UTC(2020,0,1));
  while(start<cutoff){
   const end=Math.min(start+(ref.source==="coinbase"?299:999)*DAY,cutoff);
   if(ref.source==="coinbase"){
    const {body}=await providerJson(`https://api.exchange.coinbase.com/products/${ref.asset.toUpperCase()}-USD/candles?granularity=86400&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`);
    for(const r of body as number[][]){const time=+r[0]*1000;merged.set(time,{time,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true});}
   }else{
    const {body}=await providerJson(`https://www.bitstamp.net/api/v2/ohlc/${ref.asset}usd/?step=86400&limit=1000&start=${start/1000}&end=${end/1000-1}`);
    for(const r of (body as {data:{ohlc:Record<string,string>[]}}).data.ohlc){const time=+r.timestamp*1000;merged.set(time,{time,open:+r.open,high:+r.high,low:+r.low,close:+r.close,volume:+r.volume,complete:true});}
   }
   start=end;
  }
  candles=[...merged.values()];
 }
 candles=candles.filter(r=>r.time<cutoff).sort((a,b)=>a.time-b.time);
 const quality=validateCandles(candles,DAY);
 if(quality.malformed||quality.duplicates||!candles.length)throw new Error(`${ref.asset} malformed history`);
 const qualitySummary={gaps:quality.gaps,duplicates:quality.duplicates,malformed:quality.malformed};
 fs.writeFileSync(file,JSON.stringify({asset:ref.asset,source:ref.source,retrievedAt:new Date().toISOString(),quality:qualitySummary,candles})+"\n");
 return candles;
}
const results=[];
for(const ref of refs){
 const daily=await history(ref);
 const candles=ref.timeframe==="1d"?daily:ref.source==="yahoo"?["gold","silver"].includes(ref.asset)?aggregateCommodityWeeks(daily,cutoff):aggregateStockWeeks(daily,cutoff):aggregateWeekly(daily);
 const presetMap={...KK_SUPERTREND_PRESETS,...KK_SUPERTREND_STOCK_PRESETS,...KK_SUPERTREND_COMMODITY_PRESETS} as Record<string,Record<Timeframe,{atrLength:number;factor:number}>>;
 const previous=presetMap[ref.asset][ref.timeframe];
 const candidates=[];
 for(const [atrLength,factor] of [[10,3],[10,2],[15,2],[15,3]]){
  const s=calculateIndicators(candles,ref.timeframe,{kkSupertrendLegacySingleClose: true, indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
  candidates.push({atrLength,factor,value:s.values.supertrend??null,state:s.state,errorPct:ref.target&&s.values.supertrend!=null?100*(s.values.supertrend/ref.target-1):null,lastFlip:s.lastFlip==null?null:new Date(s.lastFlip).toISOString().slice(0,10)});
 }
 const folder=ref.timeframe==="1w"?"2026-09-21 Weekly ":"2026-09-21 Daily";
 const filename=`Image 21-9-26 at ${ref.time}\u202f${ref.timeframe==="1w"?"AM":"PM"}.jpeg`;
 const archiveRoot=process.env.KK_ARCHIVE_DIR??"/tmp/kk-archives-XbzrrW";
 const imageSha256=createHash("sha256").update(fs.readFileSync(`${archiveRoot}/${folder}/${filename}`)).digest("hex");
 const result={...ref,filename,imageSha256,previous,candles:candles.length,through:candles.at(-1)?new Date(candles.at(-1)!.time).toISOString().slice(0,10):null,candidates};
 results.push(result);console.log(JSON.stringify(result));
 fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2)+"\n");
}
db.close();
