import assert from "node:assert/strict";
import test from "node:test";
import { calculateIndicators, INDICATOR_SPECS, type Candle } from "../lib/regimes.ts";
import { kk200CompanionOverlay, kk200WeeklyCombinedRange } from "../lib/kk-200-overlay.ts";

const DAY = 86_400_000;
const MONDAY = Date.UTC(2020, 0, 6);
const daily: Candle[] = Array.from({ length: 210 * 7 }, (_, index) => ({
  time: MONDAY + index * DAY, open: 100, high: 201, low: 99,
  close: index < 1399 ? 100 : 200, volume: 1, complete: true,
}));
const weekly: Candle[] = Array.from({ length: 210 }, (_, index) => ({
  time: MONDAY + index * 7 * DAY, open: 100, high: 201, low: 99,
  close: index < 199 ? 100 : 200, volume: 7, complete: true,
}));

test("KK 200 is third and its active range uses the selected candle series", () => {
  assert.equal(INDICATOR_SPECS[2].id, "kk_200_ma");
  const day = calculateIndicators(daily, "1d", { indicatorIds: ["kk_200_ma"] })[0];
  const week = calculateIndicators(weekly, "1w", { indicatorIds: ["kk_200_ma"] })[0];
  assert.equal(day.readiness?.requiredCandles, 200);
  assert.equal(week.readiness?.requiredCandles, 200);
  assert.equal(day.overlays[0].name, "200-day SMA");
  assert.equal(week.overlays[0].name, "200-week SMA");
  assert.equal(day.ribbons[0].points[0].time, daily[199].time);
  assert.equal(week.ribbons[0].points[0].time, weekly[199].time);
  assert.equal(day.ribbons[0].palette.bull, "#2687d2");
  assert.equal(day.ribbons[0].palette.bear, "#ef9128");
  assert.equal(week.states[198], null);
  assert.equal(week.states[199], "bull");
  assert.ok(week.values.sma! < 200);
});

test("daily companion never sees this week's weekly close before next Monday", () => {
  const projected = kk200CompanionOverlay(daily, daily, weekly, "1d");
  assert.equal(projected.name, "200-week SMA");
  assert.equal(projected.points[0].time, weekly[200].time);
  assert.equal(projected.points[0].value, 100.5);
  assert.equal(projected.points.find(point => point.time === weekly[199].time), undefined);
});

test("weekly companion uses the last daily close in the completed week", () => {
  const projected = kk200CompanionOverlay(weekly, daily, weekly, "1w");
  assert.equal(projected.name, "200-day SMA");
  assert.equal(projected.points[0].time, weekly[28].time);
  const final = projected.points.at(-1)!;
  assert.equal(final.time, weekly.at(-1)!.time);
  assert.equal(final.value, 135.5);
});

test("combined weekly range follows the 200-day line even when the 200-week signal stays bullish", () => {
  const sampleDaily = daily.map((candle, index) => ({ ...candle, close: index >= daily.length - 210 ? 180 : 100 }));
  sampleDaily[sampleDaily.length - 8].close = 150;
  sampleDaily[sampleDaily.length - 1].close = 190;
  const sampleWeekly = weekly.map((candle, index) => ({ ...candle, close: index === 208 ? 150 : index === 209 ? 190 : 100 }));
  const signal = calculateIndicators(sampleWeekly, "1w", { indicatorIds: ["kk_200_ma"] })[0];
  const combined = kk200WeeklyCombinedRange(sampleWeekly, sampleDaily);
  assert.equal(signal.states[208], "bull");
  assert.equal(signal.states[209], "bull");
  assert.equal(combined.states[208], "bear");
  assert.equal(combined.states[209], "bull");
  assert.equal(combined.flips.at(-1)?.time, sampleWeekly[209].time);
  assert.equal(combined.ribbon.points.at(-1)?.state, "bull");
  assert.equal(combined.ribbon.points.at(-2)?.state, "bear");
  assert.equal(combined.ribbon.points.at(-1)?.lower, combined.dailyLine.points.at(-1)?.value);
  const futureMonday: Candle = { ...sampleDaily.at(-1)!, time: sampleWeekly.at(-1)!.time + 7 * DAY, close: 1000 };
  assert.equal(kk200WeeklyCombinedRange(sampleWeekly, [...sampleDaily, futureMonday]).dailyLine.points.at(-1)?.value, combined.dailyLine.points.at(-1)?.value);
});
