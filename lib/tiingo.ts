import type { Candle } from "./regimes.ts";
import {
  STOCK_DATA_ADJUSTMENT,
  STOCK_DATA_PROVIDER,
  STOCK_DATA_PROVIDER_URL,
  isStockSymbol,
  stockDefinition,
  type StockHistoryQuality,
  type StockHistoryResponse,
  type StockSymbol,
} from "./stocks.ts";
import { XNAS_CALENDAR_START_YEAR, isXnasSessionComplete, isXnasSessionDate, latestCompletedXnasSession, xnasDateEpoch, xnasDateKey, xnasSessionsBetween, type XnasSession } from "./xnas-calendar.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface TiingoRow {
  date?: unknown;
  adjOpen?: unknown;
  adjHigh?: unknown;
  adjLow?: unknown;
  adjClose?: unknown;
  adjVolume?: unknown;
}

export interface NormalizedTiingoHistory {
  candles: Candle[];
  quality: StockHistoryQuality;
}

export class StockApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "StockApiError";
  }
}

function tiingoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value);
  if (!match || xnasDateEpoch(match[1]) == null) return null;
  return match[1];
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeTiingoHistory(body: unknown, asOfMs: number): NormalizedTiingoHistory {
  if (!Array.isArray(body)) throw new StockApiError(502, "Tiingo returned an invalid history payload");
  const found = new Map<string, Candle>();
  let duplicates = 0;
  let malformed = 0;
  let unexpectedSessions = 0;

  for (const item of body) {
    if (!item || typeof item !== "object") {
      malformed++;
      continue;
    }
    const row = item as TiingoRow;
    const date = tiingoDate(row.date);
    const open = finite(row.adjOpen);
    const high = finite(row.adjHigh);
    const low = finite(row.adjLow);
    const close = finite(row.adjClose);
    const volume = finite(row.adjVolume);
    if (date == null || open == null || high == null || low == null || close == null || volume == null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0 || high < Math.max(open, close) || low > Math.min(open, close) || low > high) {
      malformed++;
      continue;
    }
    if (!isXnasSessionDate(date)) {
      unexpectedSessions++;
      continue;
    }
    if (!isXnasSessionComplete(date, asOfMs)) continue;
    if (found.has(date)) duplicates++;
    found.set(date, { time: xnasDateEpoch(date)!, open, high, low, close, volume, complete: true });
  }

  const candles = [...found.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, candle]) => candle);
  let gaps = 0;
  if (candles.length > 1) {
    const first = xnasDateKey(candles[0].time);
    const last = xnasDateKey(candles.at(-1)!.time);
    const expected = xnasSessionsBetween(first, last);
    gaps = expected.reduce((count, session) => count + (found.has(session.date) ? 0 : 1), 0);
  }
  return { candles, quality: { gaps, duplicates, malformed, unexpectedSessions } };
}

export function stockSymbolFromRequest(request: Request): StockSymbol {
  const requested = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!isStockSymbol(requested)) throw new StockApiError(400, "Unsupported stock symbol");
  return requested;
}

export function tiingoAuthorization(request: Request): string {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!/^Token\s+\S+$/i.test(authorization)) throw new StockApiError(401, "Tiingo API token is required");
  return authorization;
}

function publicProviderError(status: number): StockApiError {
  if (status === 401 || status === 403) return new StockApiError(401, "Tiingo rejected the API token");
  if (status === 429) return new StockApiError(429, "Tiingo request limit reached; try again later");
  return new StockApiError(502, "Tiingo history is temporarily unavailable");
}

const TIINGO_EOD_READY_HOUR_EASTERN = 20;

function tiingoReadyAt(session: XnasSession): number {
  return session.closeAt + (TIINGO_EOD_READY_HOUR_EASTERN - session.closeHourEastern) * 60 * 60 * 1000;
}

/**
 * Tiingo normally publishes EOD bars after the exchange close and may correct
 * them until 20:00 Eastern. A just-closed session can be accepted if present,
 * but is not required for completeness before that provider cutoff.
 */
export function latestRequiredTiingoSession(asOfMs: number): XnasSession | null {
  const exchangeLatest = latestCompletedXnasSession(asOfMs);
  if (!exchangeLatest) return null;
  if (tiingoReadyAt(exchangeLatest) <= asOfMs) return exchangeLatest;
  const priorWindowStart = xnasDateKey(Math.max(exchangeLatest.closeAt - 14 * 86_400_000, Date.UTC(XNAS_CALENDAR_START_YEAR, 0, 1)));
  const prior = xnasSessionsBetween(priorWindowStart, exchangeLatest.date)
    .filter(session => tiingoReadyAt(session) <= asOfMs)
    .at(-1);
  return prior ?? null;
}

export async function fetchTiingoStockHistory(
  symbol: StockSymbol,
  authorization: string,
  fetchImpl: FetchLike = fetch,
  asOfMs = Date.now(),
): Promise<StockHistoryResponse> {
  const stock = stockDefinition(symbol);
  const url = new URL(`https://api.tiingo.com/tiingo/daily/${stock.ticker}/prices`);
  url.searchParams.set("startDate", stock.historyStart);
  url.searchParams.set("resampleFreq", "daily");
  url.searchParams.set("format", "json");
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new StockApiError(502, "Tiingo history is temporarily unavailable");
  }
  if (!response.ok) throw publicProviderError(response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new StockApiError(502, "Tiingo returned an invalid history payload");
  }
  const normalized = normalizeTiingoHistory(body, asOfMs);
  if (!normalized.candles.length) throw new StockApiError(502, "Tiingo returned no completed stock history");
  const latestExpected = latestRequiredTiingoSession(asOfMs);
  if (!latestExpected) throw new StockApiError(502, "Tiingo history is outside the supported XNAS calendar");
  const returnedDates = new Set(normalized.candles.map(candle => xnasDateKey(candle.time)));
  normalized.quality.gaps = xnasSessionsBetween(stock.historyStart, latestExpected.date)
    .reduce((count, session) => count + (returnedDates.has(session.date) ? 0 : 1), 0);
  if (Object.values(normalized.quality).some(count => count > 0)) {
    throw new StockApiError(502, "Tiingo history failed exchange-session quality checks");
  }
  return {
    stock,
    provider: STOCK_DATA_PROVIDER,
    providerUrl: STOCK_DATA_PROVIDER_URL,
    exchange: stock.exchange,
    timeframe: "1d",
    retrievedAt: new Date(asOfMs).toISOString(),
    adjustment: STOCK_DATA_ADJUSTMENT,
    candles: normalized.candles,
    quality: normalized.quality,
  };
}

function privateJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function handleStockHistoryRequest(request: Request, fetchImpl: FetchLike = fetch, asOfMs = Date.now()): Promise<Response> {
  try {
    const symbol = stockSymbolFromRequest(request);
    const authorization = tiingoAuthorization(request);
    return privateJson(await fetchTiingoStockHistory(symbol, authorization, fetchImpl, asOfMs));
  } catch (error) {
    const safe = error instanceof StockApiError ? error : new StockApiError(500, "Unable to load stock history");
    return privateJson({ error: safe.message }, safe.status);
  }
}
