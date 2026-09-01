import assert from "node:assert/strict";
import test from "node:test";
import { aggregateStockWeeks, isStockId, isStockSymbol, STOCKS, stockDefinition, type StockHistoryResponse } from "../lib/stocks.ts";
import { mergeIncrementalStockHistory, stockIncrementalStartDate } from "../lib/stock-cache.ts";
import { handleYahooStockHistoryRequest, latestRequiredYahooSession, normalizeYahooHistory } from "../lib/yahoo.ts";
import { storedStockHistory } from "../functions/_lib/stock-history.ts";
import type { CloudflareEnv, D1PreparedStatement } from "../functions/_lib/cloudflare.ts";
import { isXnasSessionDate, xnasDateKey, xnasSession, xnasSessionsBetween, xnasSessionsForYear } from "../lib/xnas-calendar.ts";
import type { Candle } from "../lib/regimes.ts";

const DAY = 86_400_000;

function candle(date: string, open: number, high: number, low: number, close: number, volume = 1): Candle {
  return { time: Date.parse(`${date}T00:00:00.000Z`), open, high, low, close, volume, complete: true };
}

function yahooBody(rows: Array<{ date: string; open: number | null; high: number | null; low: number | null; close: number | null; volume?: number | null }>, splits: Record<string, unknown> = {}) {
  return { chart: { error: null, result: [{
    meta: { symbol: "TSLA", currency: "USD", exchangeName: "NMS" },
    timestamp: rows.map(row => Date.parse(`${row.date}T14:30:00.000Z`) / 1000),
    indicators: { quote: [{ open: rows.map(row => row.open), high: rows.map(row => row.high), low: rows.map(row => row.low), close: rows.map(row => row.close), volume: rows.map(row => row.volume ?? 1) }], adjclose: [{ adjclose: rows.map(row => row.close) }] },
    events: { splits },
  }] } };
}

function stockResponse(dates: string[], requestedStart: string, requiredThrough: string, overrides: Partial<Record<string, Partial<Candle>>> = {}): StockHistoryResponse {
  const stock = stockDefinition("TSLA");
  return {
    stock, provider: { id: "yahoo", label: "Yahoo Finance" }, providerUrl: "https://finance.yahoo.com/", exchange: "NASDAQ", timeframe: "1d",
    requestedStart, requiredThrough, retrievedAt: "2010-07-08T01:00:00.000Z", adjustment: "split-adjusted",
    candles: dates.map((date, index) => ({ ...candle(date, 20 + index, 22 + index, 19 + index, 21 + index, 100 + index), ...overrides[date] })),
    quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 },
  };
}

test("stock definitions remain separate, complete, Yahoo-backed, and type guarded", () => {
  assert.deepEqual(STOCKS.map(stock => stock.id), ["tsla", "googl", "nvda", "spcx", "mu", "sndk"]);
  assert.deepEqual(STOCKS.map(stock => stock.symbol), ["TSLA", "GOOGL", "NVDA", "SPCX", "MU", "SNDK"]);
  assert.ok(STOCKS.every(stock => stock.exchange === "NASDAQ" && stock.currency === "USD" && stock.provider === "yahoo" && stock.calendar === "XNAS"));
  assert.equal(stockDefinition("SPCX").historyStart, "2026-06-12");
  assert.equal(stockDefinition("MU").company, "Micron Technology");
  assert.equal(stockDefinition("SNDK").historyStart, "2025-02-24");
  assert.equal(isStockId("tsla"), true);
  assert.equal(isStockId("btc"), false);
  assert.equal(isStockSymbol("SPCX"), true);
  assert.equal(isStockSymbol("spcx"), false);
});

test("XNAS calendar covers holidays, closures, early closes, and DST", () => {
  assert.ok(xnasSessionsForYear(1999).length > 240);
  assert.ok(xnasSessionsForYear(2035).length > 240);
  assert.equal(isXnasSessionDate("2025-01-20"), false);
  assert.equal(isXnasSessionDate("2025-04-18"), false);
  assert.equal(isXnasSessionDate("2025-06-19"), false);
  assert.equal(isXnasSessionDate("2025-01-09"), false);
  assert.equal(isXnasSessionDate("2001-09-12"), false);
  assert.equal(isXnasSessionDate("2012-10-29"), false);
  assert.deepEqual(xnasSession("2025-07-03"), { date: "2025-07-03", earlyClose: true, closeHourEastern: 13, closeAt: Date.parse("2025-07-03T17:00:00.000Z") });
  assert.equal(xnasSession("2007-03-09")?.closeAt, Date.parse("2007-03-09T21:00:00.000Z"));
  assert.equal(xnasSession("2007-03-12")?.closeAt, Date.parse("2007-03-12T20:00:00.000Z"));
  assert.equal(xnasSession("2002-07-05")?.closeAt, Date.parse("2002-07-05T17:00:00.000Z"));
  assert.throws(() => xnasSessionsForYear(2036), /1999-2035/);
});

