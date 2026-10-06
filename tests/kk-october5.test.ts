import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_OCTOBER5_EVIDENCE } from "../lib/kk-october5-evidence.ts";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_SUPERTREND_COMMODITY_PRESETS, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import { calibrationStatus, KK_CALIBRATION_VERSION } from "../lib/kk-calibration.ts";
import { kkCalibrationWarning } from "../lib/kk-reliability.ts";

const cutoff=Date.UTC(2026,9,5);
test("October 5 chart tables distinguish dates, readable LINK and NVDA's contradictory counter",()=>{
  assert.equal(KK_CALIBRATION_VERSION,"2026-10-06");
  assert.equal(KK_OCTOBER5_EVIDENCE.length,39);
  assert.equal(new Set(KK_OCTOBER5_EVIDENCE.map(r=>r.asset)).size,39);
  assert.deepEqual(["crypto","stock","commodity"].map(c=>KK_OCTOBER5_EVIDENCE.filter(r=>r.assetClass===c).length),[20,17,2]);
  for(const row of KK_OCTOBER5_EVIDENCE){
    assert.equal(row.reviewedAt,"2026-10-06"); assert.equal(row.captureDate,"2026-10-05");
    assert.equal(row.latestThrough,"2026-10-05");assert.equal(row.through,row.assetClass==="crypto"?"2026-10-04":"2026-10-02");
    assert.deepEqual(row.preset,row.previous,"All compact presets retained");
    assert.ok(row.target>0); assert.match(row.targetLastFlip,/^2026-\d\d-\d\d$/);
  }
  const link=KK_OCTOBER5_EVIDENCE.find(r=>r.asset==="link")!;
  assert.equal(link.target,12.435);assert.equal(link.targetLastFlip,"2026-08-20");assert.equal(link.status,"unresolved");
  assert.equal(KK_OCTOBER5_EVIDENCE.find(r=>r.asset==="bonk")!.target,.0000024636);
  const nvda=KK_OCTOBER5_EVIDENCE.find(r=>r.asset==="nvda")!;
  assert.equal(nvda.targetState,"bear");assert.equal(nvda.screenshotPendingCount,5);assert.equal(nvda.screenshotPendingDirection,"bull");assert.equal(nvda.status,"unresolved");
  assert.equal(KK_OCTOBER5_EVIDENCE.find(r=>r.asset==="gold")!.targetLastFlip,"2026-10-04");
  assert.equal(KK_OCTOBER5_EVIDENCE.find(r=>r.asset==="silver")!.targetLastFlip,"2026-02-05");
  assert.equal(KK_OCTOBER5_EVIDENCE.filter(r=>r.targetLastFlip===r.executionDate).length,10);
  assert.equal(KK_OCTOBER5_EVIDENCE.filter(r=>r.targetLastFlip===r.lastFlip).length,3);
});

test("39 quality-checked fixtures reproduce reference and later levels with correct next-open dates",()=>{
  for(const row of KK_OCTOBER5_EVIDENCE){
    const raw=readFileSync(new URL(`../${row.fixture}`,import.meta.url),"utf8");
    assert.equal(createHash("sha256").update(raw).digest("hex"),row.fixtureSha256,row.asset);
    const fixture=JSON.parse(raw),all:Candle[]=fixture.candles;
    assert.ok(Object.values(fixture.quality).every(n=>n===0),row.asset);
    const cs=all.filter(c=>c.complete&&c.time<cutoff);
    assert.equal(new Date(cs.at(-1)!.time).toISOString().slice(0,10),row.through);
    const options:IndicatorCalculationOptions=row.assetClass==="crypto"?{asset:row.asset as keyof typeof KK_SUPERTREND_PRESETS}:row.assetClass==="stock"?{market:"equity",stock:row.asset as keyof typeof KK_SUPERTREND_STOCK_PRESETS}:{market:"commodity",commodity:row.asset as keyof typeof KK_SUPERTREND_COMMODITY_PRESETS};
    const signal=calculateIndicators(cs,"1d",{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.equal(signal.values.supertrend,row.value,row.asset);assert.equal(signal.state,row.state,row.asset);assert.equal(signal.confirmation!.required,5);
    const flipIndex=signal.lastFlip==null?-1:cs.findIndex(c=>c.time===signal.lastFlip);
    assert.equal(flipIndex<0||!cs[flipIndex+1]?null:new Date(cs[flipIndex+1].time).toISOString().slice(0,10),row.executionDate,row.asset);
    const partial={...cs.at(-1)!,time:cutoff,close:cs.at(-1)!.close*10,complete:false};
    const withPartial=calculateIndicators([...cs,partial],"1d",{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.equal(withPartial.state,signal.state);assert.deepEqual(withPartial.values,signal.values);assert.deepEqual(withPartial.confirmation,signal.confirmation);assert.equal(withPartial.states.at(-1),null);
    const latest=calculateIndicators(all,"1d",{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.equal(latest.values.supertrend,row.latestValue);assert.equal(latest.state,row.latestState);
    const prefix=calculateIndicators(cs.slice(0,-1),"1d",{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.deepEqual(prefix.states,signal.states.slice(0,-1));
    assert.match(calibrationStatus(options.asset,"1d",options.stock,options.commodity),/October 5 chart.*October 6/);
    assert.match(kkCalibrationWarning(row.asset,"1d")!.label,row.status==="unresolved"?/Unreliable/:/Low-confidence/);
  }
});
