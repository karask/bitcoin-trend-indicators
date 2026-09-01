import type { Candle } from "./regimes.ts";
import {
  STOCK_DATA_ADJUSTMENT,
  STOCK_DATA_PROVIDER,
  STOCK_DATA_PROVIDER_URL,
  isStockSymbol,
  stockDefinition,
  type StockHistoryQuality,
  type StockHistoryResponse,
  type StockQuote,
  type StockSymbol,
} from "./stocks.ts";
import { XNAS_CALENDAR_START_YEAR, isXnasSessionComplete, isXnasSessionDate, latestCompletedXnasSession, xnasDateEpoch, xnasDateKey, xnasSessionsBetween, type XnasSession } from "./xnas-calendar.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface YahooChartResult {
  meta?: { currency?: unknown; exchangeName?: unknown; symbol?: unknown; regularMarketPrice?: unknown; chartPreviousClose?: unknown; previousClose?: unknown; regularMarketTime?: unknown; marketState?: unknown };
  timestamp?: unknown;
  indicators?: {
    quote?: Array<{ open?: unknown; high?: unknown; low?: unknown; close?: unknown; volume?: unknown }>;
  };
  events?: { splits?: Record<string, { date?: unknown; numerator?: unknown; denominator?: unknown; splitRatio?: unknown }> };
}

export interface NormalizedYahooHistory {
  candles: Candle[];
  quality: StockHistoryQuality;
  splitSignature: string;
}

export class StockApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = "stock_api_error") {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "StockApiError";
  }
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resultFromBody(body: unknown): YahooChartResult {
  if (!body || typeof body !== "object") throw new StockApiError(502, "Yahoo Finance returned an invalid history payload");
  const chart = (body as { chart?: { result?: unknown; error?: { description?: unknown } | null } }).chart;
  if (chart?.error) throw new StockApiError(502, "Yahoo Finance history is temporarily unavailable", "yahoo_chart_error");
  if (!Array.isArray(chart?.result) || !chart.result[0] || typeof chart.result[0] !== "object") {
    throw new StockApiError(502, "Yahoo Finance returned no completed stock history", "yahoo_empty");
  }
  return chart.result[0] as YahooChartResult;
}

export function normalizeYahooHistory(body: unknown, asOfMs: number, minimumDate?: string): NormalizedYahooHistory {
  const result = resultFromBody(body);
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];
  const found = new Map<string, Candle>();
  let duplicates = 0;
  let malformed = 0;
  let unexpectedSessions = 0;

  for (let index = 0; index < timestamps.length; index++) {
    const epochSeconds = finite(timestamps[index]);
    if (epochSeconds == null) { malformed++; continue; }
    const date = new Date(epochSeconds * 1000).toISOString().slice(0, 10);
    if (minimumDate && date < minimumDate) continue;
    if (!isXnasSessionDate(date)) { unexpectedSessions++; continue; }
    if (!isXnasSessionComplete(date, asOfMs)) continue;
    const open = finite(opens[index]);
    const high = finite(highs[index]);
    const low = finite(lows[index]);
    const close = finite(closes[index]);
    const volume = finite(volumes[index]) ?? 0;
    if (open == null || high == null || low == null || close == null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0 || high < Math.max(open, close) || low > Math.min(open, close) || low > high) {
      malformed++;
      continue;
    }
    if (found.has(date)) duplicates++;
    // Yahoo's chart OHLC is split-adjusted. We intentionally do not apply the
    // dividend-adjusted close factor because the research benchmark excludes dividends.
    found.set(date, { time: xnasDateEpoch(date)!, open, high, low, close, volume, complete: true });
  }

  const candles = [...found.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, row]) => row);
  let gaps = 0;
  if (candles.length > 1) {
    const expected = xnasSessionsBetween(xnasDateKey(candles[0].time), xnasDateKey(candles.at(-1)!.time));
    gaps = expected.reduce((count, session) => count + (found.has(session.date) ? 0 : 1), 0);
  }
  const splits = Object.values(result.events?.splits ?? {}).map(event => ({
    date: finite(event.date) ?? 0,
    numerator: finite(event.numerator) ?? 0,
    denominator: finite(event.denominator) ?? 0,
    ratio: typeof event.splitRatio === "string" ? event.splitRatio : "",
  })).sort((left, right) => left.date - right.date);
  return { candles, quality: { gaps, duplicates, malformed, unexpectedSessions }, splitSignature: JSON.stringify(splits) };
}