test("Yahoo completeness waits until 20:00 Eastern", () => {
  assert.equal(latestRequiredYahooSession(Date.parse("2025-01-07T22:00:00.000Z"))?.date, "2025-01-06");
  assert.equal(latestRequiredYahooSession(Date.parse("2025-01-08T01:00:00.000Z"))?.date, "2025-01-07");
  assert.equal(latestRequiredYahooSession(Date.parse("2025-07-07T21:00:00.000Z"))?.date, "2025-07-03");
  assert.equal(latestRequiredYahooSession(Date.parse("2025-07-08T00:00:00.000Z"))?.date, "2025-07-07");
  assert.equal(latestRequiredYahooSession(Date.parse("2025-07-04T00:00:00.000Z"))?.date, "2025-07-03");
});

test("stock weeks accept holiday-shortened sessions and reject missing or open weeks", () => {
  const thanksgiving = [candle("2025-11-24", 10, 12, 9, 11, 10), candle("2025-11-25", 11, 14, 10, 13, 20), candle("2025-11-26", 13, 15, 12, 14, 30), candle("2025-11-28", 14, 16, 8, 9, 40)];
  assert.deepEqual(aggregateStockWeeks(thanksgiving, Date.parse("2025-11-28T19:00:00.000Z")), [{ time: Date.parse("2025-11-24T00:00:00.000Z"), open: 10, high: 16, low: 8, close: 9, volume: 100, complete: true }]);
  assert.deepEqual(aggregateStockWeeks(thanksgiving.slice(1), Date.parse("2025-11-28T19:00:00.000Z")), []);
  assert.deepEqual(aggregateStockWeeks([candle("2025-12-01", 1, 2, 1, 2)], Date.parse("2025-12-02T22:00:00.000Z")), []);
  assert.equal(xnasSessionsBetween("2025-11-24", "2025-11-28").length, 4);
});

test("Yahoo normalization uses split-adjusted OHLC and reports quality issues", () => {
  const normalized = normalizeYahooHistory(yahooBody([
    { date: "2025-01-06", open: 20, high: 22, low: 19, close: 21, volume: 100 },
    { date: "2025-01-08", open: 22, high: 24, low: 21, close: 23, volume: 102 },
    { date: "2025-01-09", open: 23, high: 25, low: 22, close: 24, volume: 103 },
    { date: "2025-01-11", open: 23, high: 25, low: 22, close: 24, volume: 103 },
    { date: "2025-01-10", open: 23, high: 22, low: 21, close: 24, volume: 103 },
    { date: "2025-01-13", open: null, high: 25, low: 23, close: 24, volume: 103 },
  ], { split: { date: Date.parse("2020-08-31") / 1000, numerator: 5, denominator: 1, splitRatio: "5:1" } }), Date.parse("2025-01-14T22:00:00.000Z"));
  assert.deepEqual(normalized.quality, { gaps: 1, duplicates: 0, malformed: 2, unexpectedSessions: 2 });
  assert.deepEqual(normalized.candles, [candle("2025-01-06", 20, 22, 19, 21, 100), candle("2025-01-08", 22, 24, 21, 23, 102)]);
  assert.match(normalized.splitSignature, /5:1/);
});

test("Yahoo relay is keyless, whitelists symbols, and returns provenance", async () => {
  let observedUrl = "";
  let observedAuthorization = "";
  const fetchStub = async (input: string | URL | Request, init?: RequestInit) => {
    observedUrl = String(input);
    observedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    return Response.json(yahooBody([
      { date: "2010-06-29", open: 20, high: 22, low: 19, close: 21, volume: 100 },
      { date: "2010-06-30", open: 21, high: 23, low: 20, close: 22, volume: 101 },
    ]));
  };
  const response = await handleYahooStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=tsla"), fetchStub, Date.parse("2010-06-30T22:00:00.000Z"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(observedAuthorization, "");
  assert.match(observedUrl, /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/TSLA/);
  assert.doesNotMatch(observedUrl, /token|apikey|authorization/i);
  const body = await response.json() as StockHistoryResponse;
  assert.equal(body.stock.id, "tsla");
  assert.deepEqual(body.provider, { id: "yahoo", label: "Yahoo Finance" });
  assert.equal(body.adjustment, "split-adjusted");
  assert.equal(body.candles.length, 2);
  let calls = 0;
  const unsupported = await handleYahooStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=AAPL"), async () => { calls++; return Response.json({}); });
  assert.equal(unsupported.status, 400);
  assert.equal(calls, 0);
});

