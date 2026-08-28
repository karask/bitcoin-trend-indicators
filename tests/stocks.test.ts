import assert from "node:assert/strict";
import test from "node:test";
import { aggregateStockWeeks, isStockId, isStockSymbol, STOCKS, stockDefinition, type StockHistoryResponse } from "../lib/stocks.ts";
import { mergeIncrementalStockHistory, stockIncrementalStartDate } from "../lib/stock-cache.ts";
import { handleStockHistoryRequest, latestRequiredTiingoSession, normalizeTiingoHistory } from "../lib/tiingo.ts";
import { isXnasSessionDate, xnasDateKey, xnasSession, xnasSessionsBetween, xnasSessionsForYear } from "../lib/xnas-calendar.ts";
import type { Candle } from "../lib/regimes.ts";

const DAY = 86_400_000;

function candle(date: string, open: number, high: number, low: number, close: number, volume = 1): Candle {
  return { time: Date.parse(`${date}T00:00:00.000Z`), open, high, low, close, volume, complete: true };
}

function tiingoRow(date: string, open: number, high: number, low: number, close: number, volume = 1) {
  return { date: `${date}T00:00:00.000Z`, adjOpen: open, adjHigh: high, adjLow: low, adjClose: close, adjVolume: volume };
}

function stockResponse(
  dates: string[],
  requestedStart: string,
  requiredThrough: string,
  overrides: Partial<Record<string, Partial<Candle>>> = {},
): StockHistoryResponse {
  const stock = stockDefinition("TSLA");
  return {
    stock,
    provider: { id: "tiingo", label: "Tiingo" },
    providerUrl: "https://www.tiingo.com/documentation/end-of-day",
    exchange: "NASDAQ",
    timeframe: "1d",
    requestedStart,
    requiredThrough,
    retrievedAt: "2010-07-08T01:00:00.000Z",
    adjustment: "split-and-dividend-adjusted",
    candles: dates.map((date, index) => ({ ...candle(date, 20 + index, 22 + index, 19 + index, 21 + index, 100 + index), ...overrides[date] })),
    quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 },
  };
}

test("stock definitions remain separate, complete, and type guarded", () => {
  assert.deepEqual(STOCKS.map(stock => stock.id), ["tsla", "googl", "nvda"]);
  assert.deepEqual(STOCKS.map(stock => stock.symbol), ["TSLA", "GOOGL", "NVDA"]);
  assert.ok(STOCKS.every(stock => stock.exchange === "NASDAQ" && stock.currency === "USD" && stock.provider === "tiingo" && stock.calendar === "XNAS"));
  assert.ok(STOCKS.every(stock => stock.ticker === stock.symbol && stock.company === stock.label));
  assert.equal(stockDefinition("googl").label, "Alphabet Class A");
  assert.equal(stockDefinition("NVDA").historyStart, "1999-01-22");
  assert.equal(isStockId("tsla"), true);
  assert.equal(isStockId("btc"), false);
  assert.equal(isStockSymbol("TSLA"), true);
  assert.equal(isStockSymbol("tsla"), false);
});

test("XNAS calendar covers 1999-2035 recurring holidays and exceptional closures", () => {
  assert.ok(xnasSessionsForYear(1999).length > 240);
  assert.ok(xnasSessionsForYear(2035).length > 240);
  assert.equal(isXnasSessionDate("2025-01-20"), false); // MLK Day
  assert.equal(isXnasSessionDate("2025-04-18"), false); // Good Friday
  assert.equal(isXnasSessionDate("2025-06-19"), false); // Juneteenth
  assert.equal(isXnasSessionDate("2025-01-09"), false); // Carter mourning closure
  assert.equal(isXnasSessionDate("2001-09-12"), false); // 9/11 closure window
  assert.equal(isXnasSessionDate("2012-10-29"), false); // Hurricane Sandy
  assert.equal(isXnasSessionDate("2025-01-21"), true);
  assert.throws(() => xnasSessionsForYear(2036), /1999-2035/);
});

