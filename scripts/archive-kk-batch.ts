/** Generate reproducible research fixtures, never live market data or presets. */
import fs from "node:fs";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, type Candle, type Timeframe } from "../lib/regimes.ts";
import { isStockId } from "../lib/stocks.ts";
import type { AssetId } from "../lib/markets.ts";
const root="research/kk-2026-09-08";
const charts=JSON.parse(fs.readFileSync(`${root}/charts.json`,"utf8")) as Array<{asset:string;source:string;chartSource:string;fileTime:string;filenameSuffix?:string;timeframe:Timeframe;target:number;state:string;ignored?:boolean;note?:string}>;
const fixtures=[];
const evidence=[];
for(const c of charts) {
  const stored=JSON.parse(fs.readFileSync(`data/kk-research-2026-09-08/${c.asset}-${c.source}${c.source==="kucoin"?"-monday":""}-${c.timeframe}.json`,"utf8"));
  const candles:Candle[]=stored.candles;
  const stock=isStockId(c.asset)?c.asset:undefined;
  const options={market:stock?"equity" as const:"crypto" as const,stock,asset:stock?undefined:c.asset as AssetId,indicatorIds:["kk_supertrend"]};
  const preset=stock?KK_SUPERTREND_STOCK_PRESETS[stock][c.timeframe]:KK_SUPERTREND_PRESETS[c.asset as AssetId][c.timeframe];
  const previous=["eth","sol"].includes(c.asset)?{atrLength:10,factor:2}:["doge","link","xmr","sui"].includes(c.asset)?{atrLength:15,factor:2}:{atrLength:10,factor:3};
  const current=calculateIndicators(candles,c.timeframe,options)[0];
  const before=calculateIndicators(candles,c.timeframe,{...options,kkSupertrendAtrLength:previous.atrLength,kkSupertrendFactor:previous.factor})[0];
  // Tolerance follows displayed decimal precision, plus a small data/ATR-start allowance.
  const decimals=c.asset==="googl"?2:(String(c.target).split(".")[1]??"").length;
  const tolerance=c.asset==="doge"?.001:c.asset==="bonk"?5.1e-9:c.asset==="sndk"?.02:c.asset==="hype"?.001:Math.max(.51*10**-decimals,c.target*0.000001);
  const row={asset:c.asset,market:stock?"equity":"crypto",timeframe:c.timeframe,filename:`Image 8-9-26 at ${c.fileTime}\u202fPM${c.filenameSuffix??""}.jpeg`,venue:c.chartSource,target:c.target,targetState:c.state,tolerance,previous,preset,value:current.values.supertrend!,state:current.state,previousValue:before.values.supertrend!,previousState:before.state,lastFlip:current.lastFlip,through:candles.at(-1)!.time,candles:candles.length,atrRatio:current.values.atr!/candles.at(-1)!.close,ignored:Boolean(c.ignored),note:c.note??null};
  evidence.push(row);
  fixtures.push({asset:c.asset,source:c.source,timeframe:c.timeframe,retrievedAt:stored.retrievedAt,rows:candles.map(r=>[r.time,r.open,r.high,r.low,r.close,r.volume])});
}
fs.writeFileSync(`${root}/fixtures.json`,JSON.stringify(fixtures)+"\n");
console.log(JSON.stringify(evidence));