test("production stock API returns the stored D1 snapshot without provider credentials", async () => {
  const rows = [candle("2010-06-29", 20, 22, 19, 21, 100), candle("2010-06-30", 21, 23, 20, 22, 101)];
  const database = {
    prepare(query: string) {
      const statement: D1PreparedStatement = {
        bind() { return statement; },
        async first<T>() { return query.includes("provider_snapshots") ? { retrieved_at: "2010-07-01T01:00:00.000Z", last_candle: rows.at(-1)!.time, candle_count: rows.length } as T : null; },
        async all<T>() { return { results: rows.map(row => ({ ...row, complete: 1 })) as T[], success: true }; },
        async run() { return { results: [], success: true }; },
      };
      return statement;
    },
    async batch() { return []; },
  };
  const response = await storedStockHistory(new Request("https://example.test/api/v1/stocks/history?symbol=TSLA"), { REGIME_DB: database } as CloudflareEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json() as StockHistoryResponse;
  assert.equal(body.provider.id, "yahoo");
  assert.equal(body.requestedStart, "2010-06-29");
  assert.deepEqual(body.candles, rows);
});

test("Yahoo relay validates incremental dates and rejects partial history", async () => {
  let observedUrl = "";
  const fetchStub = async (input: string | URL | Request) => {
    observedUrl = String(input);
    return Response.json(yahooBody([{ date: "2010-06-30", open: 20, high: 22, low: 19, close: 21 }, { date: "2010-07-01", open: 21, high: 23, low: 20, close: 22 }]));
  };
  const now = Date.parse("2010-07-02T01:00:00.000Z");
  const response = await handleYahooStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=TSLA&startDate=2010-06-30"), fetchStub, now);
  assert.equal(response.status, 200);
  assert.match(observedUrl, /period1=/);
  assert.equal((await response.json() as StockHistoryResponse).requestedStart, "2010-06-30");
  for (const startDate of ["2010-06-28", "not-a-date", "2010-07-02"]) assert.equal((await handleYahooStockHistoryRequest(new Request(`https://example.test/api/v1/stocks/history?symbol=TSLA&startDate=${startDate}`), fetchStub, now)).status, 400);
  const partial = await handleYahooStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=TSLA"), async () => Response.json(yahooBody([{ date: "2010-06-29", open: 20, high: 22, low: 19, close: 21 }, { date: "2010-07-01", open: 21, high: 23, low: 20, close: 22 }])), Date.parse("2010-07-01T22:00:00.000Z"));
  assert.equal(partial.status, 502);
  assert.deepEqual(await partial.json(), { error: "Yahoo Finance history failed exchange-session quality checks" });
});

test("incremental browser history reuses unchanged candles and detects rebases", () => {
  const cached = stockResponse(["2010-06-29", "2010-06-30", "2010-07-01", "2010-07-02"], "2010-06-29", "2010-07-02");
  const incoming = stockResponse(["2010-07-01", "2010-07-02", "2010-07-06", "2010-07-07"], "2010-07-01", "2010-07-07", { "2010-07-01": cached.candles[2], "2010-07-02": cached.candles[3] });
  const merged = mergeIncrementalStockHistory(cached, incoming);
  assert.equal(merged.requiresFullRefresh, false);
  assert.deepEqual(merged.response?.candles.map(row => xnasDateKey(row.time)), ["2010-06-29", "2010-06-30", "2010-07-01", "2010-07-02", "2010-07-06", "2010-07-07"]);
  const rebased = stockResponse(["2010-07-01", "2010-07-02", "2010-07-06", "2010-07-07"], "2010-07-01", "2010-07-07", { "2010-07-01": { ...cached.candles[2], close: cached.candles[2].close * 0.99 }, "2010-07-02": cached.candles[3] });
  assert.equal(mergeIncrementalStockHistory(cached, rebased).reason, "adjustment-rebase");
  assert.equal(stockIncrementalStartDate("TSLA", cached.candles), "2010-06-29");
  assert.equal(stockIncrementalStartDate("TSLA", [candle("2025-01-10", 1, 1, 1, 1)]), "2023-12-07");
});

test("Yahoo failures are sanitized and current-session rows are excluded", async () => {
  for (const item of [{ upstream: 429, expected: 429, message: "Yahoo Finance request limit reached; try again later" }, { upstream: 503, expected: 502, message: "Yahoo Finance history is temporarily unavailable" }, { upstream: 302, expected: 502, message: "Yahoo Finance history is temporarily unavailable" }]) {
    const response = await handleYahooStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=NVDA"), async () => new Response("secret diagnostic", { status: item.upstream }));
    assert.equal(response.status, item.expected);
    assert.deepEqual(await response.json(), { error: item.message });
  }
  const earlyClose = yahooBody([{ date: "2025-07-03", open: 20, high: 22, low: 19, close: 21 }]);
  assert.equal(normalizeYahooHistory(earlyClose, Date.parse("2025-07-03T16:59:59.999Z")).candles.length, 0);
  assert.equal(normalizeYahooHistory(earlyClose, Date.parse("2025-07-03T17:00:00.000Z")).candles.length, 1);
  assert.equal(Date.parse("2025-01-06T00:00:00.000Z") + DAY, Date.parse("2025-01-07T00:00:00.000Z"));
});
