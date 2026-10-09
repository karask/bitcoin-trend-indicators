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
const daily=(asset:string,source:string):Candle[]=>JSON.parse(readFileSync(new URL(`../research/kk-2026-09-21-archives/${asset}-${source}${asset==="gold"||asset==="silver"?"-futures":""}.json`,import.meta.url),"utf8")).candles;
function weekly(row:typeof KK_ARCHIVE_EVIDENCE[number]){
 const cs=daily(row.asset,row.source);
 return row.asset==="gold"||row.asset==="silver"?aggregateCommodityWeeks(cs,cutoff):row.source==="yahoo"?aggregateStockWeeks(cs,cutoff):aggregateWeekly(cs);
}
test("twenty-five weekly archive records distinguish weekly checks from unreadable targets; daily records are retired",()=>{
 assert.equal(KK_ARCHIVE_EVIDENCE.length,25);
 assert.equal(KK_ARCHIVE_EVIDENCE.filter(r=>r.status==="weekly-retained").length,23);
 assert.equal(KK_ARCHIVE_EVIDENCE.filter(r=>r.status==="skipped").length,2);
 const retired=JSON.parse(readFileSync(new URL("../research/kk-2026-09-21-archives/retired-daily-evidence.json",import.meta.url),"utf8"));
 assert.equal(retired.archiveDaily.length,25);
 assert.equal(retired.dailyFamilySeptember22.length,23);
 for(const row of KK_ARCHIVE_EVIDENCE){
  assert.equal(row.timeframe,"1w");
  assert.match(row.imageSha256,/^[a-f0-9]{64}$/);
  const cs=weekly(row);
  assert.ok(cs.every(c=>c.complete&&c.time<cutoff));
  if(row.status==="skipped"){assert.equal(row.value,null);assert.equal(row.errorPct,null);continue;}
  const options={indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:row.atrLength,kkSupertrendFactor:row.factor};
  const signal=calculateIndicators(cs,"1w",options)[0];
  assert.equal(signal.values.supertrend,row.value,row.asset);
  assert.equal(signal.state,row.state);
  assert.equal(signal.state,row.targetState);
  assert.ok(Math.abs(signal.values.supertrend!/row.target!-1)<.04);
  const prefix=calculateIndicators(cs.slice(0,-1),"1w",options)[0];
  assert.deepEqual(prefix.states,signal.states.slice(0,-1));
 }
 assert.match(calibrationStatus("sui","1d"),/October 5/);
 assert.match(calibrationStatus(undefined,"1d","tsla"),/October [56]/);
 assert.match(calibrationStatus(undefined,"1d",undefined,"gold"),/calibration unresolved/);
});
test("archive research preserves ordinary indicator calculations and next-open execution across asset classes",()=>{
 for(const asset of ["btc","sol","tsla","gold"] as const){
  const row=KK_ARCHIVE_EVIDENCE.find(r=>r.asset===asset)!,cs=daily(asset,row.source);
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
