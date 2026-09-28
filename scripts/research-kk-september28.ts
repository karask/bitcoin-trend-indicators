/** Replay fixed September 28 video references using completed provider candles. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { normalizeYahooHistory } from "../lib/yahoo.ts";
import { aggregateStockWeeks, STOCKS } from "../lib/stocks.ts";
import { aggregateWeekly, validateCandles } from "../lib/market-data.ts";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

const root = "research/kk-2026-09-28", rawRoot = "data/kk-research-2026-09-28-video/providers";
const provenance = JSON.parse(fs.readFileSync(`${rawRoot}/provenance.json`, "utf8")) as Record<string, { retrievedAt: string }>;
const cutoff = Date.UTC(2026, 8, 28), day = 86_400_000;
type ImageReference = { symbol: string; timeframe: string; image: string; imageSha256: string; timestamp: string; videoUrl: string };
type Observation = [string, number, "bull" | "bear", string | null, ("bull" | "bear")?, number?];
const inventory: { weeklyCharts: ImageReference[]; otherTimeframes: ImageReference[] } = JSON.parse(fs.readFileSync("research/youtube-2026-09-28-L_CvF4pDmOY/manifest.json", "utf8"));
const weekly: Observation[] = [
 ["crcl",62.45,"bull","2026-09-08"], ["vvv",23.258,"bull","2026-09-14"], ["bot",7.86,"bull","2026-09-21"],
 ["sndk",1808.89,"bear","2026-07-20"], ["intc",119.42,"bear","2026-07-20","bull",1], ["mu",1097.54,"bear","2026-07-20"],
 ["mrvl",249.77,"bear","2026-07-06","bull",1], ["amd",438.38,"bull","2026-04-13"], ["nvda",192.15,"bull","2026-09-08"],
 ["amzn",242.65,"bull","2026-08-03"], ["meta",670.63,"bear","2026-08-24","bull",1], ["googl",380.37,"bear",null],
 ["tsla",383.88,"bear","2026-07-27"], ["pltr",141.97,"bull","2026-08-10"], ["spcx",158.13,"bear","2026-09-21"], ["qnt",160.41,"bull","2026-09-28"],
];
const daily: Observation[] = [["strc",94.11,"bull","2026-07-07"],["crcl",57.74,"bull","2026-09-11"],["bot",18.62,"bull","2026-06-10"],["spcx",115.88,"bull","2026-09-11"],["qnt",227.68,"bull","2026-09-10","bear",1]];
const refs = [...weekly.map(r => ({row:r,timeframe:"1w" as const})),...daily.map(r=>({row:r,timeframe:"1d" as const}))].map(({row,timeframe})=>{
 const asset=String(row[0]);const image=[...inventory.weeklyCharts,...inventory.otherTimeframes].find(r=>r.symbol.toLowerCase()===asset && r.timeframe.toLowerCase()===timeframe)!;
 return {asset,timeframe,target:Number(row[1]),targetState:String(row[2]),imageLastFlipDate:row[3],pendingDirection:row[4]??null,pendingCount:row[5]??0,image:image.image,imageSha256:image.imageSha256,videoTimestamp:image.timestamp,videoUrl:image.videoUrl};
});
const assets=[...new Set(refs.map(r=>r.asset))],fixtures=new Map<string,{daily:Candle[];weekly:Candle[];quality:unknown;source:string}>();
for(const asset of assets){
 const crypto=["vvv","qnt"].includes(asset);let candles:Candle[],quality:unknown,splitSignature:string|null=null;const source=crypto?"coinbase":"yahoo";
 const rawFile=`${rawRoot}/${asset}-${source}-raw.json`,body=JSON.parse(fs.readFileSync(rawFile,"utf8"));
 if(crypto){
  const rows:Candle[]=body.rows.map((r: number[])=>({time:r[0]*1000,open:r[3],high:r[2],low:r[1],close:r[4],volume:r[5],complete:true}));
  const checked=validateCandles(rows,day);candles=checked.candles;quality={gaps:checked.gaps,duplicates:checked.duplicates,malformed:checked.malformed};
 }else{
  const normal=normalizeYahooHistory(body,cutoff,STOCKS.find(s=>s.id===asset)?.historyStart);candles=normal.candles;quality=normal.quality;splitSignature=normal.splitSignature;
 }
 if(Object.values(quality as Record<string,number>).some(Boolean))throw new Error(`${asset} quality: ${JSON.stringify(quality)}`);
 const weeks=crypto?aggregateWeekly(candles):aggregateStockWeeks(candles,cutoff);
 const record={asset,source,retrievedAt:crypto?body.retrievedAt:provenance[asset].retrievedAt,splitSignature,cutoff:new Date(cutoff).toISOString(),rawFile,rawSha256:createHash("sha256").update(fs.readFileSync(rawFile)).digest("hex"),quality,daily:candles,weekly:weeks};
 fs.writeFileSync(`${root}/${asset}.json`,JSON.stringify(record)+"\n");fixtures.set(asset,record);
}
const results=refs.map(ref=>{
 const fixture=fixtures.get(ref.asset)!,candles=ref.timeframe==="1w"?fixture.weekly:fixture.daily;
 const family=ref.timeframe==="1w"?[[10,3],[10,2],[15,2],[15,3]]:ref.asset==="qnt"?[[10,3],[15,2],[15,3],[15,4],[15,5],[50,4]]:[[10,3],[15,3],[15,4],[30,2],[30,4],[50,6]];
 function score(cs:Candle[],atrLength:number,factor:number){
  const signal=calculateIndicators(cs,ref.timeframe,{indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:atrLength,kkSupertrendFactor:factor})[0];
  const value=signal.values.supertrend;return {atrLength,factor,value,state:signal.state,errorPct:value==null?null:100*(value/ref.target-1),lastFlip:signal.lastFlip==null?null:new Date(signal.lastFlip).toISOString().slice(0,10),confirmation:signal.confirmation??null,ready:signal.readiness?.ready??true};
 }
 const candidates=family.map(([a,f])=>({...score(candles,a,f),preceding:score(candles.slice(0,-1),a,f)}));
 return {...ref,source:fixture.source,bars:candles.length,through:new Date(candles.at(-1)!.time).toISOString().slice(0,10),candidates};
});
fs.writeFileSync(`${root}/observations.json`,JSON.stringify(refs,null,2)+"\n");
fs.writeFileSync(`${root}/candidates.json`,JSON.stringify(results,null,2)+"\n");
for(const r of results)console.log(r.asset,r.timeframe,r.target,r.targetState,r.bars,r.candidates.map(c=>`${c.atrLength}/${c.factor}: ${c.value?.toFixed(5)} ${c.state} ${c.errorPct?.toFixed(3)}% (${c.lastFlip}) prev=${c.preceding.value?.toFixed(5)} ${c.preceding.state}`).join(" | "));
