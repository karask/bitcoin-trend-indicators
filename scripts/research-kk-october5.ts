/** Dated screenshot research. --fetch retrieves missing cached provider tails sequentially. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { ASSETS, marketDefinition, type AssetId, type SourceId } from "../lib/markets.ts";
import { STOCKS, type StockId } from "../lib/stocks.ts";
import { COMMODITIES, type CommodityId } from "../lib/commodities.ts";
import { fetchYahooStockHistory } from "../lib/yahoo.ts";
import { fetchCommodityHistory } from "../lib/yahoo-commodities.ts";
import { providerJson } from "../lib/provider-http.ts";
import { validateCandles } from "../lib/market-data.ts";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_SUPERTREND_COMMODITY_PRESETS, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";

export const root = "research/kk-2026-10-05";
const rawRoot = "data/kk-research-2026-10-05", imageRoot = "/tmp/kk-oct5-I5k8qo/TradingView-2026-10-05";
const DAY = 86400000, latestCutoff = Date.UTC(2026,9,6), captureCutoff = Date.UTC(2026,9,5);
const read = (p: string) => JSON.parse(fs.readFileSync(p,"utf8"));
const date = (t: number | null | undefined) => t == null ? null : new Date(t).toISOString().slice(0,10);
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const fetchRequested = process.argv.includes("--fetch");
export type Observation = {asset:string;assetClass:"crypto"|"stock"|"commodity";image:string;imageSha256:string;target:number;targetState:"bull"|"bear";targetLastFlip:string;targetLastFlipPrice:number;pendingDirection:"bull"|null;pendingCount:number|null;partialCandle:Ohlc|null;previous:{atrLength:number;factor:number};note:string};
type Ohlc = {open:number;high:number;low:number;close:number};
const targets: [string,number,string,number][] = [
  ["btc",80859.48,"2026-06-18",64442.85],["eth",2369.63,"2026-07-19",1861.19],["sol",101.15,"2026-07-04",82.27],["doge",.079837,"2026-08-26",.085669],
  ["link",12.435,"2026-08-20",10.546],["xmr",455.70,"2026-08-20",422.08],["sui",1.0447,"2026-09-23",1.0235],["jup",.2872,"2026-07-04",.2430],
  ["op",.11580,"2026-09-23",.13520],["bonk",.0000024636,"2026-09-26",.0000037477],["ada",.20217,"2026-08-07",.20099],["atom",1.4589,"2026-08-15",1.5101],
  ["hype",75.900,"2026-08-24",82.271],["dot",.9550,"2026-09-10",1.1225],["bnb",704.06,"2026-08-25",704.21],["zec",1251.54,"2026-08-26",767.79],
  ["avax",9.777,"2026-09-10",7.799],["ray",1.6165,"2026-08-26",.7849],["vvv",22.464,"2026-08-26",17.343],["qnt",227.68,"2026-09-10",67.17],
  ["tsla",311.71,"2026-09-08",357.10],["googl",370.44,"2026-06-08",365.18],["nvda",225.58,"2026-06-12",204.86],["spcx",115.88,"2026-09-11",150.01],
  ["mu",845.10,"2026-09-25",1095.83],["sndk",1249.03,"2026-08-20",1569.00],["bmnr",21.51,"2026-08-26",24.24],["mstr",125.30,"2026-08-28",134.00],
  ["crcl",57.74,"2026-09-11",92.00],["intc",99.80,"2026-09-24",120.61],["mrvl",206.14,"2026-08-26",240.00],["amd",540.92,"2026-09-25",634.53],
  ["amzn",233.26,"2026-08-07",272.87],["meta",713.35,"2026-09-21",680.30],["bot",18.62,"2026-06-10",38.91],["strc",95.31,"2026-07-07",89.00],
  ["pltr",160.21,"2026-08-11",174.18],["gold",4658.1,"2026-10-04",4169.4],["silver",71.285,"2026-02-05",70.360],
];
const partials: Record<string,number[]> = {
  btc:[86516.61,86978.45,85404.99,86233.02],eth:[2726.66,2737.26,2694.42,2720.15],sol:[121.58,122.04,120.02,121.09],doge:[.095899,.097080,.094771,.096950],
  link:[14.275,14.277,14.040,14.129],xmr:[546.72,548.66,535.13,543.12],sui:[1.2082,1.2507,1.2037,1.2256],jup:[.3351,.3407,.3264,.3367],
  op:[.13420,.13664,.13025,.13540],bonk:[.39182e-5,.40625e-5,.3903e-5,.4041e-5],ada:[.25967,.27462,.25784,.27287],atom:[1.7504,1.7761,1.7301,1.7739],
  hype:[90.548,93.721,90.013,93.294],dot:[1.2051,1.2393,1.1913,1.2250],bnb:[795.29,809.70,788.40,789.88],zec:[1352.25,1356.18,1311.17,1335.75],
  avax:[11.103,11.103,10.829,11.024],ray:[2.1110,2.1157,2.0524,2.0636],vvv:[30.018,30.233,29.218,29.863],qnt:[252.48,258.28,245.32,252.87],
  gold:[4169.4,4198.9,4152.3,4167.7],silver:[60.700,62.400,60.645,61.580],
};
fs.mkdirSync(root,{recursive:true}); fs.mkdirSync(rawRoot,{recursive:true});
if (!fs.existsSync(`${root}/observations.json`)) {
  const charts: Observation[] = targets.map(([asset,target,targetLastFlip,targetLastFlipPrice],i)=>{
    const assetClass = i<20?"crypto":i<37?"stock":"commodity";
    const file=fs.readdirSync(imageRoot).find(name=>name.startsWith(String(i+1).padStart(2,"0")+"-"))!;
    const [open,high,low,close] = partials[asset] ?? [];
    const previous = assetClass==="crypto" ? KK_SUPERTREND_PRESETS[asset as AssetId]["1d"] : assetClass==="stock" ? KK_SUPERTREND_STOCK_PRESETS[asset as StockId]["1d"] : KK_SUPERTREND_COMMODITY_PRESETS[asset as CommodityId]["1d"];
    return {asset,assetClass,image:file,imageSha256:sha(fs.readFileSync(`${imageRoot}/${file}`)),target,targetState:["googl","nvda","gold","silver"].includes(asset)?"bear":"bull",targetLastFlip,targetLastFlipPrice,pendingDirection:asset==="nvda"?"bull":null,pendingCount:asset==="nvda"?5:null,partialCandle:partials[asset]?{open,high,low,close}:null,previous,note:asset==="nvda"?"Table reads BEARISH and Bullish 5/5 simultaneously. Score the printed bearish state; do not infer an official bullish flip or alter the five-close rule.":assetClass==="commodity"?"TradingView COMEX continuous futures show B-ADJ and settlement basis; Yahoo's continuous history may differ. Gold's printed last flip falls on Sunday October 4, unlike Yahoo's session-date bars.":""};
  });
  fs.writeFileSync(`${root}/observations.json`,JSON.stringify({archive:"TradingView-MoneyLine-39-charts-2026-10-05.zip",captureDate:"2026-10-05",reviewedAt:"2026-10-06",timeframe:"1d",captureClockUTC:"08:38–08:50 crypto/stocks; 14:15–14:16 futures",comparison:"Crypto completed through October 4; stocks and Yahoo futures through October 2. October 5 candles are partial at capture. Latest completed October 5 values are separate diagnostics.",charts},null,2)+"\n");
}
export const observations: {charts:Observation[]} = read(`${root}/observations.json`);
export function optionsFor(o:Observation):IndicatorCalculationOptions {return o.assetClass==="crypto"?{asset:o.asset as AssetId}:o.assetClass==="stock"?{market:"equity",stock:o.asset as StockId}:{market:"commodity",commodity:o.asset as CommodityId};}
const fixturePath=(asset:string,source:string)=>`${root}/${asset}-${source}.json`;
type Fixture = {asset:string;source:string;quality:Record<string,number>;retrievedAt:string;provenance:unknown;candles:Candle[]};
async function cryptoHistory(asset:AssetId,source:SourceId):Promise<Fixture> {
  const file=fixturePath(asset,source);if(fs.existsSync(file))return read(file);
  if(!fetchRequested)throw new Error(`Missing ${file}; pass --fetch`);
  const old:Fixture=read(`research/kk-2026-10-03/crypto/${asset}-${source}.json`);
  const d=asset==="jup"&&source==="binance"?{providerSymbol:"JUPUSDT"}:marketDefinition(asset,source);
  const start=old.candles.at(-1)!.time;
  const p=new URLSearchParams({granularity:"86400",start:new Date(start).toISOString(),end:new Date(latestCutoff).toISOString()});
  const url=source==="coinbase"?`https://api.exchange.coinbase.com/products/${d.providerSymbol}/candles?${p}`:source==="bitstamp"?`https://www.bitstamp.net/api/v2/ohlc/${d.providerSymbol}/?step=86400&limit=1000&start=${start/1000}&end=${latestCutoff/1000-1}`:source==="binance"?`https://data-api.binance.vision/api/v3/klines?symbol=${d.providerSymbol}&interval=1d&limit=1000&startTime=${start}&endTime=${latestCutoff-1}`:`https://api.kraken.com/0/public/OHLC?pair=${d.providerSymbol}&interval=1440&since=${start/1000}`;
  const {body,raw}=await providerJson(url,{"User-Agent":"Regime-Lab/1.0"});
  fs.writeFileSync(`${rawRoot}/${asset}-${source}.json`,raw+"\n");
  let rows:Candle[];
  if(source==="coinbase")rows=(body as number[][]).map(r=>({time:+r[0]*1000,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5],complete:true}));
  else if(source==="binance")rows=(body as number[][]).map(r=>({time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5],complete:true}));
  else if(source==="bitstamp")rows=(body as {data:{ohlc:Record<string,string>[]}}).data.ohlc.map(r=>({time:+r.timestamp*1000,open:+r.open,high:+r.high,low:+r.low,close:+r.close,volume:+r.volume,complete:true}));
  else {const b=body as {error:string[];result:Record<string,number[][]>};if(b.error?.length)throw new Error(b.error.join(","));rows=Object.entries(b.result).find(([key])=>key!=="last")![1].map(r=>({time:+r[0]*1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[6],complete:true}));}
  const merged=new Map(old.candles.map(c=>[c.time,c]));for(const c of rows)if(c.time<latestCutoff)merged.set(c.time,c);
  const validated=validateCandles([...merged.values()],DAY),quality={gaps:validated.gaps,duplicates:validated.duplicates,malformed:validated.malformed};
  if(Object.values(quality).some(Boolean)||validated.candles.at(-1)?.time!==latestCutoff-DAY)throw new Error(`${asset}: incomplete/invalid tail`);
  const result={asset,source,retrievedAt:new Date().toISOString(),quality,provenance:{baseline:`research/kk-2026-10-03/crypto/${asset}-${source}.json`,url,rawSha256:sha(raw+"\n")},candles:validated.candles};fs.writeFileSync(file,JSON.stringify(result)+"\n");return result;
}
async function yahooHistory(o:Observation):Promise<Fixture> {
  const file=fixturePath(o.asset,"yahoo");if(fs.existsSync(file))return read(file);
  if(!fetchRequested)throw new Error(`Missing ${file}; pass --fetch`);
  let raw="";const fetcher:typeof fetch=async(url,init)=>{const r=await fetch(url,init);raw=await r.clone().text();return r;};
  let candles:Candle[],quality:Record<string,number>,provenance:unknown;
  if(o.assetClass==="stock"){
    const stock=STOCKS.find(s=>s.id===o.asset)!;
    const old:{candles:Candle[]}=read(`research/kk-2026-10-03/stocks/${o.asset}-yahoo.json`);
    const tail=await fetchYahooStockHistory(stock.symbol,fetcher,latestCutoff,"2026-10-02");
    const overlap=tail.candles.find(c=>c.time===old.candles.at(-1)!.time)!;
    if(!overlap||["open","high","low","close"].some(k=>Math.abs(overlap[k as keyof Ohlc]/old.candles.at(-1)![k as keyof Ohlc]-1)>1e-8))throw new Error(`${o.asset}: Yahoo adjustment changed; full history reload required`);
    const merged=new Map(old.candles.map(c=>[c.time,c]));for(const c of tail.candles)merged.set(c.time,c);candles=[...merged.values()].sort((a,b)=>a.time-b.time);quality={...tail.quality};provenance={baseline:`research/kk-2026-10-03/stocks/${o.asset}-yahoo.json`,adjustment:tail.adjustment,requestedStart:tail.requestedStart};
  }else{const commodity=COMMODITIES.find(c=>c.id===o.asset)!;const result=await fetchCommodityHistory(commodity.symbol,fetcher,latestCutoff);candles=result.candles;quality=result.quality;provenance={adjustment:result.adjustment,contractLabel:result.contractLabel};}
  fs.writeFileSync(`${rawRoot}/${o.asset}-yahoo.json`,raw+"\n");const result={asset:o.asset,source:"yahoo",retrievedAt:new Date().toISOString(),quality,provenance:{details:provenance,rawSha256:sha(raw+"\n")},candles};fs.writeFileSync(file,JSON.stringify(result)+"\n");return result;
}
export function score(o:Observation,candles:Candle[],atrLength:number,factor:number){
  const s=calculateIndicators(candles,"1d",{...optionsFor(o),indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
  const flipIndex=s.lastFlip==null?-1:candles.findIndex(c=>c.time===s.lastFlip),executionDate=flipIndex>=0?date(candles[flipIndex+1]?.time):null;
  return {atrLength,factor,value:s.values.supertrend!,state:s.state,errorPct:100*(s.values.supertrend!/o.target-1),lastFlip:date(s.lastFlip),executionDate,flipDateErrorDays:s.lastFlip==null?null:(s.lastFlip-Date.parse(o.targetLastFlip))/DAY,confirmation:s.confirmation??null};
}
export type CandidateRow = ReturnType<typeof score>;
const results=[];
for(const o of observations.charts){
  const sources:SourceId[] = o.assetClass==="crypto"?(o.asset==="jup"?[ASSETS.find(a=>a.id===o.asset)!.defaultSource,"binance"]:[ASSETS.find(a=>a.id===o.asset)!.defaultSource]):[];
  for(const source of o.assetClass==="crypto"?sources:["yahoo"]){
    const f=o.assetClass==="crypto"?await cryptoHistory(o.asset as AssetId,source as SourceId):await yahooHistory(o);
    const candles=f.candles.filter(c=>c.complete&&c.time<captureCutoff);
    const family=o.assetClass==="crypto"?[[10,3],[15,2],[15,3],[15,4],[15,5],...(o.asset==="qnt"?[[50,4]]:[])]:o.assetClass==="stock"?[[10,3],[15,3],[15,4],[30,2],[30,4],[50,6]]:[[15,3],[15,4]];
    const candidates=family.map(([a,m])=>{
      const scoreCompleted=score(o,candles,a,m);
      const partial=o.partialCandle?calculateIndicators([...candles,{time:captureCutoff,...o.partialCandle,volume:0,complete:true}],"1d",{...optionsFor(o),indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:a,kkSupertrendFactor:m,kkSupertrendLegacySingleClose:true})[0].values.supertrend:null;
      return {...scoreCompleted,asCapturedRawTrail:partial,asCapturedRawErrorPct:partial==null?null:100*(partial/o.target-1),latest:score(o,f.candles,a,m)};
    });
    const current=candidates.find(c=>c.atrLength===o.previous.atrLength&&c.factor===o.previous.factor)!;
    const row={asset:o.asset,source,through:date(candles.at(-1)?.time),latestThrough:date(f.candles.at(-1)?.time),quality:f.quality,fixture:fixturePath(o.asset,source),fixtureSha256:sha(fs.readFileSync(fixturePath(o.asset,source))),target:o.target,targetState:o.targetState,targetLastFlip:o.targetLastFlip,current,candidates};
    results.push(row);fs.writeFileSync(`${root}/candidates.json`,JSON.stringify(results,null,2)+"\n");
    console.log(`${o.asset}/${source}: ${candidates.map(c=>`${c.atrLength}/${c.factor} ${c.state} ${c.errorPct.toFixed(2)}% ${c.lastFlip}`).join(" | ")}`);
    await new Promise(resolve=>setTimeout(resolve,500));
  }
}