test("XNAS close instants honor early closes and US daylight-saving changes", () => {
  assert.deepEqual(xnasSession("2025-07-03"), {
    date: "2025-07-03",
    earlyClose: true,
    closeHourEastern: 13,
    closeAt: Date.parse("2025-07-03T17:00:00.000Z"),
  });
  assert.equal(xnasSession("2026-07-03"), null); // Independence Day observed
  assert.equal(xnasSession("2026-12-24")?.closeAt, Date.parse("2026-12-24T18:00:00.000Z"));
  assert.equal(xnasSession("2007-03-09")?.closeAt, Date.parse("2007-03-09T21:00:00.000Z"));
  assert.equal(xnasSession("2007-03-12")?.closeAt, Date.parse("2007-03-12T20:00:00.000Z"));
  assert.equal(xnasSession("1999-12-31")?.earlyClose, true);
  assert.equal(xnasSession("2002-07-03")?.earlyClose, false);
  assert.equal(xnasSession("2002-07-05")?.closeAt, Date.parse("2002-07-05T17:00:00.000Z"));
  assert.equal(xnasSession("2003-12-26")?.closeAt, Date.parse("2003-12-26T18:00:00.000Z"));
});

test("Tiingo completeness waits until 20:00 Eastern in standard and daylight time", () => {
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-01-07T22:00:00.000Z"))?.date, "2025-01-06"); // 17:00 EST
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-01-08T00:59:59.999Z"))?.date, "2025-01-06");
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-01-08T01:00:00.000Z"))?.date, "2025-01-07"); // 20:00 EST
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-07-07T21:00:00.000Z"))?.date, "2025-07-03"); // 17:00 EDT; July 4 closed
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-07-07T23:59:59.999Z"))?.date, "2025-07-03");
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-07-08T00:00:00.000Z"))?.date, "2025-07-07"); // 20:00 EDT
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-07-03T21:00:00.000Z"))?.date, "2025-07-02"); // early-close row remains optional
  assert.equal(latestRequiredTiingoSession(Date.parse("2025-07-04T00:00:00.000Z"))?.date, "2025-07-03");
});

test("stock weeks accept holiday-shortened sessions and reject missing or open weeks", () => {
  const thanksgiving = [
    candle("2025-11-24", 10, 12, 9, 11, 10),
    candle("2025-11-25", 11, 14, 10, 13, 20),
    candle("2025-11-26", 13, 15, 12, 14, 30),
    candle("2025-11-28", 14, 16, 8, 9, 40),
  ];
  const complete = aggregateStockWeeks(thanksgiving, Date.parse("2025-11-28T19:00:00.000Z"));
  assert.deepEqual(complete, [{ time: Date.parse("2025-11-24T00:00:00.000Z"), open: 10, high: 16, low: 8, close: 9, volume: 100, complete: true }]);
  assert.deepEqual(aggregateStockWeeks(thanksgiving.slice(1), Date.parse("2025-11-28T19:00:00.000Z")), []);

  const openWeek = [candle("2025-12-01", 1, 2, 1, 2), candle("2025-12-02", 2, 3, 2, 3)];
  assert.deepEqual(aggregateStockWeeks(openWeek, Date.parse("2025-12-02T22:00:00.000Z")), []);
  assert.equal(xnasSessionsBetween("2025-11-24", "2025-11-28").length, 4);
});

