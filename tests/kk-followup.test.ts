import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateIndicators, KK_SUPERTREND_COMMODITY_PRESETS, KK_SUPERTREND_STOCK_PRESETS, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import { KK_FOLLOWUP_EVIDENCE } from "../lib/kk-followup-evidence.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { buildResearch } from "../lib/research.ts";

const fixtures = JSON.parse(readFileSync(new URL("../research/kk-2026-09-09/fixtures.json", import.meta.url), "utf8")) as { asset: string; rows: number[][] }[];
const candlesFor = (asset: string): Candle[] => fixtures.find(row => row.asset === asset)!.rows.map(([time,open,high,low,close,volume]) => ({ time,open,high,low,close,volume,complete:true }));
const optionsFor = (asset: "gold" | "silver" | "bmnr"): IndicatorCalculationOptions => asset === "bmnr" ? {market:"equity",stock:asset} : {market:"commodity",commodity:asset};

test("three weekly screenshots reproduce approximate levels, states and documented calculated flip dates", () => {
  for (const row of KK_FOLLOWUP_EVIDENCE) {
    const candles = candlesFor(row.asset), options = optionsFor(row.asset);
    assert.equal(candles.length,row.candles);
    assert.equal(candles.at(-1)!.time,row.through);
    assert.ok(row.through < Date.UTC(2026,8,7), "Current partial week is excluded");
    const kk = calculateIndicators(candles,"1w",{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.equal(kk.values.supertrend,row.value);
    assert.equal(kk.state,row.targetState);
    assert.equal(kk.lastFlip,row.lastFlip);
    assert.ok(Math.abs(kk.values.supertrend!-row.target) <= row.tolerance);
    assert.ok(Math.abs(kk.values.supertrend!/row.target-1) < .04);
    assert.deepEqual({atrLength:kk.values.atrLength,factor:kk.values.factor},row.preset);
    const before = calculateIndicators(candles,"1w",{...options,indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:row.previous.atrLength,kkSupertrendFactor:row.previous.factor})[0];
    assert.equal(before.values.supertrend,row.previousValue);
    assert.equal(before.state,row.previousState);
  }
  const silver = calculateIndicators(candlesFor("silver"),"1w",{market:"commodity",commodity:"silver",indicatorIds:["kk_supertrend"],kkSupertrendAtrLength:7,kkSupertrendFactor:3})[0];
  assert.equal(silver.lastFlip,Date.UTC(2026,2,16),"Rejected numerical fit has the wrong reversal month");
});

test("shared presets accept documented deviations and preserve reference regimes and timing", () => {
  for (const row of KK_FOLLOWUP_EVIDENCE) {
    assert.deepEqual(row.preset, { atrLength: row.asset === "gold" ? 10 : 15, factor: 2 });
  }
  const silver = calculateIndicators(candlesFor("silver"), "1w", { ...optionsFor("silver"), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: 10, kkSupertrendFactor: 3 })[0];
  assert.equal(silver.lastFlip, Date.UTC(2026, 2, 16), "Closer 10/3 level has the wrong reversal month");
  assert.equal(KK_FOLLOWUP_EVIDENCE[1].lastFlip, Date.UTC(2026, 0, 26));
  assert.equal(KK_FOLLOWUP_EVIDENCE[2].lastFlip, Date.UTC(2026, 7, 31));
});

test("only weekly KK changes; daily, generic futures baseline and all other indicators remain identical", () => {
  for (const row of KK_FOLLOWUP_EVIDENCE) {
    const candles=candlesFor(row.asset), options=optionsFor(row.asset);
    for (const timeframe of ["1d","1w"] as const) {
      const current=calculateIndicators(candles,timeframe,options);
      const previous=calculateIndicators(candles,timeframe,{...options,kkSupertrendAtrLength:10,kkSupertrendFactor:3});
      assert.deepEqual(current.filter(s=>s.id!=="kk_supertrend"),previous.filter(s=>s.id!=="kk_supertrend"));
      if (timeframe==="1d") assert.deepEqual(current,previous);
    }
  }
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.tsla["1w"],{atrLength:15,factor:2});
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.spcx["1w"],{atrLength:10,factor:3});
  for(const asset of ["gold","silver"] as const) {
    assert.deepEqual(KK_SUPERTREND_COMMODITY_PRESETS[asset]["1d"],{atrLength:10,factor:3});
    assert.equal(calibrationStatus(undefined,"1w",undefined,asset),"Approximate weekly screenshot fit");
    assert.equal(calibrationStatus(undefined,"1d",undefined,asset),"Uncalibrated futures preset");
  }
  assert.equal(calibrationStatus(undefined,"1d","bmnr"),"Uncalibrated equity preset");
  const defaultKk=calculateIndicators(candlesFor("gold"),"1w",{market:"commodity",indicatorIds:["kk_supertrend"]})[0];
  assert.deepEqual([defaultKk.values.atrLength,defaultKk.values.factor],[10,3]);
});

test("calibrated KK stays non-repainting with next-open execution, costs, benchmark and honest short-history research", () => {
  for (const row of KK_FOLLOWUP_EVIDENCE) {
    const candles=candlesFor(row.asset), options=optionsFor(row.asset);
    const signals=calculateIndicators(candles,"1w",options), kk=signals.find(s=>s.id==="kk_supertrend")!;
    for(const end of [candles.length-1,candles.length-10]) {
      const prefix=calculateIndicators(candles.slice(0,end),"1w",{...options,indicatorIds:["kk_supertrend"]})[0];
      assert.deepEqual(prefix.states,kk.states.slice(0,end));
      assert.deepEqual(prefix.overlays[0].points,kk.overlays[0].points.filter(p=>p.time<=candles[end-1].time));
    }
    const r=buildResearch(candles,signals,"kk_supertrend","1w",{market:options.market});
    assert.equal(r.periodsPerYear,52);
    assert.ok(r.detail && r.benchmark);
    assert.equal(r.detail.summary.start,r.benchmark.summary.start);
    assert.equal(r.detail.summary.end,r.benchmark.summary.end);
    const returns=r.sensitivity.map(s=>s.result!.totalReturn);
    assert.ok(returns[0]>=returns[1]&&returns[1]>=returns[2]);
    for(const execution of r.detail.executions) {
      const index=candles.findIndex(c=>c.time===execution.time);
      assert.equal(execution.signalTime,candles[index-1].time);
      assert.equal(execution.price,candles[index].open);
    }
    if(row.asset==="bmnr") assert.equal(r.rolling.length,0);
    else {assert.ok(r.rolling.length); for(const window of r.rolling) assert.equal((window.end-window.start)/604800000,208);}
  }
});
