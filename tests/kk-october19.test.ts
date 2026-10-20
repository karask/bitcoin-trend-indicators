import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_OCTOBER19_EVIDENCE } from "../lib/kk-october19-evidence.ts";
import { calculateIndicators, KK_DAILY_CRYPTO_TIERS, KK_DAILY_UNCALIBRATED, kkDailyCryptoTier, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { kkCalibrationWarning } from "../lib/kk-reliability.ts";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const optionsFor = (row: typeof KK_OCTOBER19_EVIDENCE[number]): IndicatorCalculationOptions => row.assetClass === "crypto" ? { asset: row.asset as AssetId } : row.assetClass === "stock" ? { market: "equity", stock: row.asset as StockId } : { market: "commodity", commodity: row.asset as CommodityId };
const check = (asset: string, date: string) => KK_OCTOBER19_EVIDENCE.find(row => row.asset === asset)!.checks.find(c => c.date === date)!;

test("October 19 evidence classifies 28 October fits, four crypto tier coins and seven unresolved markets", () => {
  assert.equal(KK_OCTOBER19_EVIDENCE.length, 39);
  const by = (status: string) => KK_OCTOBER19_EVIDENCE.filter(row => row.status === status).map(row => row.asset).sort();
  assert.equal(by("october-fit").length, 28);
  assert.deepEqual(by("tier"), ["ada", "bonk", "jup", "ray"]);
  assert.deepEqual(by("unresolved"), ["bot", "mrvl", "pltr", "spcx", "sui", "tsla", "zec"]);
  for (const row of KK_OCTOBER19_EVIDENCE) {
    assert.deepEqual(row.preset, kkSupertrendPreset("1d", optionsFor(row)), row.asset);
    if (row.status === "tier") assert.deepEqual(row.preset, kkDailyCryptoTier(row.asset as AssetId), row.asset);
    const fits = row.checks.every(c => c.state === c.targetState && Math.abs(c.errorPct) < 1);
    assert.equal(fits, row.status === "october-fit", row.asset);
    assert.ok(row.checks.length >= 5 && row.checks.at(-1)!.date === "2026-10-19", row.asset);
  }
});

test("every October check replays from its archived fixture with the applied preset and held trail", () => {
  for (const row of KK_OCTOBER19_EVIDENCE) {
    for (const c of row.checks) {
      const candles = (JSON.parse(readFileSync(new URL(`../${c.fixture}`, import.meta.url), "utf8")).candles as Candle[]).filter(x => x.complete !== false && day(x.time) <= c.through);
      assert.equal(day(candles.at(-1)!.time), c.through, `${row.asset} ${c.date}`);
      const kk = calculateIndicators(candles, "1d", { ...optionsFor(row), indicatorIds: ["kk_supertrend"] })[0];
      assert.equal(kk.values.supertrend, c.value, `${row.asset} ${c.date}`);
      assert.equal(kk.state, c.state, `${row.asset} ${c.date}`);
      assert.equal(kk.confirmation!.count, c.confirmationCount, `${row.asset} ${c.date}`);
    }
  }
});

test("October 19 pending counters and flips: chart count adds the forming candle; flips confirm the day before the printed date", () => {
  for (const [asset, chart, completed] of [["doge", "bear 3/5", 2], ["link", "bear 4/5", 3], ["avax", "bear 3/5", 2], ["intc", "bear 4/5", 3], ["amd", "bear 2/5", 1], ["meta", "bear 2/5", 1]] as const) {
    const c = check(asset, "2026-10-19");
    assert.equal(c.chartPending, chart, asset); assert.equal(c.confirmationCount, completed, asset); assert.equal(c.state, "bull", asset);
  }
  // LINK 60/4.5 keeps the chart's bullish 4/5; the earlier 100/4.5 had already flipped bearish on 18 October.
  const link = calculateIndicators((JSON.parse(readFileSync(new URL(`../${check("link", "2026-10-19").fixture}`, import.meta.url), "utf8")).candles as Candle[]).filter(x => day(x.time) <= "2026-10-18"), "1d", { asset: "link", indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: 100, kkSupertrendFactor: 4.5 })[0];
  assert.equal(link.state, "bear");
  for (const asset of ["zec", "qnt", "sui"]) {
    const c = check(asset, "2026-10-19");
    assert.equal(c.state, "bear", asset);
    assert.equal(Math.round((Date.parse(c.targetLastFlip!) - Date.parse(c.lastFlip!)) / 864e5), 1, asset);
  }
  // QNT 27/3 reproduces the new bear trail after its flip; ZEC and SUI do not (kept, unresolved).
  assert.ok(Math.abs(check("qnt", "2026-10-19").errorPct) < 1);
  assert.ok(check("zec", "2026-10-19").errorPct < -4 && check("sui", "2026-10-19").errorPct < -15);
  for (const c of KK_OCTOBER19_EVIDENCE.find(row => row.asset === "zec")!.checks.slice(0, -1)) assert.ok(Math.abs(c.errorPct) < .01, c.date);
});

test("daily crypto tiers follow market cap; kept unresolved coins and other markets are flagged", () => {
  assert.deepEqual(kkDailyCryptoTier("btc"), KK_DAILY_CRYPTO_TIERS.bitcoin);
  assert.deepEqual(kkDailyCryptoTier("zec"), KK_DAILY_CRYPTO_TIERS.large);
  assert.deepEqual(kkDailyCryptoTier("ada"), KK_DAILY_CRYPTO_TIERS.mid);
  assert.deepEqual(kkDailyCryptoTier("jup"), KK_DAILY_CRYPTO_TIERS.small);
  assert.deepEqual(kkDailyCryptoTier("xrp" as AssetId), KK_DAILY_UNCALIBRATED);
  assert.deepEqual(kkSupertrendPreset("1d", { market: "equity", stock: "aapl" as StockId }), KK_DAILY_UNCALIBRATED);
  assert.deepEqual(kkSupertrendPreset("1d", { asset: "zec" }), { atrLength: 40, factor: 4 });
  assert.deepEqual(kkSupertrendPreset("1d", { asset: "sui" }), { atrLength: 10, factor: 2 });
  assert.equal(calibrationStatus("ada", "1d"), "Daily crypto tier 15/3.5 · no October fit · reviewed October 19");
  assert.equal(calibrationStatus("qnt", "1d"), "Daily October fit · 6 charts within 1% · reviewed October 19");
  assert.equal(calibrationStatus("zec", "1d"), "Daily screenshot reviewed · calibration unresolved · October 19");
  assert.equal(kkCalibrationWarning("link", "1d"), null);
  assert.match(kkCalibrationWarning("ada", "1d")!.label, /Low-confidence/);
  for (const asset of ["zec", "sui", "tsla"]) assert.match(kkCalibrationWarning(asset, "1d")!.label, /Unreliable/, asset);
});
