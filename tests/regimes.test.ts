import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ensureMarketSchema } from "../db/index.ts";
import { ASSETS, SOURCES, aggregateWeekly, marketDefinition, parseSpotPrice, sourcesForAsset, validateCandles, type MarketDataset } from "../lib/market-data.ts";
import { backtest, calculateIndicators, INDICATOR_SPECS, type Candle, type SignalSnapshot } from "../lib/regimes.ts";
import { completedBoundary, confirmationClock } from "../lib/confirmation-clock.ts";

const DAY = 86_400_000;

function history(count = 900): Candle[] {
  let prior = 100;
  return Array.from({ length: count }, (_, i) => {
    const close = 100 * Math.exp(i / 1300) * (1 + 0.16 * Math.sin(i / 22) + 0.04 * Math.sin(i / 5));
    const open = prior; prior = close;
    return { time: Date.UTC(2020, 0, 6) + i * DAY, open, high: Math.max(open, close) * 1.025, low: Math.min(open, close) * 0.975, close, volume: 1000 + i, complete: true };
  });
}

test("every registered daily preset calculates a non-repainting state vector", () => {
  const candles = history();
  const results = calculateIndicators(candles, "1d");
  const expected = INDICATOR_SPECS.filter(spec => spec.supportedTimeframes.includes("1d")).map(spec => spec.id).sort();
  assert.deepEqual(results.map(result => result.id).sort(), expected);
  for (const result of results) {
    assert.equal(result.states.length, candles.length, result.id);
    assert.ok(["bull", "bear", "neutral"].includes(result.state), result.id);
  }
  const changed = history(); changed[changed.length - 1] = { ...changed.at(-1)!, high: 999, low: 1, close: 500 };
  const revised = calculateIndicators(changed, "1d");
  for (const result of results) assert.deepEqual(result.states.slice(0, -1), revised.find(item => item.id === result.id)!.states.slice(0, -1), `${result.id} repainted confirmed history`);
});

test("indicator golden states and trigger classifications remain stable", () => {
  const results = calculateIndicators(history(), "1d");
  const vector = Object.fromEntries(results.map(result => [result.id, [result.state, result.thresholdKind]]));
  assert.deepEqual(vector, {
    support_band: ["bear", "fixed"], supertrend: ["bear", "provisional"], smma_ribbon: ["neutral", "conditional"], long_sma: ["bull", "fixed"],
    donchian_20_10: ["neutral", "fixed"], donchian_55_20: ["neutral", "fixed"], ichimoku: ["bear", "conditional"], macd: ["bear", "conditional"],
    psar: ["bear", "provisional"], vortex: ["bear", "provisional"], heikin_ashi: ["bear", "provisional"], absolute_momentum: ["bull", "fixed"],
    golden_cross: ["bull", "conditional"], adx: ["bear", "conditional"], chandelier: ["bull", "provisional"], mayer: ["neutral", "conditional"],
  });
  const support = results.find(item => item.id === "support_band")!;
  const prior19 = history().slice(-19).reduce((sum, candle) => sum + candle.close, 0) / 19;
  assert.equal(support.bullTrigger, Math.max(prior19, support.values.ema!));
  assert.equal(support.bearTrigger, Math.min(prior19, support.values.ema!));
});

test("Donchian uses prior-period channels and retains state between breakouts", () => {
  const candles: Candle[] = Array.from({ length: 70 }, (_, i) => ({ time: i * DAY, open: 100, high: i === 25 ? 120 : 105, low: i === 45 ? 80 : 95, close: i === 26 ? 121 : i === 46 ? 79 : 100, volume: 1, complete: true }));
  const result = calculateIndicators(candles, "1d").find(item => item.id === "donchian_20_10")!;
  assert.equal(result.states[26], "bull"); assert.equal(result.states[40], "bull"); assert.equal(result.states[46], "bear");
});

test("UTC aggregation admits only complete Monday-through-Sunday weeks", () => {
  const monday = Date.UTC(2024, 0, 1);
  const daily: Candle[] = Array.from({ length: 10 }, (_, i) => ({ time: monday + i * DAY, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 10, complete: true }));
  const weekly = aggregateWeekly(daily);
  assert.equal(weekly.length, 1);
  assert.deepEqual([weekly[0].time, weekly[0].open, weekly[0].high, weekly[0].low, weekly[0].close, weekly[0].volume], [monday, 100, 108, 99, 107, 70]);
});