test("Tiingo normalization uses adjusted OHLCV and reports data-quality issues", () => {
  const normalized = normalizeTiingoHistory([
    { ...tiingoRow("2025-01-06", 20, 22, 19, 21, 100), open: 200, high: 220, low: 190, close: 210, volume: 10 },
    tiingoRow("2025-01-06", 21, 23, 20, 22, 101), // duplicate; latest wins
    tiingoRow("2025-01-08", 22, 24, 21, 23, 102), // Tuesday gap
    tiingoRow("2025-01-09", 23, 25, 22, 24, 103), // exceptional closure
    tiingoRow("2025-01-11", 23, 25, 22, 24, 103), // weekend
    tiingoRow("2025-01-10", 23, 22, 21, 24, 103), // malformed high
    { ...tiingoRow("2025-01-13", 24, 25, 23, 24, 103), adjOpen: null },
  ], Date.parse("2025-01-14T22:00:00.000Z"));
  assert.deepEqual(normalized.quality, { gaps: 1, duplicates: 1, malformed: 2, unexpectedSessions: 2 });
  assert.equal(normalized.candles.length, 2);
  assert.deepEqual(normalized.candles[0], candle("2025-01-06", 21, 23, 20, 22, 101));
});

test("adjusted OHLCV stays continuous across known TSLA, GOOGL, and NVDA splits", () => {
  const cases = [
    {
      symbol: "TSLA",
      asOf: "2020-09-01T22:00:00.000Z",
      rows: [
        { ...tiingoRow("2020-08-28", 460, 470, 455, 462, 100), open: 2300, high: 2350, low: 2275, close: 2310 },
        { ...tiingoRow("2020-08-31", 444, 500, 440, 498, 500), open: 444, high: 500, low: 440, close: 498 },
      ],
    },
    {
      symbol: "GOOGL",
      asOf: "2022-07-19T22:00:00.000Z",
      rows: [
        { ...tiingoRow("2022-07-15", 111, 114, 110, 112.7, 100), open: 2220, high: 2280, low: 2200, close: 2254 },
        { ...tiingoRow("2022-07-18", 112, 113.6, 109, 110.9, 2_000), open: 112, high: 113.6, low: 109, close: 110.9 },
      ],
    },
    {
      symbol: "NVDA",
      asOf: "2024-06-11T22:00:00.000Z",
      rows: [
        { ...tiingoRow("2024-06-07", 120.8, 121, 118, 120, 100), open: 1208, high: 1210, low: 1180, close: 1200 },
        { ...tiingoRow("2024-06-10", 120, 123, 117, 121.8, 1_000), open: 120, high: 123, low: 117, close: 121.8 },
      ],
    },
  ] as const;

  for (const item of cases) {
    const normalized = normalizeTiingoHistory(item.rows, Date.parse(item.asOf));
    assert.equal(normalized.candles.length, 2, `${item.symbol} fixture should contain both split-adjacent sessions`);
    const adjustedMove = Math.abs(normalized.candles[1].close / normalized.candles[0].close - 1);
    const rawMove = Math.abs(item.rows[1].close / item.rows[0].close - 1);
    assert.ok(adjustedMove < 0.15, `${item.symbol} adjusted prices should remain continuous`);
    assert.ok(rawMove > 0.7, `${item.symbol} raw prices should expose the split discontinuity in this fixture`);
    assert.equal(normalized.candles[0].close, item.rows[0].adjClose);
  }
});

test("stock history relay requires a token and whitelists symbols before fetching", async () => {
  let calls = 0;
  const fetchStub = async () => {
    calls++;
    return Response.json([]);
  };
  const missing = await handleStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=TSLA"), fetchStub);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await missing.json(), { error: "Tiingo API token is required" });
  const unsupported = await handleStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=AAPL", { headers: { Authorization: "Token test-token" } }), fetchStub);
  assert.equal(unsupported.status, 400);
  assert.deepEqual(await unsupported.json(), { error: "Unsupported stock symbol" });
  assert.equal(calls, 0);
});