export function stockSymbolFromRequest(request: Request): StockSymbol {
  const requested = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!isStockSymbol(requested)) throw new StockApiError(400, "Unsupported stock symbol");
  return requested;
}

export function stockStartDateFromRequest(request: Request, symbol: StockSymbol, latestDate: string): string {
  const stock = stockDefinition(symbol);
  const requested = new URL(request.url).searchParams.get("startDate") ?? stock.historyStart;
  if (xnasDateEpoch(requested) == null || requested < stock.historyStart || requested > latestDate) {
    throw new StockApiError(400, "Unsupported stock history start date");
  }
  return requested;
}

const YAHOO_READY_HOUR_EASTERN = 20;

function readyAt(session: XnasSession): number {
  return session.closeAt + (YAHOO_READY_HOUR_EASTERN - session.closeHourEastern) * 60 * 60 * 1000;
}

export function latestRequiredYahooSession(asOfMs: number): XnasSession | null {
  const exchangeLatest = latestCompletedXnasSession(asOfMs);
  if (!exchangeLatest) return null;
  if (readyAt(exchangeLatest) <= asOfMs) return exchangeLatest;
  const start = xnasDateKey(Math.max(exchangeLatest.closeAt - 14 * 86_400_000, Date.UTC(XNAS_CALENDAR_START_YEAR, 0, 1)));
  return xnasSessionsBetween(start, exchangeLatest.date).filter(session => readyAt(session) <= asOfMs).at(-1) ?? null;
}

