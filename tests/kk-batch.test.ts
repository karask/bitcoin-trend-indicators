import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, type Candle, type IndicatorCalculationOptions, type Timeframe } from "../lib/regimes.ts";
import { KK_BATCH_EVIDENCE } from "../lib/kk-batch-evidence.ts";
import { ASSETS, type AssetId } from "../lib/markets.ts";
import { STOCKS, isStockId } from "../lib/stocks.ts";
import { buildResearch } from "../lib/research.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";

type Fixture = { asset: string; timeframe: Timeframe; rows: number[][] };
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL("../research/kk-2026-09-08/fixtures.json", import.meta.url), "utf8"));
const candlesFor = (fixture: Fixture): Candle[] => fixture.rows.map(([time,open,high,low,close,volume])=>({time,open,high,low,close,volume,complete:true}));
const optionsFor = (asset: string): IndicatorCalculationOptions => isStockId(asset) ? { market:"equity", stock:asset } : { market:"crypto", asset:asset as AssetId };

test("TSLA.jpeg weekly reference confirms the existing KK 15/2 preset without changes", () => {
  const candles = candlesFor(fixtures.find(row => row.asset === "tsla")!);
  const kk = calculateIndicators(candles, "1w", { market: "equity", stock: "tsla", indicatorIds: ["kk_supertrend"] })[0];
  assert.equal(kk.state, "bear");
  assert.equal(kk.bullTrigger!.toFixed(2), "383.88");
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.tsla["1w"], { atrLength: 15, factor: 2 });
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.tsla["1d"], { atrLength: 10, factor: 3 });
  assert.ok(candles.at(-1)!.time < Date.UTC(2026, 8, 7));
});

test("September reference audit reproduces nineteen resolved charts within documented precision", () => {
  assert.equal(fixtures.length,20);
  assert.equal(KK_BATCH_EVIDENCE.filter(r=>!r.ignored).length,19);
  for(const row of KK_BATCH_EVIDENCE) {
    const candles=candlesFor(fixtures.find(f=>f.asset===row.asset)!);
    assert.equal(candles.length,row.candles);
    assert.equal(candles.at(-1)!.time,row.through);
    if(row.timeframe==="1w") for(let i=0;i<candles.length;i++) {
      assert.equal(new Date(candles[i].time).getUTCDay(),1);
      if(i)assert.equal(candles[i].time-candles[i-1].time,7*86_400_000);
      assert.ok(candles[i].time<Date.UTC(2026,8,7),"No partial screenshot candle in confirmed fixtures");
    }
    const result=calculateIndicators(candles,row.timeframe,{...optionsFor(row.asset),indicatorIds:["kk_supertrend"]})[0];
    assert.equal(result.values.supertrend,row.value,row.asset);
    assert.equal(result.lastFlip,row.lastFlip,row.asset);
    assert.equal(result.state,row.state,row.asset);
    assert.equal(result.values.atrLength,row.preset.atrLength);
    assert.equal(result.values.factor,row.preset.factor);
    if(!row.ignored) {
      assert.equal(result.state,row.targetState,row.asset);
      assert.ok(Math.abs(row.value-row.target)<=row.tolerance,`${row.asset}: ${row.value} vs ${row.target}`);
    }
  }
});

test("calibration changes KK only, preserves daily defaults and keeps stock identity outside crypto",()=>{
  for(const fixture of fixtures) {
    const candles=candlesFor(fixture), options=optionsFor(fixture.asset);
    const previous=KK_BATCH_EVIDENCE.find(r=>r.asset===fixture.asset)!.previous;
    const before=calculateIndicators(candles,fixture.timeframe,{...options,kkSupertrendAtrLength:previous.atrLength,kkSupertrendFactor:previous.factor});
    const after=calculateIndicators(candles,fixture.timeframe,options);
    assert.deepEqual(after.filter(r=>r.id!=="kk_supertrend"),before.filter(r=>r.id!=="kk_supertrend"),fixture.asset);
    const day=calculateIndicators(candles,"1d",options);
    if(!["eth","sol"].includes(fixture.asset)) {
      const kk=day.find(r=>r.id==="kk_supertrend")!, st=day.find(r=>r.id==="supertrend")!;
      assert.deepEqual(kk.states,st.states,fixture.asset);
      assert.equal(kk.values.supertrend,st.values.supertrend,fixture.asset);
    }
  }
  for(const stock of STOCKS) assert.ok(!ASSETS.some(asset=>String(asset.id)===stock.id));
  for(const stock of STOCKS.filter(s=>["tsla","nvda","googl","mu","sndk"].includes(s.id))) assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS[stock.id]["1w"],{atrLength:15,factor:2});
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.spcx,{"1d":{atrLength:10,factor:3},"1w":{atrLength:10,factor:3}});
  assert.match(calibrationStatus(undefined,"1d","spcx"),/Uncalibrated/);
  assert.deepEqual(KK_SUPERTREND_PRESETS.btc["1w"],{atrLength:10,factor:3});
  for(const asset of ["eth","sol"] as const) assert.deepEqual(KK_SUPERTREND_PRESETS[asset]["1w"],{atrLength:10,factor:2});
});

test("calibrated histories retain non-repainting, next-open research, costs and complete rolling windows",()=>{
  for(const fixture of fixtures.filter(f=>f.asset!=="spcx")) {
    const candles=candlesFor(fixture), options=optionsFor(fixture.asset);
    const signals=calculateIndicators(candles,fixture.timeframe,options);
    const kk=signals.find(s=>s.id==="kk_supertrend")!;
    const prefix=calculateIndicators(candles.slice(0,-5),fixture.timeframe,{...options,indicatorIds:["kk_supertrend"]})[0];
    assert.deepEqual(prefix.states,kk.states.slice(0,-5),fixture.asset);
    assert.deepEqual(prefix.overlays[0].points,kk.overlays[0].points.filter(p=>p.time<=candles.at(-6)!.time),fixture.asset);
    const research=buildResearch(candles,signals,"kk_supertrend",fixture.timeframe,{market:options.market});
    assert.equal(research.periodsPerYear,52);
    if(research.detail&&research.benchmark) {
      assert.equal(research.detail.summary.start,research.benchmark.summary.start);
      assert.equal(research.detail.summary.end,research.benchmark.summary.end);
      const returns=research.sensitivity.map(r=>r.result!.totalReturn);
      assert.ok(returns[0]>=returns[1]&&returns[1]>=returns[2],fixture.asset);
      assert.ok(research.start!>candles[0].time);
      for(const execution of research.detail.executions) {
        const index=candles.findIndex(c=>c.time===execution.time);
        assert.equal(execution.signalTime,candles[index-1].time);
        assert.equal(execution.price,candles[index].open);
      }
      for(const window of research.rolling) assert.equal((window.end-window.start)/(7*86_400_000),208);
    }
  }
});
