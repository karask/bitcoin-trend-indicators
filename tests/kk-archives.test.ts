import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {KK_ARCHIVE_EVIDENCE} from "../lib/kk-archive-evidence.ts";
import {calculateIndicators,type Candle,type IndicatorCalculationOptions} from "../lib/regimes.ts";
import {aggregateWeekly} from "../lib/market-data.ts";
import {aggregateStockWeeks} from "../lib/stocks.ts";
import {aggregateCommodityWeeks} from "../lib/commodities.ts";
import {buildResearch} from "../lib/research.ts";
import {calibrationStatus} from "../lib/kk-calibration.ts";
const cutoff=Date.UTC(2026,8,21);
function candles(row:typeof KK_ARCHIVE_EVIDENCE[number]){
 const metal=row.asset==="gold"||row.asset==="silver";
 const daily:Candle[]=JSON.parse(readFileSync(new URL(`../research/kk-2026-09-21-archives/${row.asset}-${row.source}${metal?"-futures":""}.json`,import.meta.url),"utf8")).candles;
 return row.timeframe==="1d"?daily:metal?aggregateCommodityWeeks(daily,cutoff):row.source==="yahoo"?aggregateStockWeeks(daily,cutoff):aggregateWeekly(daily);
}
test("fifty archive records distinguish weekly checks, unreadable targets and unresolved daily behavior",()=>{
 assert.equal(KK_ARCHIVE_EVIDENCE.length,50);
 assert.equal(KK_ARCHIVE_EVIDENCE.filter(r=>r.status==="weekly-retained").length,23);
 assert.equal(KK_ARCHIVE_EVIDENCE.filter(r=>r.status==="skipped").length,2);
 assert.equal(KK_ARCHIVE_EVIDENCE.filter(r=>r.status==="daily-unresolved").length,25);
 assert.equal(KK_ARCHIVE_EVIDENCE.filter(r=>r.pending!=null).length,5);
 for(const row of KK_ARCHIVE_EVIDENCE){
  assert.match(row.imageSha256,/^[a-f0-9]{64}$/);
  const cs=candles(row);
  assert.ok(cs.every(c=>c.complete&&c.time<cutoff));
  if(row.status==="skipped"){assert.equal(row.value,null);assert.equal(row.errorPct,null);continue;}
  const options={kkSupertrendLegacySingleClose:true,indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:row.atrLength,kkSupertrendFactor:row.factor};
  const signal=calculateIndicators(cs,row.timeframe,options)[0];
  assert.equal(signal.values.supertrend,row.value,row.asset);
  assert.equal(signal.state,row.state);
  if(row.timeframe==="1w"){
   assert.equal(signal.state,row.targetState);
   assert.ok(Math.abs(signal.values.supertrend!/row.target!-1)<.04);
  }
  const prefix=calculateIndicators(cs.slice(0,-1),row.timeframe,options)[0];
  assert.deepEqual(prefix.states,signal.states.slice(0,-1));
 }
 assert.match(calibrationStatus("sui","1d"),/unresolved/);
 assert.match(calibrationStatus(undefined,"1d","tsla"),/Approximate daily/);
 assert.match(calibrationStatus(undefined,"1d",undefined,"gold"),/Approximate daily/);
});
test("archive research preserves ordinary indicator calculations and next-open execution across asset classes",()=>{
 for(const asset of ["btc","sol","tsla","gold"] as const){
  const row=KK_ARCHIVE_EVIDENCE.find(r=>r.asset===asset&&r.timeframe==="1d")!,cs=candles(row);
  const options:IndicatorCalculationOptions=asset==="tsla"?{market:"equity",stock:asset}:asset==="gold"?{market:"commodity",commodity:asset}:{asset};
  const signals=calculateIndicators(cs,"1d",options);
  const alternative=calculateIndicators(cs,"1d",{...options,kkSupertrendAtrLength:15,kkSupertrendFactor:2});
  assert.deepEqual(signals.filter(r=>r.id!=="kk_supertrend"),alternative.filter(r=>r.id!=="kk_supertrend"));
  const r=buildResearch(cs,signals,"kk_supertrend","1d",options);
  assert.ok(r.detail&&r.benchmark);
  assert.equal(r.periodsPerYear,asset==="tsla"||asset==="gold"?252:365);
  assert.ok(r.rolling.length>0);
  const returns=r.sensitivity.map(s=>s.result!.totalReturn);
  assert.ok(returns[0]>=returns[1]&&returns[1]>=returns[2]);
  for(const e of r.detail.executions){const i=cs.findIndex(c=>c.time===e.time);assert.equal(e.price,cs[i].open);assert.equal(e.signalTime,cs[i-1].time);}
 }
});
