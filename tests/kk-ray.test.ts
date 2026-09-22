import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { KK_RAY_EVIDENCE } from "../lib/kk-ray-evidence.ts";
import { marketDefinition } from "../lib/markets.ts";
import { calculateIndicators, KK_SUPERTREND_PRESETS, type Candle } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";

const candles: Candle[] = JSON.parse(readFileSync(new URL("../research/kk-2026-09-22/ray.json", import.meta.url), "utf8")).candles;

test("ray7 weekly screenshot fits the shared KK 15/2 family on Kraken USD", () => {
  const evidence = KK_RAY_EVIDENCE[0];
  const kk = calculateIndicators(candles, "1w", { asset: "ray", indicatorIds: ["kk_supertrend"] })[0];
  assert.deepEqual(KK_SUPERTREND_PRESETS.ray, { "1d": { atrLength: 10, factor: 3 }, "1w": { atrLength: 15, factor: 2 } });
  assert.equal(kk.state, evidence.targetState);
  assert.equal(kk.values.supertrend, evidence.value);
  assert.ok(Math.abs(kk.values.supertrend! / evidence.target - 1) < .006);
  assert.equal(kk.lastFlip, Date.UTC(2026, 7, 31));
  assert.equal(kk.lastFlip! + 7 * 86_400_000, Date.UTC(2026, 8, 7));
  assert.equal(candles.at(-1)!.time, Date.UTC(2026, 8, 14));
  assert.match(calibrationStatus("ray", "1w"), /September 22/);
  assert.match(calibrationStatus("ray", "1d"), /Uncalibrated daily/);
});

test("Raydium is isolated to its verified Kraken USD venue", () => {
  assert.equal(marketDefinition("ray", "kraken").providerSymbol, "RAYUSD");
  assert.equal(marketDefinition("ray", "kraken").denomination, "USD");
  assert.throws(() => marketDefinition("ray", "coinbase"), /Unsupported/);
});

test("Raydium calibration changes KK only and retains the normal weekly research path", () => {
  const signals = calculateIndicators(candles, "1w", { asset: "ray" });
  const baseline = calculateIndicators(candles, "1w", { asset: "ray", kkSupertrendAtrLength: 10, kkSupertrendFactor: 3 });
  assert.deepEqual(signals.filter(signal => signal.id !== "kk_supertrend"), baseline.filter(signal => signal.id !== "kk_supertrend"));
  const research = buildResearch(candles, signals, "kk_supertrend", "1w");
  assert.equal(research.periodsPerYear, 52);
  assert.ok(research.detail && research.benchmark);
  const returns = research.sensitivity.map(row => row.result!.totalReturn);
  assert.ok(returns[0] >= returns[1] && returns[1] >= returns[2]);
  for (const execution of research.detail.executions) {
    const index = candles.findIndex(candle => candle.time === execution.time);
    assert.equal(execution.signalTime, candles[index - 1].time);
    assert.equal(execution.price, candles[index].open);
  }
});
