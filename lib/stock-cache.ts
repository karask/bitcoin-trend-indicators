import type { Candle } from "./regimes.ts";
import { stockDefinition, type StockHistoryResponse, type StockSymbol } from "./stocks.ts";
import { xnasDateKey, xnasSessionsBetween } from "./xnas-calendar.ts";

const DB_NAME = "stock-regime-history";
const STORE_NAME = "adjusted-history";
const CACHE_VERSION = 1;
const DAY = 86_400_000;

export const STOCK_REFRESH_OVERLAP_DAYS = 400;

interface StoredStockHistory {
  version: typeof CACHE_VERSION;
  symbol: StockSymbol;
  savedAt: string;
  response: StockHistoryResponse;
}

export interface StockHistoryMergeResult {
  response: StockHistoryResponse | null;
  requiresFullRefresh: boolean;
  reason: "none" | "adjustment-rebase" | "incomplete-cache";
}

function closeEnough(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-10;
}

function sameCandle(left: Candle, right: Candle): boolean {
  return left.time === right.time
    && closeEnough(left.open, right.open)
    && closeEnough(left.high, right.high)
    && closeEnough(left.low, right.low)
    && closeEnough(left.close, right.close)
    && closeEnough(left.volume, right.volume);
}

function completeCoverage(response: StockHistoryResponse): boolean {
  try {
    const stock = stockDefinition(response.stock.symbol);
    const dates = new Set(response.candles.map(candle => xnasDateKey(candle.time)));
    return response.requestedStart === stock.historyStart
      && Object.values(response.quality).every(value => value === 0)
      && xnasSessionsBetween(stock.historyStart, response.requiredThrough).every(session => dates.has(session.date));
  } catch {
    return false;
  }
}

function looksLikeCachedResponse(value: unknown, symbol: StockSymbol): value is StockHistoryResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<StockHistoryResponse>;
  return response.stock?.symbol === symbol
    && response.provider?.id === "tiingo"
    && response.adjustment === "split-and-dividend-adjusted"
    && typeof response.requestedStart === "string"
    && typeof response.requiredThrough === "string"
    && typeof response.retrievedAt === "string"
    && Array.isArray(response.candles)
    && Boolean(response.quality);
}

function openCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CACHE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "symbol" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the stock history cache"));
  });
}

export function stockIncrementalStartDate(symbol: StockSymbol, candles: Candle[]): string {
  const stock = stockDefinition(symbol);
  const last = candles.at(-1)?.time;
  if (!Number.isFinite(last)) return stock.historyStart;
  const overlap = xnasDateKey(last! - STOCK_REFRESH_OVERLAP_DAYS * DAY);
  return overlap < stock.historyStart ? stock.historyStart : overlap;
}

/**
 * Combines a locally cached full history with a small Tiingo tail request.
 * Any changed adjusted OHLCV value in the overlap means a split, dividend, or
 * provider correction rebased history, so the caller must fetch the full range.
 */
export function mergeIncrementalStockHistory(cached: StockHistoryResponse, incoming: StockHistoryResponse): StockHistoryMergeResult {
  if (cached.stock.symbol !== incoming.stock.symbol || !completeCoverage(cached)) {
    return { response: null, requiresFullRefresh: true, reason: "incomplete-cache" };
  }
  if (incoming.requestedStart === incoming.stock.historyStart) {
    return completeCoverage(incoming)
      ? { response: incoming, requiresFullRefresh: false, reason: "none" }
      : { response: null, requiresFullRefresh: true, reason: "incomplete-cache" };
  }

  const cachedByTime = new Map(cached.candles.map(candle => [candle.time, candle]));
  const common = incoming.candles.filter(candle => cachedByTime.has(candle.time));
  if (!common.length) return { response: null, requiresFullRefresh: true, reason: "incomplete-cache" };
  if (common.some(candle => !sameCandle(cachedByTime.get(candle.time)!, candle))) {
    return { response: null, requiresFullRefresh: true, reason: "adjustment-rebase" };
  }

  const mergedByTime = new Map(cached.candles.map(candle => [candle.time, candle]));
  for (const candle of incoming.candles) mergedByTime.set(candle.time, candle);
  const response: StockHistoryResponse = {
    ...incoming,
    requestedStart: incoming.stock.historyStart,
    candles: [...mergedByTime.values()].sort((left, right) => left.time - right.time),
    quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 },
  };
  return completeCoverage(response)
    ? { response, requiresFullRefresh: false, reason: "none" }
    : { response: null, requiresFullRefresh: true, reason: "incomplete-cache" };
}

export async function readStockHistoryCache(symbol: StockSymbol): Promise<StockHistoryResponse | null> {
  const database = await openCache();
  if (!database) return null;
  try {
    const stored = await new Promise<StoredStockHistory | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(symbol);
      request.onsuccess = () => resolve(request.result as StoredStockHistory | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached stock history"));
    });
    if (!stored || stored.version !== CACHE_VERSION || !looksLikeCachedResponse(stored.response, symbol) || !completeCoverage(stored.response)) return null;
    return stored.response;
  } finally {
    database.close();
  }
}

export async function writeStockHistoryCache(response: StockHistoryResponse): Promise<void> {
  if (!completeCoverage(response)) throw new Error("Refusing to cache incomplete stock history");
  const database = await openCache();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        version: CACHE_VERSION,
        symbol: response.stock.symbol,
        savedAt: new Date().toISOString(),
        response,
      } satisfies StoredStockHistory);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to cache stock history"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Stock history cache was aborted"));
    });
  } finally {
    database.close();
  }
}

export async function deleteStockHistoryCache(symbol: StockSymbol): Promise<void> {
  const database = await openCache();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(symbol);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clear cached stock history"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Stock history cache clear was aborted"));
    });
  } finally {
    database.close();
  }
}
