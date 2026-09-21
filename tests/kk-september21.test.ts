import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {calculateIndicators,type Candle} from "../lib/regimes.ts";
import {KK_SEPTEMBER21_EVIDENCE} from "../lib/kk-september21-evidence.ts";
import {buildResearch} from "../lib/research.ts";
import {calibrationStatus} from "../lib/kk-calibration.ts";
import {marketDefinition} from "../lib/markets.ts";
import {stockDefinition} from "../lib/stocks.ts";

const fixture=(asset:string):Candle[]=>JSON.parse(readFileSync(new URL(`../research/kk-2026-09-21/${asset}.json`,import.meta.url),"utf8")).candles;
test("nine weekly screenshots preserve the established family and explicit MSTR timing difference",()=>{
 for(const row of KK_SEPTEMBER21_EVIDENCE){
  const candles=fixture(row.asset),options=row.asset==="mstr"?{market:"equity" as const,stock:"mstr" as const}:{asset:row.asset};
  const kk=calculateIndicators(candles,"1w",{...options,indicatorIds:["kk_supertrend"]})[0];
  assert.equal(candles.at(-1)!.time,Date.UTC(2026,8,14));
  assert.equal(kk.values.supertrend,row.value);
  assert.equal(kk.state,row.targetState);
  assert.ok(Math.abs(kk.values.supertrend!/row.target-1)<(row.asset==="mstr"?.034:.005));
  const prefix=calculateIndicators(candles.slice(0,-1),"1w",{...options,indicatorIds:["kk_supertrend"]})[0];
  assert.deepEqual(prefix.states,kk.states.slice(0,-1));
  if(row.asset==="mstr")assert.ok(Math.abs(prefix.values.supertrend!-90.66)<.005,"Screenshot matches the preceding completed week; do not force the current level");
  if(row.asset==="avax")assert.equal(kk.lastFlip,Date.UTC(2026,8,14));
 }
});
test("AVAX and MSTR have separated providers, weekly calibration and normal research execution",()=>{
 assert.equal(marketDefinition("avax","coinbase").providerSymbol,"AVAX-USD");
 assert.equal(stockDefinition("MSTR").exchange,"NASDAQ");
 assert.match(calibrationStatus(undefined,"1w","mstr"),/September 21/);
 assert.match(calibrationStatus(undefined,"1d","mstr"),/Uncalibrated/);
 for(const asset of ["avax","mstr"] as const){
  const candles=fixture(asset),options=asset==="mstr"?{market:"equity" as const,stock:asset}:{asset};
  const signals=calculateIndicators(candles,"1w",options);
  const baseline=calculateIndicators(candles,"1w",{...options,kkSupertrendAtrLength:10,kkSupertrendFactor:3});
  assert.deepEqual(signals.filter(s=>s.id!=="kk_supertrend"),baseline.filter(s=>s.id!=="kk_supertrend"));
  const daily=calculateIndicators(candles,"1d",{...options,indicatorIds:["kk_supertrend"]})[0];
  assert.deepEqual([daily.values.atrLength,daily.values.factor],[10,3]);
  const r=buildResearch(candles,signals,"kk_supertrend","1w",asset==="mstr"?{market:"equity"}:{});
  assert.ok(r.detail&&r.benchmark);
  // The common research window starts after the longest indicator warmup.
  if(asset==="mstr")assert.ok(r.rolling.length);
  else assert.equal(r.rolling.length,0,"AVAX has no full four-year common window after warmup");
  assert.equal(r.periodsPerYear,52);
  const returns=r.sensitivity.map(s=>s.result!.totalReturn);
  assert.ok(returns[0]>=returns[1]&&returns[1]>=returns[2]);
  for(const e of r.detail.executions){const i=candles.findIndex(c=>c.time===e.time);assert.equal(e.price,candles[i].open);assert.equal(e.signalTime,candles[i-1].time);}
 }
});
