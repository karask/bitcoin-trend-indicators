import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateIndicators, KK_DAILY_UNCALIBRATED, KK_SUPERTREND_COMMODITY_PRESETS, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_WEEKLY_RULES, kkSupertrendPreset, kkWeeklyRule, type Candle } from "../lib/regimes.ts";
import { ASSETS, type AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { kkCalibrationWarning } from "../lib/kk-reliability.ts";

const spot = JSON.parse(readFileSync(new URL("../research/kk-2026-10-08-weekly-rule/spot-weekly.json", import.meta.url), "utf8")) as { series: { asset: string; through: string; candles: Candle[] }[] };
const daily: Candle[] = Array.from({ length: 400 }, (_, i) => ({ time: Date.UTC(2024, 0, 1) + i * 86_400_000, open: 10 + Math.sin(i / 9), high: 10.6 + Math.sin(i / 9), low: 9.4 + Math.sin(i / 9), close: 10.2 + Math.sin(i / 9), volume: 1, complete: true }));
const weekly: Candle[] = Array.from({ length: 120 }, (_, i) => ({ ...daily[i], time: Date.UTC(2024, 0, 1) + i * 7 * 86_400_000 }));

test("weekly KK follows one class rule: BTC 10/3, large-cap crypto 10/2, everything else 15/2", () => {
  assert.deepEqual(KK_WEEKLY_RULES, { bitcoin: { atrLength: 10, factor: 3 }, largeCapCrypto: { atrLength: 10, factor: 2 }, standard: { atrLength: 15, factor: 2 } });
  assert.deepEqual(ASSETS.filter(asset => asset.largeCap).map(asset => asset.id), ["eth", "sol", "bnb"]);
  assert.deepEqual(kkWeeklyRule("crypto", "btc"), KK_WEEKLY_RULES.bitcoin);
  for (const asset of ["eth", "sol", "bnb"] as const) assert.deepEqual(kkWeeklyRule("crypto", asset), KK_WEEKLY_RULES.largeCapCrypto);
  for (const asset of ASSETS.filter(item => item.id !== "btc" && !item.largeCap)) assert.deepEqual(KK_SUPERTREND_PRESETS[asset.id]["1w"], KK_WEEKLY_RULES.standard, asset.id);
  for (const preset of [...Object.values(KK_SUPERTREND_STOCK_PRESETS), ...Object.values(KK_SUPERTREND_COMMODITY_PRESETS)]) assert.deepEqual(preset["1w"], KK_WEEKLY_RULES.standard);
});

test("assets added without calibration get the weekly rule immediately and an unverified daily baseline", () => {
  const cases = [
    { options: { asset: "xrp" as AssetId }, weekly: KK_WEEKLY_RULES.standard },
    { options: { market: "equity" as const, stock: "aapl" as StockId }, weekly: KK_WEEKLY_RULES.standard },
    { options: { market: "commodity" as const, commodity: "copper" as CommodityId }, weekly: KK_WEEKLY_RULES.standard },
  ];
  for (const { options, weekly: expected } of cases) {
    assert.deepEqual(kkSupertrendPreset("1w", options), expected);
    assert.deepEqual(kkSupertrendPreset("1d", options), KK_DAILY_UNCALIBRATED);
    const week = calculateIndicators(weekly, "1w", { ...options, indicatorIds: ["kk_supertrend"] })[0];
    assert.deepEqual([week.values.atrLength, week.values.factor], [expected.atrLength, expected.factor]);
    const day = calculateIndicators(daily, "1d", { ...options, indicatorIds: ["kk_supertrend"] })[0];
    assert.deepEqual([day.values.atrLength, day.values.factor], [KK_DAILY_UNCALIBRATED.atrLength, KK_DAILY_UNCALIBRATED.factor]);
  }
  assert.equal(calibrationStatus("xrp" as AssetId, "1w"), "Weekly rule 15/2 · applied without calibration · October 8");
  assert.equal(calibrationStatus(undefined, "1w", "aapl" as StockId), "Weekly rule 15/2 · applied without calibration · October 8");
  assert.equal(kkCalibrationWarning("xrp", "1w"), null);
  assert.equal(kkCalibrationWarning("xrp", "1d")?.label, "Uncalibrated KK");
});

test("spot gold and silver reproduce the weekly screenshots with the 15/2 rule", () => {
  // OANDA XAUUSD spot (September 18 review) and SI1! back-adjusted futures (September 9 and 21 reviews).
  const references = { gold: { target: 4076.188, state: "bull", maxError: .0005 }, silver: { target: 75.73, state: "bear", maxError: .001 } } as const;
  for (const series of spot.series) {
    const reference = references[series.asset as keyof typeof references];
    const kk = calculateIndicators(series.candles, "1w", { market: "commodity", commodity: series.asset as CommodityId, indicatorIds: ["kk_supertrend"] })[0];
    assert.deepEqual([kk.values.atrLength, kk.values.factor], [15, 2]);
    assert.equal(kk.state, reference.state, series.asset);
    assert.ok(Math.abs(kk.values.supertrend! / reference.target - 1) < reference.maxError, `${series.asset} ${kk.values.supertrend}`);
  }
});
