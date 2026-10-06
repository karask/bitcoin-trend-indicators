import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import { KK_SEPTEMBER28_EVIDENCE } from "../lib/kk-september28-evidence.ts";
import { calibrationStatus } from "../lib/kk-calibration.ts";
import { ASSETS, marketDefinition, minimumSourceCandles } from "../lib/markets.ts";
import { STOCKS, aggregateStockWeeks, stockDefinition } from "../lib/stocks.ts";
import { aggregateWeekly } from "../lib/market-data.ts";
import { fetchYahooStockHistory } from "../lib/yahoo.ts";
import { buildResearch } from "../lib/research.ts";

type Fixture = { asset: string; source: string; quality: Record<string, number>; daily: Candle[]; weekly: Candle[] };
const fixture = (asset: string): Fixture => JSON.parse(readFileSync(new URL(`../research/kk-2026-09-28/${asset}.json`, import.meta.url), "utf8"));
const cutoff = Date.UTC(2026, 8, 28);
const optionsFor = (asset: string): IndicatorCalculationOptions => asset === "vvv" || asset === "qnt" ? { asset } : { market: "equity", stock: asset as keyof typeof KK_SUPERTREND_STOCK_PRESETS };

test("September 28 catalog routes all eleven additions to verified providers", async () => {
  for (const id of ["vvv", "qnt"] as const) {
    assert.equal(ASSETS.find(a => a.id === id)?.defaultSource, "coinbase");
    assert.equal(marketDefinition(id, "coinbase").providerSymbol, `${id.toUpperCase()}-USD`);
    const f = fixture(id);
    assert.ok(f.daily.length >= minimumSourceCandles(id, "1d"));
    assert.ok(f.weekly.length >= minimumSourceCandles(id, "1w"));
    assert.deepEqual(aggregateWeekly(f.daily), f.weekly);
  }
  for (const id of ["crcl", "intc", "mrvl", "amd", "amzn", "meta", "bot", "strc", "pltr"] as const) {
    const stock = stockDefinition(id), f = fixture(id);
    assert.equal(stock.provider, "yahoo");
    assert.equal(new Date(f.daily[0].time).toISOString().slice(0, 10), stock.historyStart);
    const body = { chart: { result: [{ timestamp: f.daily.map(c => c.time / 1000 + 14 * 3600 + 30 * 60), indicators: { quote: [{ open: f.daily.map(c => c.open), high: f.daily.map(c => c.high), low: f.daily.map(c => c.low), close: f.daily.map(c => c.close), volume: f.daily.map(c => c.volume) }] } }], error: null } };
    const history = await fetchYahooStockHistory(stock.symbol, async () => Response.json(body), cutoff);
    assert.equal(history.candles.length, f.daily.length);
    assert.equal(history.requiredThrough, "2026-09-25");
    assert.deepEqual(aggregateStockWeeks(history.candles, cutoff), f.weekly);
  }
  assert.equal(stockDefinition("CRCL").exchange, "NYSE");
  assert.equal(stockDefinition("STRC").id, "strc");
  assert.notEqual(stockDefinition("STRC").id, stockDefinition("MSTR").id);
  assert.equal(STOCKS.length, 17);
  assert.equal(ASSETS.length, 20);
});