test("quality validation rejects malformed bars, detects gaps and deduplicates without filling", () => {
  const rows: Candle[] = [
    { time: 0, open: 10, high: 12, low: 9, close: 11, volume: 1, complete: true },
    { time: 0, open: 10, high: 13, low: 9, close: 12, volume: 2, complete: true },
    { time: 2 * DAY, open: 12, high: 11, low: 10, close: 12, volume: 1, complete: true },
    { time: 3 * DAY, open: 12, high: 14, low: 11, close: 13, volume: 1, complete: true },
  ];
  const result = validateCandles(rows, DAY);
  assert.deepEqual({ gaps: result.gaps, duplicates: result.duplicates, malformed: result.malformed, length: result.candles.length }, { gaps: 2, duplicates: 1, malformed: 1, length: 2 });
});

test("backtest enters at the next open and charges one-way turnover", () => {
  const candles: Candle[] = [100, 100, 200, 200].map((open, i) => ({ time: i * DAY, open, high: open, low: open, close: open, volume: 1, complete: true }));
  const snapshot = { id: "test", displayName: "Test", shortName: "Test", role: "regime", family: "test", state: "bull", previousState: "bull", lastFlip: 0, thresholdKind: "fixed", bullTrigger: null, bearTrigger: null, triggerLabel: "", explanation: "", values: {}, overlays: [], states: ["bull", "bull", "bull", "bull"] } satisfies SignalSnapshot;
  const result = backtest(candles, [snapshot], "1d", 15)[0];
  assert.ok(Math.abs(result.totalReturn - 0.9985) < 1e-10); assert.equal(result.turnover, 1);
});

test("confirmation clocks follow UTC daily and Monday weekly boundaries", () => {
  const now = Date.UTC(2026, 7, 21, 16, 45, 53);
  assert.deepEqual(confirmationClock("1d", now), { title: "Next daily close", boundary: "Today 23:59:59 UTC · confirms at 00:00 UTC", remaining: "7h 14m", target: Date.UTC(2026, 7, 22) });
  assert.deepEqual(confirmationClock("1w", now), { title: "Next weekly close", boundary: "Sunday 23:59:59 UTC · confirms Monday at 00:00 UTC", remaining: "2d 7h 14m", target: Date.UTC(2026, 7, 24) });
  assert.equal(completedBoundary("1d", now), Date.UTC(2026, 7, 20));
  assert.equal(completedBoundary("1w", now), Date.UTC(2026, 7, 10));
});

test("spot ticker payloads are parsed for every supported venue", () => {
  assert.equal(parseSpotPrice("bitstamp", { last: "117500.25" }), 117500.25);
  assert.equal(parseSpotPrice("binance", { symbol: "BTCUSDT", price: "117501.50" }), 117501.5);
  assert.equal(parseSpotPrice("kraken", { error: [], result: { XXBTZUSD: { c: ["117499.75", "0.01"] } } }), 117499.75);
  assert.equal(parseSpotPrice("coinbase", { price: "117502.00" }), 117502);
  assert.throws(() => parseSpotPrice("bitstamp", { last: "not-a-price" }), /invalid spot price/);
});

test("BTC, ETH, and SOL expose isolated venue definitions and useful history", () => {
  assert.deepEqual(ASSETS.map(asset => asset.id), ["btc", "eth", "sol"]);
  for (const asset of ASSETS) assert.equal(sourcesForAsset(asset.id).length, 4);
  assert.equal(SOURCES.length, 12);
  assert.equal(marketDefinition("eth", "bitstamp").providerSymbol, "ethusd");
  assert.equal(marketDefinition("sol", "binance").providerSymbol, "SOLUSDT");
  assert.equal(marketDefinition("sol", "binance").historyStart, Date.UTC(2020, 7, 11));
});

