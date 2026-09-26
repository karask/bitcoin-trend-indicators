import assert from "node:assert/strict";
import test from "node:test";
import { calculateIndicators, indicatorDisplayName, INDICATOR_SPECS, type Candle, type Timeframe } from "../lib/regimes.ts";
import { overviewLevels, overviewTimeframe } from "../lib/asset-overview.ts";
import { timeframeGuidance } from "../lib/timeframe-guidance.ts";

const ID = "kk_50_200_ema";
const DAY = 86_400_000;
const candles = (closes: number[], timeframe: Timeframe = "1w"): Candle[] => closes.map((close, index) => ({
  time: Date.UTC(2020, 0, 6) + index * DAY * (timeframe === "1w" ? 7 : 1),
  open: close, high: close + 1, low: close - 1, close, volume: 1, complete: true,
}));
const calculate = (rows: Candle[], timeframe: Timeframe = "1w") => calculateIndicators(rows, timeframe, { indicatorIds: [ID] })[0];
const flat = Array<number>(200).fill(100);
const closeTo = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("50/200 EMA follows EMA arithmetic, with bullish iff price closes above both", () => {
  const equal = calculate(candles(flat));
  assert.equal(equal.state, "neutral");
  const above = calculate(candles([...flat, 200]));
  closeTo(above.values.ema50!, 100 + 100 * 2 / 51);
  closeTo(above.values.ema200!, 100 + 100 * 2 / 201);
  assert.equal(above.state, "bull");
  assert.equal(calculate(candles([...flat, 200, 102])).state, "neutral");
  assert.equal(calculate(candles([...flat, 200, 90])).state, "bear");
  assert.equal(above.bullTrigger, Math.max(above.values.ema50!, above.values.ema200!));
  assert.equal(above.bearTrigger, Math.min(above.values.ema50!, above.values.ema200!));
  // An EMA crossover is not required: price can reclaim both while the fast line is lower.
  const recovery = calculate(candles([...Array<number>(200).fill(200), ...Array<number>(100).fill(100), 150]));
  assert.ok(recovery.values.ema50! < recovery.values.ema200!);
  assert.equal(recovery.state, "bull");
  const touching = calculate(candles([...Array<number>(200).fill(0), 51, 2]));
  assert.equal(touching.values.ema50, 2);
  assert.equal(touching.state, "neutral");
});

test("next-close thresholds are exact for either EMA order and touching is not bullish", () => {
  for (const prices of [[...flat, 200], [...Array<number>(200).fill(200), ...Array<number>(100).fill(100)]]) {
    const current = calculate(candles(prices));
    assert.equal(calculate(candles([...prices, current.bullTrigger! + 0.01])).state, "bull");
    assert.notEqual(calculate(candles([...prices, current.bullTrigger! - 0.01])).state, "bull");
    assert.equal(calculate(candles([...prices, current.bearTrigger! - 0.01])).state, "bear");
  }
});

test("50/200 EMA needs 200 completed candles and ignores an unfinished candle", () => {
  const short = calculate(candles(flat.slice(0, 199)));
  assert.equal(short.readiness?.ready, false);
  assert.equal(short.readiness?.requiredCandles, 200);
  assert.equal(short.bullTrigger, null);
  assert.equal(short.overlays[1].points.length, 0);
  const rows = candles([...flat, 200, 102]);
  const confirmed = calculate(rows);
  const open: Candle = { ...rows.at(-1)!, time: rows.at(-1)!.time + 7 * DAY, close: 1_000_000, complete: false };
  const withOpen = calculate([...rows, open]);
  assert.deepEqual(withOpen.values, confirmed.values);
  assert.deepEqual(withOpen.overlays, confirmed.overlays);
  assert.equal(withOpen.state, confirmed.state);
  assert.equal(withOpen.lastFlip, confirmed.lastFlip);
  assert.deepEqual(withOpen.readiness, confirmed.readiness);
  assert.deepEqual(withOpen.states, [...confirmed.states, null]);
  const next = calculate([...rows, { ...open, complete: true }]);
  assert.equal(next.state, "bull");
  assert.deepEqual(next.states.slice(0, -1), confirmed.states);
});

test("weekly reference and daily equivalent have distinct names and candle horizons", () => {
  const spec = INDICATOR_SPECS.find(item => item.id === ID)!;
  assert.equal(INDICATOR_SPECS[2].id, "kk_200_ma");
  assert.equal(INDICATOR_SPECS[3].id, ID);
  assert.equal(overviewTimeframe(ID), "1w");
  for (const timeframe of ["1w", "1d"] as const) {
    const unit = timeframe === "1w" ? "week" : "day";
    const signal = calculate(candles([...flat, 200], timeframe), timeframe);
    assert.equal(indicatorDisplayName(spec, timeframe), `KK 50/200 ${unit} EMA`);
    assert.equal(signal.displayName, `KK 50/200 ${unit} EMA`);
    assert.deepEqual(signal.overlays.map(line => line.name), [`50-${unit} EMA`, `200-${unit} EMA`]);
    assert.equal(signal.states[198], null);
    assert.equal(signal.states[199], "neutral");
    assert.equal(signal.states[200], "bull");
    assert.match(signal.explanation, /if and only if/);
    assert.deepEqual(overviewLevels(signal), [
      { label: `50-${unit} EMA`, price: signal.values.ema50 },
      { label: `200-${unit} EMA`, price: signal.values.ema200 },
    ]);
  }
  for (const market of ["crypto", "stock", "commodity"] as const) {
    assert.equal(timeframeGuidance(ID, market)?.label, "1W");
  }
});