test("stock history relay forwards the token only in Authorization and returns provenance", async () => {
  let observedUrl = "";
  let observedAuthorization = "";
  let observedRedirect: RequestRedirect | undefined;
  const fetchStub = async (input: string | URL | Request, init?: RequestInit) => {
    observedUrl = String(input);
    observedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    observedRedirect = init?.redirect;
    return Response.json([
      tiingoRow("2010-06-29", 20, 22, 19, 21, 100),
      tiingoRow("2010-06-30", 21, 23, 20, 22, 101),
    ]);
  };
  const now = Date.parse("2010-06-30T22:00:00.000Z");
  const response = await handleStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=tsla", { headers: { Authorization: "Token test-token" } }), fetchStub, now);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(observedAuthorization, "Token test-token");
  assert.equal(observedRedirect, "manual");
  assert.doesNotMatch(observedUrl, /test-token/);
  assert.match(observedUrl, /\/TSLA\/prices/);
  assert.match(observedUrl, /startDate=2010-06-29/);
  const body = await response.json() as StockHistoryResponse;
  assert.equal(body.stock.id, "tsla");
  assert.deepEqual(body.provider, { id: "tiingo", label: "Tiingo" });
  assert.equal(body.providerUrl, "https://www.tiingo.com/documentation/end-of-day");
  assert.equal(body.exchange, "NASDAQ");
  assert.equal(body.adjustment, "split-and-dividend-adjusted");
  assert.equal(body.requestedStart, "2010-06-29");
  assert.equal(body.requiredThrough, "2010-06-29");
  assert.equal(body.retrievedAt, new Date(now).toISOString());
  assert.equal(body.candles.length, 2);
});

test("stock history relay validates and forwards an incremental start date", async () => {
  let observedUrl = "";
  let calls = 0;
  const fetchStub = async (input: string | URL | Request) => {
    calls++;
    observedUrl = String(input);
    return Response.json([
      tiingoRow("2010-06-30", 20, 22, 19, 21, 100),
      tiingoRow("2010-07-01", 21, 23, 20, 22, 101),
    ]);
  };
  const now = Date.parse("2010-07-02T01:00:00.000Z"); // July 1 at 21:00 Eastern
  const request = new Request("https://example.test/api/v1/stocks/history?symbol=TSLA&startDate=2010-06-30", { headers: { Authorization: "Token test-token" } });
  const response = await handleStockHistoryRequest(request, fetchStub, now);
  assert.equal(response.status, 200);
  assert.match(observedUrl, /startDate=2010-06-30/);
  const body = await response.json() as StockHistoryResponse;
  assert.equal(body.requestedStart, "2010-06-30");
  assert.equal(body.requiredThrough, "2010-07-01");
  assert.equal(body.candles.length, 2);

  for (const startDate of ["2010-06-28", "not-a-date", "2010-07-02"]) {
    const invalid = await handleStockHistoryRequest(new Request(`https://example.test/api/v1/stocks/history?symbol=TSLA&startDate=${startDate}`, { headers: { Authorization: "Token test-token" } }), fetchStub, now);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: "Unsupported stock history start date" });
  }
  assert.equal(calls, 1);
});

test("incremental stock history reuses unchanged candles and detects adjusted-price rebases", () => {
  const cached = stockResponse(
    ["2010-06-29", "2010-06-30", "2010-07-01", "2010-07-02"],
    "2010-06-29",
    "2010-07-02",
  );
  const incoming = stockResponse(
    ["2010-07-01", "2010-07-02", "2010-07-06", "2010-07-07"],
    "2010-07-01",
    "2010-07-07",
    {
      "2010-07-01": cached.candles[2],
      "2010-07-02": cached.candles[3],
    },
  );
  const merged = mergeIncrementalStockHistory(cached, incoming);
  assert.equal(merged.requiresFullRefresh, false);
  assert.equal(merged.reason, "none");
  assert.equal(merged.response?.requestedStart, "2010-06-29");
  assert.equal(merged.response?.requiredThrough, "2010-07-07");
  assert.deepEqual(merged.response?.candles.map(row => xnasDateKey(row.time)), ["2010-06-29", "2010-06-30", "2010-07-01", "2010-07-02", "2010-07-06", "2010-07-07"]);

  const rebased = stockResponse(
    ["2010-07-01", "2010-07-02", "2010-07-06", "2010-07-07"],
    "2010-07-01",
    "2010-07-07",
    {
      "2010-07-01": { ...cached.candles[2], close: cached.candles[2].close * 0.99 },
      "2010-07-02": cached.candles[3],
    },
  );
  const rebaseResult = mergeIncrementalStockHistory(cached, rebased);
  assert.equal(rebaseResult.requiresFullRefresh, true);
  assert.equal(rebaseResult.reason, "adjustment-rebase");
  assert.equal(rebaseResult.response, null);

  assert.equal(stockIncrementalStartDate("TSLA", cached.candles), "2010-06-29");
  assert.equal(stockIncrementalStartDate("TSLA", [candle("2025-01-10", 1, 1, 1, 1)]), "2023-12-07");
});