test("all 16 weekly and five daily references replay without concealing failed fits", () => {
  assert.equal(KK_SEPTEMBER28_EVIDENCE.filter(r => r.timeframe === "1w").length, 16);
  assert.equal(KK_SEPTEMBER28_EVIDENCE.filter(r => r.timeframe === "1d").length, 5);
  for (const row of KK_SEPTEMBER28_EVIDENCE) {
    const f = fixture(row.asset), candles = row.timeframe === "1w" ? f.weekly : f.daily;
    assert.ok(Object.values(f.quality).every(n => n === 0));
    assert.ok(candles.every(c => c.complete && c.time < cutoff));
    const options = { ...optionsFor(row.asset), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: row.preset.atrLength, kkSupertrendFactor: row.preset.factor };
    const actual = calculateIndicators(candles, row.timeframe, options)[0];
    assert.equal(actual.values.supertrend, row.value, row.asset);
    assert.equal(actual.state, row.state, row.asset);
    assert.deepEqual([actual.values.atrLength, actual.values.factor], [row.preset.atrLength, row.preset.factor]);
    assert.equal(actual.lastFlip == null ? null : new Date(actual.lastFlip).toISOString().slice(0, 10), row.lastFlip);
    assert.deepEqual(actual.confirmation ?? null, row.confirmation);
    const prefix = calculateIndicators(candles.slice(0, -1), row.timeframe, options)[0];
    assert.deepEqual(prefix.states, actual.states.slice(0, -1));
    assert.deepEqual(prefix.overlays[0].points, actual.overlays[0].points.filter(p => p.time <= candles.at(-2)!.time));
    if (row.status === "timing-difference") {
      assert.equal(prefix.values.supertrend, row.comparisonValue);
      assert.equal(prefix.state, row.targetState);
      assert.ok(Math.abs(row.comparisonErrorPct) < .06);
      assert.notEqual(actual.values.supertrend, prefix.values.supertrend, "Do not silently skip the latest complete week");
    } else if (row.status === "matched") {
      assert.equal(actual.state, row.targetState);
      assert.ok(Math.abs(row.errorPct) < .002);
    }
    const asset = row.source === "coinbase" ? row.asset as "vvv" | "qnt" : undefined;
    const stock = asset ? undefined : row.asset as keyof typeof KK_SUPERTREND_STOCK_PRESETS;
    if (row.timeframe === "1w") {
      assert.match(calibrationStatus(asset, row.timeframe, stock), /September 28/);
      if (row.status === "unresolved") assert.match(calibrationStatus(asset, row.timeframe, stock), /unresolved/);
    } else {
      assert.match(calibrationStatus(asset, row.timeframe, stock), /October [56]/, "New daily evidence takes precedence without rewriting archived results");
    }
    const before = calculateIndicators(candles.slice(-300), row.timeframe, { ...optionsFor(row.asset), kkSupertrendAtrLength: row.previous.atrLength, kkSupertrendFactor: row.previous.factor });
    const after = calculateIndicators(candles.slice(-300), row.timeframe, optionsFor(row.asset));
    assert.deepEqual(after.filter(s => s.id !== "kk_supertrend"), before.filter(s => s.id !== "kk_supertrend"));
  }
});

test("daily selections consider reversal timing, preserve five-close confirmation and ignore unfinished candles", () => {
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.strc["1d"], { atrLength: 30, factor: 4 });
  assert.deepEqual(KK_SUPERTREND_STOCK_PRESETS.crcl["1d"], { atrLength: 50, factor: 6 });
  assert.deepEqual(KK_SUPERTREND_PRESETS.qnt["1d"], { atrLength: 50, factor: 4 });
  for (const asset of ["strc", "crcl", "bot", "spcx", "qnt"]) {
    const candles = fixture(asset).daily, options = { ...optionsFor(asset), indicatorIds: ["kk_supertrend"] };
    const kk = calculateIndicators(candles, "1d", options)[0];
    assert.equal(kk.confirmation?.required, 5);
    const partial = { ...candles.at(-1)!, time: cutoff, high: 999999, low: .01, close: 1, complete: false };
    const withPartial = calculateIndicators([...candles, partial], "1d", options)[0];
    assert.deepEqual(withPartial.values, kk.values);
    assert.deepEqual(withPartial.confirmation, kk.confirmation);
    assert.equal(withPartial.state, kk.state);
  }
  for (const [asset, executionDate] of [["strc", "2026-07-07"], ["crcl", "2026-09-11"]]) {
    const candles = fixture(asset).daily, options = optionsFor(asset), signals = calculateIndicators(candles, "1d", options);
    const kk = signals.find(s => s.id === "kk_supertrend")!;
    const signalIndex = candles.findIndex(c => c.time === kk.lastFlip);
    assert.equal(new Date(candles[signalIndex + 1].time).toISOString().slice(0, 10), executionDate);
    const research = buildResearch(candles, signals, "kk_supertrend", "1d", options);
    for (const e of research.detail?.executions ?? []) {
      const i = candles.findIndex(c => c.time === e.time);
      assert.equal(e.price, candles[i].open);
      assert.equal(e.signalTime, candles[i - 1].time);
    }
  }
  const bot = KK_SEPTEMBER28_EVIDENCE.filter(r => r.asset === "bot");
  for (const row of bot) {
    assert.equal(row.status, "unresolved");
    assert.notEqual(row.state, row.targetState);
  }
  assert.match(calibrationStatus(undefined, "1w", "strc"), /Uncalibrated/);
});
