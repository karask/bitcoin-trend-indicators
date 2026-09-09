import assert from "node:assert/strict";
import test from "node:test";
import { OVERVIEW_ASSETS, overviewIndicator, overviewLevels, overviewState, overviewTimeframe, overviewUrl, summarizeOverview } from "../lib/asset-overview.ts";
import { ASSETS } from "../lib/markets.ts";
import { STOCKS, aggregateStockWeeks, type StockHistoryResponse } from "../lib/stocks.ts";
import { calculateIndicators, INDICATOR_SPECS, type Candle } from "../lib/regimes.ts";
import { xnasSessionsBetween } from "../lib/xnas-calendar.ts";
import type { MarketDataset } from "../lib/market-data.ts";

const DAY = 86_400_000;
const candles: Candle[] = Array.from({ length: 300 }, (_, i) => ({ time: Date.UTC(2020, 0, 6) + i * DAY, open: 100 + i, high: 105 + i, low: 95 + i, close: 101 + i, volume: 1, complete: true }));
const dataset = (timeframe: "1d" | "1w", asset = ASSETS[0]): MarketDataset => ({ asset: asset.id, assetLabel: asset.label, source: asset.defaultSource, sourceLabel: "Fixture", market: `${asset.symbol}/USD`, denomination: "USD", timeframe, candles: candles.map((c, i) => ({ ...c, time: candles[0].time + i * DAY * (timeframe === "1w" ? 7 : 1) })), retrievedAt: "2026-09-07T09:00:00Z", checksum: "fixture", stale: false, demo: false, storage: "d1", warning: null, provisional: null, quality: { gaps: 0, duplicates: 0, malformed: 0 } });

test("overview catalog includes every asset once, crypto before stocks, and links to the selected indicator", () => {
  assert.deepEqual(OVERVIEW_ASSETS.map(item => item.asset), [...ASSETS, ...STOCKS].map(item => item.id));
  assert.equal(new Set(OVERVIEW_ASSETS.map(item => item.asset)).size, OVERVIEW_ASSETS.length);
  for (const asset of OVERVIEW_ASSETS) {
    const url = new URL(overviewUrl(asset, "mayer"), "https://test.invalid");
    assert.equal(url.pathname, asset.lab === "crypto" ? "/" : "/stocks/");
    assert.equal(url.searchParams.get("asset"), asset.asset);
    assert.equal(url.searchParams.get("indicator"), "mayer");
    assert.equal(url.searchParams.get("timeframe"), "1d");
    assert.equal(url.searchParams.get("source"), asset.lab === "crypto" ? asset.source : null);
  }
  assert.equal(overviewIndicator("bad").id, "kk_supertrend");
  assert.equal(overviewTimeframe("ma_200w"), "1w");
  assert.equal(overviewTimeframe("golden_cross"), "1d");
});

test("all indicators in the crypto overview use the existing engine and per-asset presets unchanged", () => {
  for (const asset of ASSETS) {
    const history = { daily: dataset("1d", asset), weekly: dataset("1w", asset) };
    for (const spec of INDICATOR_SPECS) {
      const summary = summarizeOverview({ lab: "crypto", history }, spec.id);
      for (const tf of ["1d", "1w"] as const) {
        const actual = tf === "1d" ? summary.day : summary.week;
        const expected = calculateIndicators(tf === "1d" ? history.daily.candles : history.weekly.candles, tf, { asset: asset.id, market: "crypto", indicatorIds: [spec.id] })[0];
        assert.deepEqual(actual, expected, `${asset.id}/${tf}/${spec.id}`);
        if (!spec.supportedTimeframes.includes(tf)) assert.equal(overviewState(actual, false), "N/A");
      }
    }
  }
});

test("stock overview uses completed XNAS weeks and stock-specific KK presets", () => {
  const sessions = xnasSessionsBetween("2020-01-06", "2025-12-31");
  const daily = sessions.map((session, i) => ({ ...candles[i % candles.length], time: Date.parse(`${session.date}T00:00:00Z`) }));
  for (const stock of STOCKS) {
    const history: StockHistoryResponse = { stock, provider: { id: "yahoo", label: "Yahoo Finance" }, providerUrl: "https://finance.yahoo.com/", exchange: "NASDAQ", timeframe: "1d", requestedStart: "2020-01-06", requiredThrough: "2025-12-31", retrievedAt: "2026-01-01T01:00:00Z", adjustment: "split-adjusted", candles: daily, quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 } };
    for (const spec of INDICATOR_SPECS) {
      const summary = summarizeOverview({ lab: "stock", history }, spec.id);
      assert.deepEqual(summary.week, calculateIndicators(aggregateStockWeeks(daily, Date.parse(history.retrievedAt)), "1w", { market: "equity", stock: stock.id, indicatorIds: [spec.id] })[0]);
      assert.deepEqual(summary.day, calculateIndicators(daily, "1d", { market: "equity", stock: stock.id, indicatorIds: [spec.id] })[0]);
      if (spec.id === "kk_supertrend") { assert.equal(summary.week.values.atrLength, stock.id === "spcx" ? 10 : 15); assert.equal(summary.week.values.factor, stock.id === "spcx" ? 3 : 2); }
    }
  }
});

test("overview conditions and supporting model labels do not invent reversal prices or neutral readiness", () => {
  const signals = calculateIndicators(candles, "1d", { asset: "sui" });
  const kk = signals.find(item => item.id === "kk_supertrend")!;
  assert.deepEqual(overviewLevels(kk), [{ label: "Bear below", price: kk.bearTrigger }]);
  const macd = signals.find(item => item.id === "macd")!;
  assert.deepEqual(overviewLevels(macd), []);
  const mayer = signals.find(item => item.id === "mayer")!;
  assert.match(overviewState(mayer, true), /200D price ratio/);
  assert.deepEqual(overviewLevels(mayer), []);
  const baseline = calculateIndicators(candles, "1w", { indicatorIds: ["ma_200w"] })[0];
  assert.deepEqual(overviewLevels(baseline), [{ label: "Baseline", price: baseline.values.sma200 }]);
  const short = calculateIndicators(candles.slice(0, 2), "1w", { indicatorIds: ["kk_supertrend"] })[0];
  assert.equal(overviewState(short, true), "Insufficient history");
  assert.deepEqual(overviewLevels(short), []);
  assert.equal(overviewState(undefined, false), "N/A");
  assert.equal(overviewState(undefined, true), "Not loaded");
});