test("stock history relay sanitizes Tiingo authentication, rate, and server errors", async () => {
  const cases = [
    { upstream: 401, expected: 401, message: "Tiingo rejected the API token" },
    { upstream: 429, expected: 429, message: "Tiingo request limit reached; try again later" },
    { upstream: 503, expected: 502, message: "Tiingo history is temporarily unavailable" },
    { upstream: 302, expected: 502, message: "Tiingo history is temporarily unavailable" },
  ];
  for (const item of cases) {
    const fetchStub = async () => new Response("upstream secret diagnostic", { status: item.upstream });
    const response = await handleStockHistoryRequest(new Request("https://example.test/api/v1/stocks/history?symbol=NVDA", { headers: { Authorization: "Token test-token" } }), fetchStub);
    assert.equal(response.status, item.expected);
    assert.deepEqual(await response.json(), { error: item.message });
    if (item.upstream === 302) assert.equal(response.headers.get("X-Stock-Error"), "tiingo_redirect");
  }
});

test("stock history relay rejects partial or malformed exchange-session history", async () => {
  const fetchStub = async () => Response.json([
    tiingoRow("2010-06-29", 20, 22, 19, 21, 100),
    tiingoRow("2010-07-01", 21, 23, 20, 22, 101),
  ]);
  const response = await handleStockHistoryRequest(
    new Request("https://example.test/api/v1/stocks/history?symbol=TSLA", { headers: { Authorization: "Token test-token" } }),
    fetchStub,
    Date.parse("2010-07-01T22:00:00.000Z"),
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Tiingo history failed exchange-session quality checks" });
});

test("stock history relay does not require today's EOD bar before Tiingo's correction cutoff", async () => {
  const fetchStub = async () => Response.json([tiingoRow("2010-06-29", 20, 22, 19, 21, 100)]);
  const request = new Request("https://example.test/api/v1/stocks/history?symbol=TSLA", { headers: { Authorization: "Token test-token" } });
  const atSeventeenEastern = await handleStockHistoryRequest(request, fetchStub, Date.parse("2010-06-30T21:00:00.000Z"));
  assert.equal(atSeventeenEastern.status, 200);
  const atTwentyEastern = await handleStockHistoryRequest(request, fetchStub, Date.parse("2010-07-01T00:00:00.000Z"));
  assert.equal(atTwentyEastern.status, 502);
  assert.deepEqual(await atTwentyEastern.json(), { error: "Tiingo history failed exchange-session quality checks" });
});

test("current-session Tiingo rows are excluded until the XNAS close", () => {
  const row = tiingoRow("2025-07-03", 20, 22, 19, 21, 100); // 13:00 ET early close
  assert.equal(normalizeTiingoHistory([row], Date.parse("2025-07-03T16:59:59.999Z")).candles.length, 0);
  assert.equal(normalizeTiingoHistory([row], Date.parse("2025-07-03T17:00:00.000Z")).candles.length, 1);
  assert.equal(Date.parse("2025-01-06T00:00:00.000Z") + DAY, Date.parse("2025-01-07T00:00:00.000Z"));
});
