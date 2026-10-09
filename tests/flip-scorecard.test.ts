import assert from "node:assert/strict";
import test from "node:test";
import { FLIP_SCORECARD_SETTINGS, flipScorecard, scorecardRank } from "../lib/flip-scorecard.ts";
import { buildResearch } from "../lib/research.ts";
import { calculateIndicators, type Candle, type RegimeState } from "../lib/regimes.ts";

const DAY = 86_400_000;
const candle = (i: number, open: number): Candle => ({ time: Date.UTC(2025, 0, 6) + i * 7 * DAY, open, high: open + 1, low: open - 1, close: open, volume: 1, complete: true });

test("flips execute at the next open and are scored by direction, horizon, whipsaw, lag and completed regime", () => {
  // Weekly settings: horizons 4/13/26, whipsaw 4 bars, lag lookback 26 bars.
  const opens = Array.from({ length: 60 }, (_, i) => 100 + i);
  const candles = opens.map((open, i) => candle(i, open));
  const states: RegimeState[] = candles.map((_, i) => i < 10 ? "bear" : i < 12 ? "bull" : i < 30 ? "bear" : "bull");
  const card = flipScorecard(candles, { id: "test", shortName: "Test", states }, "1w");
  // Bull flips confirm at candles 10 and 30; bear flips at 12 (whipsaw back from bull) and nothing else.
  assert.equal(card.bull.flips, 2);
  assert.equal(card.bear.flips, 1);
  assert.deepEqual(card.bull.horizons.map(h => h.bars), [...FLIP_SCORECARD_SETTINGS["1w"].horizons]);
  // Rising prices: every buy is right and the sell is wrong.
  assert.deepEqual(card.bull.horizons.map(h => h.hitRate), [1, 1, 1]);
  assert.deepEqual(card.bear.horizons.map(h => h.hitRate), [0, 0, 0]);
  // Buy at 10 executes at open 111; four bars later the open is 115.
  assert.equal(card.bull.horizons[0].medianReturn, ((115 / 111 - 1) + (135 / 131 - 1)) / 2);
  // The candle-10 buy reversed within four bars; the candle-30 buy did not.
  assert.equal(card.bull.whipsawRate, .5);
  // Buy lag: execution open versus the lowest low in the 26 bars ending at the signal candle.
  assert.equal(card.bull.horizons[2].scored, 2);
  assert.equal(card.bull.medianLagPct, ((111 / 99 - 1) + (131 / 104 - 1)) / 2);
  assert.equal(card.bull.medianLagBars, (10 + 25) / 2);
  // Only the candle-10 bull regime completed: entry 111, exit at the next open after candle 12 (113).
  assert.equal(card.bull.completed, 1);
  assert.equal(card.bull.medianRegimeReturn, 113 / 111 - 1);
  assert.equal(card.bull.winRate, 1);
  // The sell regime entered at 113 and ended at 131: a losing sell.
  assert.equal(card.bear.medianRegimeReturn, 131 / 113 - 1);
  assert.equal(card.bear.winRate, 0);
  assert.equal(scorecardRank(card), .5);
});

test("flips before the research start, neutral entries and the warmup seed are not counted", () => {
  const candles = Array.from({ length: 40 }, (_, i) => candle(i, 100 - i));
  const states: Array<RegimeState | null> = candles.map((_, i) => i < 3 ? null : i < 8 ? "bull" : i < 12 ? "neutral" : i < 20 ? "bear" : "bull");
  const all = flipScorecard(candles, { id: "t", shortName: "T", states }, "1w");
  assert.equal(all.bull.flips, 1, "The first non-null state is a seed, not a flip");
  assert.equal(all.bear.flips, 1, "Neutral is neither a buy nor a sell");
  const late = flipScorecard(candles, { id: "t", shortName: "T", states }, "1w", 15);
  assert.equal(late.bear.flips, 0);
  assert.equal(late.bull.flips, 1);
  assert.equal(late.bear.whipsawRate, null);
  assert.equal(scorecardRank(late), null);
});

test("research reports a scorecard for every comparable model on the shared window", () => {
  const candles = Array.from({ length: 700 }, (_, i) => ({ time: Date.UTC(2023, 0, 1) + i * DAY, open: 100 + 20 * Math.sin(i / 25), high: 103 + 20 * Math.sin(i / 25), low: 97 + 20 * Math.sin(i / 25), close: 100 + 20 * Math.sin((i + 1) / 25), volume: 1, complete: true }));
  const signals = calculateIndicators(candles, "1d", { asset: "btc" });
  const research = buildResearch(candles, signals, "kk_supertrend", "1d");
  assert.deepEqual(research.scorecards.map(card => card.indicatorId).sort(), research.backtests.map(row => row.indicatorId).sort());
  const ranks = research.scorecards.map(card => scorecardRank(card) ?? -1);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a));
  const kk = research.scorecards.find(card => card.indicatorId === "kk_supertrend")!;
  assert.ok(kk.bull.flips > 0 && kk.bear.flips > 0);
  assert.deepEqual(kk.bull.horizons.map(h => h.bars), [10, 30, 90]);
});