export async function fetchYahooStockHistory(
  symbol: StockSymbol,
  fetchImpl: FetchLike = fetch,
  asOfMs = Date.now(),
  requestedStart?: string,
): Promise<StockHistoryResponse & { splitSignature: string }> {
  const stock = stockDefinition(symbol);
  const latestExpected = latestRequiredYahooSession(asOfMs);
  if (!latestExpected) throw new StockApiError(502, "Yahoo Finance history is outside the supported XNAS calendar");
  const startDate = requestedStart ?? stock.historyStart;
  if (xnasDateEpoch(startDate) == null || startDate < stock.historyStart || startDate > latestExpected.date) throw new StockApiError(400, "Unsupported stock history start date");
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.ticker}`);
  url.searchParams.set("period1", String(Math.floor(xnasDateEpoch(startDate)! / 1000)));
  url.searchParams.set("period2", String(Math.floor(asOfMs / 1000) + 86_400));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "div,splits");
  url.searchParams.set("includeAdjustedClose", "true");
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "Regime-Lab/1.0" }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    const code = error instanceof Error && error.name === "TimeoutError" ? "yahoo_timeout" : "yahoo_fetch_failed";
    throw new StockApiError(502, "Yahoo Finance history is temporarily unavailable", code);
  }
  if (response.status >= 300 && response.status < 400) throw new StockApiError(502, "Yahoo Finance history is temporarily unavailable", "yahoo_redirect");
  if (response.status === 429) throw new StockApiError(429, "Yahoo Finance request limit reached; try again later", "yahoo_rate_limit");
  if (!response.ok) throw new StockApiError(502, "Yahoo Finance history is temporarily unavailable", `yahoo_status_${response.status}`);
  let body: unknown;
  try { body = await response.json(); } catch { throw new StockApiError(502, "Yahoo Finance returned an invalid history payload"); }
  const normalized = normalizeYahooHistory(body, asOfMs, startDate);
  if (!normalized.candles.length) throw new StockApiError(502, "Yahoo Finance returned no completed stock history");
  const dates = new Set(normalized.candles.map(row => xnasDateKey(row.time)));
  normalized.quality.gaps = xnasSessionsBetween(startDate, latestExpected.date).reduce((count, session) => count + (dates.has(session.date) ? 0 : 1), 0);
  if (Object.values(normalized.quality).some(count => count > 0)) throw new StockApiError(502, "Yahoo Finance history failed exchange-session quality checks", "yahoo_quality");
  return {
    stock,
    provider: STOCK_DATA_PROVIDER,
    providerUrl: STOCK_DATA_PROVIDER_URL,
    exchange: stock.exchange,
    timeframe: "1d",
    requestedStart: startDate,
    requiredThrough: latestExpected.date,
    retrievedAt: new Date(asOfMs).toISOString(),
    adjustment: STOCK_DATA_ADJUSTMENT,
    candles: normalized.candles,
    quality: normalized.quality,
    splitSignature: normalized.splitSignature,
  };
}

function privateJson(body: unknown, status = 200, errorCode?: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", Pragma: "no-cache", "X-Content-Type-Options": "nosniff", ...(errorCode ? { "X-Stock-Error": errorCode } : {}) } });
}

export async function handleYahooStockHistoryRequest(request: Request, fetchImpl: FetchLike = fetch, asOfMs = Date.now()): Promise<Response> {
  try {
    const symbol = stockSymbolFromRequest(request);
    const latest = latestRequiredYahooSession(asOfMs);
    if (!latest) throw new StockApiError(502, "Yahoo Finance history is outside the supported XNAS calendar");
    const startDate = stockStartDateFromRequest(request, symbol, latest.date);
    const result = await fetchYahooStockHistory(symbol, fetchImpl, asOfMs, startDate);
    const history: StockHistoryResponse = {
      stock: result.stock,
      provider: result.provider,
      providerUrl: result.providerUrl,
      exchange: result.exchange,
      timeframe: result.timeframe,
      requestedStart: result.requestedStart,
      requiredThrough: result.requiredThrough,
      retrievedAt: result.retrievedAt,
      adjustment: result.adjustment,
      candles: result.candles,
      quality: result.quality,
    };
    return privateJson(history);
  } catch (error) {
    const stockError = error instanceof StockApiError ? error : new StockApiError(500, "Stock history is unavailable");
    return privateJson({ error: stockError.message }, stockError.status, stockError.code);
  }
}

export async function fetchYahooStockQuote(symbol: StockSymbol, fetchImpl: FetchLike = fetch, asOfMs = Date.now()): Promise<StockQuote> {
  const stock = stockDefinition(symbol);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.ticker}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "Regime-Lab/1.0" }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new StockApiError(502, "Yahoo Finance quote is temporarily unavailable", "yahoo_quote_fetch_failed");
  }
  if (response.status === 429) throw new StockApiError(429, "Yahoo Finance request limit reached; try again later", "yahoo_quote_rate_limit");
  if (!response.ok) throw new StockApiError(502, "Yahoo Finance quote is temporarily unavailable", `yahoo_quote_status_${response.status}`);
  let body: unknown;
  try { body = await response.json(); } catch { throw new StockApiError(502, "Yahoo Finance returned an invalid quote payload"); }
  const meta = resultFromBody(body).meta ?? {};
  const price = finite(meta.regularMarketPrice);
  if (price == null || price <= 0) throw new StockApiError(502, "Yahoo Finance returned no current quote", "yahoo_quote_empty");
  const previousClose = finite(meta.chartPreviousClose ?? meta.previousClose);
  const quoteEpoch = finite(meta.regularMarketTime);
  return {
    stock,
    provider: STOCK_DATA_PROVIDER,
    price,
    previousClose: previousClose != null && previousClose > 0 ? previousClose : null,
    currency: "USD",
    marketState: typeof meta.marketState === "string" ? meta.marketState.toLowerCase() : "unknown",
    quoteTime: new Date(quoteEpoch == null ? asOfMs : quoteEpoch * 1000).toISOString(),
    retrievedAt: new Date(asOfMs).toISOString(),
  };
}

export async function handleYahooStockQuoteRequest(request: Request, fetchImpl: FetchLike = fetch, asOfMs = Date.now()): Promise<Response> {
  try {
    const symbol = stockSymbolFromRequest(request);
    return privateJson(await fetchYahooStockQuote(symbol, fetchImpl, asOfMs));
  } catch (error) {
    const stockError = error instanceof StockApiError ? error : new StockApiError(500, "Stock quote is unavailable");
    return privateJson({ error: stockError.message }, stockError.status, stockError.code);
  }
}
