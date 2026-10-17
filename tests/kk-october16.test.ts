import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_OCTOBER16_EVIDENCE } from "../lib/kk-october16-evidence.ts";
import { calculateIndicators, KK_DAILY_CRYPTO_TIERS, KK_DAILY_UNCALIBRATED, kkDailyCryptoTier, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { kkCalibrationWarning } from "../lib/kk-reliability.ts";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const optionsFor = (row: typeof KK_OCTOBER16_EVIDENCE[number]): IndicatorCalculationOptions => row.assetClass === "crypto" ? { asset: row.asset as AssetId } : row.assetClass === "stock" ? { market: "equity", stock: row.asset as StockId } : { market: "commodity", commodity: row.asset as CommodityId };

test("October 16 evidence classifies 29 October fits, four crypto tier coins and six unresolved markets", () => {
  assert.equal(KK_OCTOBER16_EVIDENCE.length, 39);
  const by = (status: string) => KK_OCTOBER16_EVIDENCE.filter(row => row.status === status).map(row => row.asset).sort();
  assert.equal(by("october-fit").length, 29);
  assert.deepEqual(by("tier"), ["ada", "bonk", "jup", "ray"]);
  assert.deepEqual(by("unresolved"), ["bot", "mrvl", "pltr", "silver", "spcx", "tsla"]);
  for (const row of KK_OCTOBER16_EVIDENCE) {
    assert.deepEqual(row.preset, kkSupertrendPreset("1d", optionsFor(row)), row.asset);
    if (row.status === "tier") assert.deepEqual(row.preset, kkDailyCryptoTier(row.asset as AssetId), row.asset);
    const fits = row.checks.every(check => check.state === check.targetState && Math.abs(check.errorPct) < 1);
    assert.equal(fits, row.status === "october-fit", row.asset);
    assert.ok(row.checks.length >= 4 && row.checks.at(-1)!.date === "2026-10-16", row.asset);
  }
});

test("every October check replays from its archived fixture with the applied preset and held trail", () => {
  for (const row of KK_OCTOBER16_EVIDENCE) {
    for (const check of row.checks) {
      const candles = (JSON.parse(readFileSync(new URL(`../${check.fixture}`, import.meta.url), "utf8")).candles as Candle[]).filter(c => c.complete !== false && day(c.time) <= check.through);
      assert.equal(day(candles.at(-1)!.time), check.through, `${row.asset} ${check.date}`);
      const kk = calculateIndicators(candles, "1d", { ...optionsFor(row), indicatorIds: ["kk_supertrend"] })[0];
      assert.equal(kk.values.supertrend, check.value, `${row.asset} ${check.date}`);
      assert.equal(kk.state, check.state, `${row.asset} ${check.date}`);
      assert.equal(kk.confirmation!.count, check.confirmationCount, `${row.asset} ${check.date}`);
      assert.equal(kk.confirmation!.required, 5);
    }
  }
});

test("held trail reproduces the October pending counters; the chart count adds the forming candle", () => {
  const counts = Object.fromEntries(KK_OCTOBER16_EVIDENCE.flatMap(row => row.checks.filter(check => check.chartPending).map(check => [`${row.asset} ${check.date}`, [check.chartPending, check.confirmationCount]])));
  assert.deepEqual(counts["zec 2026-10-09"], ["bear 2/5", 1]);
  assert.deepEqual(counts["zec 2026-10-16"], ["bear 5/5", 4]);
  assert.deepEqual(counts["qnt 2026-10-16"], ["bear 5/5", 4]);
  assert.deepEqual(counts["intc 2026-10-16"], ["bear 3/5", 2]);
  const zec = KK_OCTOBER16_EVIDENCE.find(row => row.asset === "zec")!;
  assert.deepEqual(zec.preset, { atrLength: 40, factor: 4 });
  for (const check of zec.checks) assert.ok(Math.abs(check.errorPct) < .01 && check.state === "bull", check.date);
  // BTC closed below the raw-trail level on 14 October; the held trail (as on the chart) never went pending.
  const btc = KK_OCTOBER16_EVIDENCE.find(row => row.asset === "btc")!.checks.at(-1)!;
  assert.equal(btc.confirmationCount, 0);
  assert.ok(Math.abs(btc.errorPct) < 1);
});

test("daily crypto tiers follow market cap; unknown coins and other markets keep the unverified baseline", () => {
  assert.deepEqual(kkDailyCryptoTier("btc"), KK_DAILY_CRYPTO_TIERS.bitcoin);
  assert.deepEqual(kkDailyCryptoTier("zec"), KK_DAILY_CRYPTO_TIERS.large);
  assert.deepEqual(kkDailyCryptoTier("ada"), KK_DAILY_CRYPTO_TIERS.mid);
  assert.deepEqual(kkDailyCryptoTier("jup"), KK_DAILY_CRYPTO_TIERS.small);
  assert.deepEqual(kkDailyCryptoTier("xrp" as AssetId), KK_DAILY_UNCALIBRATED);
  assert.deepEqual(kkSupertrendPreset("1d", { asset: "xrp" as AssetId }), KK_DAILY_UNCALIBRATED);
  assert.deepEqual(kkSupertrendPreset("1d", { market: "equity", stock: "aapl" as StockId }), KK_DAILY_UNCALIBRATED);
  assert.equal(calibrationStatus("ada", "1d"), "Daily crypto tier 15/3.5 · no October fit · reviewed October 16");
  assert.equal(calibrationStatus("zec", "1d"), "Daily October fit · 5 charts within 1% · reviewed October 16");
  assert.equal(calibrationStatus("btc", "1d"), "Daily October fit · 5 charts within 1% · reviewed October 16");
  assert.match(calibrationStatus(undefined, "1d", "tsla"), /calibration unresolved · October 16/);
  assert.equal(kkCalibrationWarning("btc", "1d"), null);
  assert.equal(kkCalibrationWarning("zec", "1d"), null);
  assert.match(kkCalibrationWarning("ada", "1d")!.label, /Low-confidence/);
  assert.match(kkCalibrationWarning("tsla", "1d")!.label, /Unreliable/);
});
