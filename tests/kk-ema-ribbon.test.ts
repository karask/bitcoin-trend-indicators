import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateIndicators, INDICATOR_SPECS, type Candle } from "../lib/regimes.ts";
import { overviewTimeframe } from "../lib/asset-overview.ts";

const candles = (closes: number[]): Candle[] => closes.map((close, i) => ({ time: i * 86_400_000, open: close, high: close + 1, low: close - 1, close, volume: 1, complete: true }));
const calculate = (rows: Candle[]) => calculateIndicators(rows, "1d", { indicatorIds: ["kk_ema_ribbon"] })[0];

test("KK EMA Ribbon is a separate daily indicator with conditional triggers", () => {
  const spec = INDICATOR_SPECS.find(s => s.id === "kk_ema_ribbon")!;
  assert.equal(spec.displayName, "KK EMA Ribbon");
  assert.deepEqual(spec.supportedTimeframes, ["1d"]);
  assert.equal(overviewTimeframe(spec.id), "1d");
  assert.deepEqual(calculateIndicators(candles([100]), "1w", { indicatorIds: [spec.id] }), []);
  assert.equal(calculate(candles([100])).bullTrigger, null);
  assert.match(spec.disclaimer!, /34\/48 colour rule is provisional/);
});

test("KK EMA boundaries reproduce September 14 screenshot rounding and completed-day values", () => {
  const fixtures = JSON.parse(readFileSync(new URL("./fixtures/kk-ema-ribbon.json", import.meta.url), "utf8")) as Record<string, { completedCloses: number[]; partialClose: number; expectedPartial: number[]; expectedCompleted: number[] }>;
  for (const [asset, fixture] of Object.entries(fixtures)) {
    const completed = calculate(candles(fixture.completedCloses));
    // Research-only partial-bar input: the dashboard supplies completed history.
    const partialRows = candles([...fixture.completedCloses, fixture.partialClose]);
    const partial = calculate(partialRows);
    for (const [i, key] of ["ema32", "ema58"].entries()) {
      assert.ok(Math.abs(completed.values[key]! - fixture.expectedCompleted[i]) < 1e-7, `${asset} ${key} completed`);
      assert.equal(Number(partial.values[key]!.toFixed(2)), fixture.expectedPartial[i], `${asset} ${key} screenshot`);
    }
    assert.deepEqual(partial.states.slice(0, -1), completed.states);
    assert.deepEqual(calculate(partialRows.map(c => ({ ...c, high: c.high * 2, low: c.low / 2 }))).values, partial.values, "Close source must ignore wick changes");
  }
});

test("KK EMA Ribbon handles warmup, equality, trends and grey transitions", () => {
  for (const size of [0, 1, 57]) {
    const result = calculate(candles(Array(size).fill(100)));
    assert.equal(result.readiness?.ready, false);
    assert.equal(result.readiness?.requiredCandles, 58);
    assert.ok(result.states.every(s => s === null));
    assert.equal(result.ribbons[0].points.length, 0);
  }
  const flat = calculate(candles(Array(58).fill(100)));
  assert.equal(flat.readiness?.ready, true);
  assert.equal(flat.state, "neutral");
  const rise = Array.from({ length: 150 }, (_, i) => 100 + i);
  assert.equal(calculate(candles(rise)).state, "bull");
  assert.equal(calculate(candles([...rise].reverse())).state, "bear");
  const turn = calculate(candles([...rise, ...rise.slice().reverse()]));
  const firstBear = turn.states.findIndex((state, i) => i >= 150 && state === "bear");
  assert.ok(firstBear > 150);
  assert.ok(turn.states.slice(150, firstBear).includes("neutral"));
  assert.deepEqual(turn.overlays.map(o => o.name), ["EMA 32", "EMA 58"]);
  assert.equal(turn.ribbons[0].points[0].time, 57 * 86_400_000);
  for (const [i, point] of turn.ribbons[0].points.entries()) {
    const boundaries = turn.overlays.map(o => o.points[i].value);
    assert.equal(point.upper, Math.max(...boundaries));
    assert.equal(point.lower, Math.min(...boundaries));
    assert.equal(turn.overlays[0].points[i].color, turn.ribbons[0].palette[point.state]);
  }
});
