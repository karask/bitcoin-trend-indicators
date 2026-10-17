import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_OCTOBER12_EVIDENCE } from "../lib/kk-october12-evidence.ts";
import { calculateIndicators, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const optionsFor = (row: typeof KK_OCTOBER12_EVIDENCE[number]): IndicatorCalculationOptions => row.assetClass === "crypto" ? { asset: row.asset as AssetId } : row.assetClass === "stock" ? { market: "equity", stock: row.asset as StockId } : { market: "commodity", commodity: row.asset as CommodityId };

// Historical record: October 16 replaced these presets and the raw-trail mechanism (see kk-october16.test.ts).
test("October 12 evidence classifies 28 October fits, six crypto tier coins and five unresolved stocks", () => {
  assert.equal(KK_OCTOBER12_EVIDENCE.length, 39);
  const by = (status: string) => KK_OCTOBER12_EVIDENCE.filter(row => row.status === status).map(row => row.asset).sort();
  assert.equal(by("october-fit").length, 28);
  assert.deepEqual(by("tier"), ["ada", "bonk", "jup", "ray", "vvv", "zec"]);
  assert.deepEqual(by("unresolved"), ["bot", "mrvl", "nvda", "pltr", "spcx"]);
  for (const row of KK_OCTOBER12_EVIDENCE) {
    const fits = row.checks.every(check => check.state === check.targetState && Math.abs(check.errorPct) < 1);
    assert.equal(fits, row.status === "october-fit", row.asset);
    assert.ok(row.checks.length >= 3 && row.checks.at(-1)!.date === "2026-10-12", row.asset);
  }
});

test("every October 12 check replays from its archived fixture with the preset and mechanism of that review", () => {
  for (const row of KK_OCTOBER12_EVIDENCE) {
    for (const check of row.checks) {
      const candles = (JSON.parse(readFileSync(new URL(`../${check.fixture}`, import.meta.url), "utf8")).candles as Candle[]).filter(c => c.complete !== false && day(c.time) <= check.through);
      assert.equal(day(candles.at(-1)!.time), check.through, `${row.asset} ${check.date}`);
      const kk = calculateIndicators(candles, "1d", { ...optionsFor(row), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: row.preset.atrLength, kkSupertrendFactor: row.preset.factor, kkSupertrendRawTrailConfirmation: true })[0];
      assert.equal(kk.values.supertrend, check.value, `${row.asset} ${check.date}`);
      assert.equal(kk.state, check.state, `${row.asset} ${check.date}`);
      assert.equal(kk.confirmation!.required, 5);
    }
  }
});