test("legacy BTC-only SQLite tables migrate in place without losing candles", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE market_candles (source TEXT NOT NULL, timeframe TEXT NOT NULL, time INTEGER NOT NULL, market TEXT NOT NULL, open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL, volume REAL NOT NULL, complete INTEGER NOT NULL, PRIMARY KEY (source,timeframe,time))");
  database.exec("CREATE TABLE provider_snapshots (source TEXT NOT NULL, timeframe TEXT NOT NULL, market TEXT NOT NULL, retrieved_at TEXT NOT NULL, checksum TEXT NOT NULL, warning TEXT, first_candle INTEGER, last_candle INTEGER, candle_count INTEGER NOT NULL, PRIMARY KEY (source,timeframe))");
  database.exec("CREATE TABLE signal_snapshots (source TEXT NOT NULL, timeframe TEXT NOT NULL, indicator_id TEXT NOT NULL, candle_close INTEGER NOT NULL, state TEXT NOT NULL, prior_state TEXT NOT NULL, last_flip INTEGER, threshold_kind TEXT NOT NULL, bull_trigger REAL, bear_trigger REAL, payload TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (source,timeframe,indicator_id))");
  database.prepare("INSERT INTO market_candles VALUES (?,?,?,?,?,?,?,?,?,?)").run("bitstamp", "1d", 123, "BTC/USD", 1, 2, 0.5, 1.5, 10, 1);
  ensureMarketSchema(database);
  const row = database.prepare("SELECT asset,source,market,close FROM market_candles").get() as { asset: string; source: string; market: string; close: number };
  assert.deepEqual({ ...row }, { asset: "btc", source: "bitstamp", market: "BTC/USD", close: 1.5 });
  const primaryKey = (database.prepare("PRAGMA table_info(market_candles)").all() as Array<{ name: string; pk: number }>).filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => column.name);
  assert.deepEqual(primaryKey, ["asset", "source", "timeframe", "time"]);
  database.close();
});

test("local SQLite storage persists normalized candles between reads", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "btc-regime-sqlite-"));
  const priorPath = process.env.REGIME_SQLITE;
  process.env.REGIME_SQLITE = path.join(directory, "market.sqlite");
  try {
    const { persistDataset, readStoredDataset } = await import(`../lib/market-store.ts?test=${Date.now()}`);
    const boundary = completedBoundary("1d");
    const dataset = {
      asset: "btc",
      assetLabel: "Bitcoin",
      source: "bitstamp",
      sourceLabel: "Bitstamp",
      market: "BTC/USD",
      denomination: "USD",
      timeframe: "1d",
      candles: [boundary - DAY, boundary].map((time, index) => ({ time, open: 100 + index, high: 103 + index, low: 99 + index, close: 102 + index, volume: 10, complete: true })),
      retrievedAt: new Date().toISOString(),
      checksum: "test-checksum",
      provisional: null,
      stale: false,
      demo: false,
      storage: "provider",
      warning: null,
      quality: { gaps: 0, duplicates: 0, malformed: 0 },
    } satisfies MarketDataset;
    await persistDataset(dataset);
    const ethDataset = {
      ...dataset,
      asset: "eth",
      assetLabel: "Ethereum",
      market: "ETH/USD",
      candles: dataset.candles.map(candle => ({ ...candle, open: candle.open / 10, high: candle.high / 10, low: candle.low / 10, close: candle.close / 10 })),
      checksum: "eth-test-checksum",
    } satisfies MarketDataset;
    await persistDataset(ethDataset);
    const stored = await readStoredDataset("btc", "bitstamp", "1d");
    const storedEth = await readStoredDataset("eth", "bitstamp", "1d");
    assert.ok(stored);
    assert.ok(storedEth);
    assert.equal(stored.storage, "sqlite");
    assert.equal(stored.candles.length, 2);
    assert.equal(stored.candles.at(-1)?.close, 103);
    assert.equal(storedEth.candles.at(-1)?.close, 10.3);
    const { getDatabase } = await import("../db/index.ts");
    const tables = getDatabase().prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    assert.deepEqual(tables.map(row => row.name), ["market_candles", "provider_snapshots", "signal_snapshots"]);
    getDatabase().close();
  } finally {
    if (priorPath == null) delete process.env.REGIME_SQLITE;
    else process.env.REGIME_SQLITE = priorPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
