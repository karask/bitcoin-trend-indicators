import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_OCTOBER12_EVIDENCE } from "../lib/kk-october12-evidence.ts";
import { calculateIndicators, KK_DAILY_CRYPTO_TIERS, KK_DAILY_UNCALIBRATED, kkDailyCryptoTier, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { kkCalibrationWarning } from "../lib/kk-reliability.ts";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const optionsFor = (row: typeof KK_OCTOBER12_EVIDENCE[number]): IndicatorCalculationOptions => row.assetClass === "crypto" ? { asset: row.asset as AssetId } : row.assetClass === "stock" ? { market: "equity", stock: row.asset as StockId } : { market: "commodity", commodity: row.asset as CommodityId };

test("October 12 evidence classifies 28 October fits, six crypto tier coins and five unresolved stocks", () => {
  assert.equal(KK_OCTOBER12_EVIDENCE.length, 39);
  const by = (status: string) => KK_OCTOBER12_EVIDENCE.filter(row => row.status === status).map(row => row.asset).sort();
  assert.equal(by("october-fit").length, 28);
  assert.deepEqual(by("tier"), ["ada", "bonk", "jup", "ray", "vvv", "zec"]);
  assert.deepEqual(by("unresolved"), ["bot", "mrvl", "nvda", "pltr", "spcx"]);
  for (const row of KK_OCTOBER12_EVIDENCE) {
    assert.deepEqual(row.preset, kkSupertrendPreset("1d", optionsFor(row)), row.asset);
    if (row.status === "tier") assert.deepEqual(row.preset, kkDailyCryptoTier(row.asset as AssetId), row.asset);
    const fits = row.checks.every(check => check.state === check.targetState && Math.abs(check.errorPct) < 1);
    assert.equal(fits, row.status === "october-fit", row.asset);
    assert.ok(row.checks.length >= 3 && row.checks.at(-1)!.date === "2026-10-12", row.asset);
  }
});

test("every October check replays from its archived fixture with the applied preset", () => {
  for (const row of KK_OCTOBER12_EVIDENCE) {
    for (const check of row.checks) {
      const candles = (JSON.parse(readFileSync(new URL(`../${check.fixture}`, import.meta.url), "utf8")).candles as Candle[]).filter(c => c.complete !== false && day(c.time) <= check.through);
      assert.equal(day(candles.at(-1)!.time), check.through, `${row.asset} ${check.date}`);
      const kk = calculateIndicators(candles, "1d", { ...optionsFor(row), indicatorIds: ["kk_supertrend"] })[0];
      assert.equal(kk.values.supertrend, check.value, `${row.asset} ${check.date}`);
      assert.equal(kk.state, check.state, `${row.asset} ${check.date}`);
      assert.equal(kk.confirmation!.required, 5);
    }
  }
});

test("daily crypto tiers follow market cap; unknown coins and other markets keep the unverified baseline", () => {
  assert.deepEqual(kkDailyCryptoTier("btc"), KK_DAILY_CRYPTO_TIERS.bitcoin);
  assert.deepEqual(kkDailyCryptoTier("zec"), KK_DAILY_CRYPTO_TIERS.large);
  assert.deepEqual(kkDailyCryptoTier("ada"), KK_DAILY_CRYPTO_TIERS.mid);
  assert.deepEqual(kkDailyCryptoTier("jup"), KK_DAILY_CRYPTO_TIERS.small);
  assert.deepEqual(kkDailyCryptoTier("xrp" as AssetId), KK_DAILY_UNCALIBRATED);
  assert.deepEqual(kkSupertrendPreset("1d", { market: "equity", stock: "aapl" as StockId }), KK_DAILY_UNCALIBRATED);
  assert.equal(calibrationStatus("zec", "1d"), "Daily crypto tier 15/4 · no October fit · reviewed October 12");
  assert.equal(calibrationStatus("btc", "1d"), "Daily October fit · 4 charts within 1% · reviewed October 12");
  assert.match(calibrationStatus(undefined, "1d", "nvda"), /calibration unresolved · October 12/);
  assert.equal(kkCalibrationWarning("btc", "1d"), null);
  assert.match(kkCalibrationWarning("zec", "1d")!.label, /Low-confidence/);
  assert.match(kkCalibrationWarning("nvda", "1d")!.label, /Unreliable/);
});
