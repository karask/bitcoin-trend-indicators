import type { Candle } from "./regimes.ts";
import { commodityDefinition, type CommodityHistoryResponse, type CommoditySymbol } from "./commodities.ts";
import { commodityDateKey as xnasDateKey, expectedCommodityDates } from "./commodities.ts";

const DB_NAME = "commodity-regime-history";
const STORE_NAME = "futures-history";
const CACHE_VERSION = 1;
const DAY = 86_400_000;

export const COMMODITY_REFRESH_OVERLAP_DAYS = 400;

interface StoredCommodityHistory {
  version: typeof CACHE_VERSION;
  symbol: CommoditySymbol;
  savedAt: string;
  response: CommodityHistoryResponse;
}

export interface CommodityHistoryMergeResult {
  response: CommodityHistoryResponse | null;
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

function completeCoverage(response: CommodityHistoryResponse): boolean {
  try {
    const commodity = commodityDefinition(response.commodity.symbol);
    const dates = new Set(response.candles.map(candle => xnasDateKey(candle.time)));
    return response.requestedStart === commodity.historyStart
      && Object.values(response.quality).every(value => value === 0)
      && expectedCommodityDates(commodity.historyStart, response.requiredThrough).every(date => dates.has(date));
  } catch {
    return false;
  }
}

function looksLikeCachedResponse(value: unknown, symbol: CommoditySymbol): value is CommodityHistoryResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<CommodityHistoryResponse>;
  return response.commodity?.symbol === symbol
    && response.provider?.id === "yahoo"
    && response.adjustment === "provider-continuous-futures"
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
    request.onerror = () => reject(request.error ?? new Error("Unable to open the commodity history cache"));
  });
}

export function commodityIncrementalStartDate(symbol: CommoditySymbol, candles: Candle[]): string {
  const commodity = commodityDefinition(symbol);
  const last = candles.at(-1)?.time;
  if (!Number.isFinite(last)) return commodity.historyStart;
  const overlap = xnasDateKey(last! - COMMODITY_REFRESH_OVERLAP_DAYS * DAY);
  return overlap < commodity.historyStart ? commodity.historyStart : overlap;
}

/**
 * Combines a locally cached full history with a small database tail request.
 * Any changed OHLCV value in the overlap means a contract-series revision or
 * provider correction rebased history, so the caller must fetch the full range.
 */
export function mergeIncrementalCommodityHistory(cached: CommodityHistoryResponse, incoming: CommodityHistoryResponse): CommodityHistoryMergeResult {
  if (cached.commodity.symbol !== incoming.commodity.symbol || !completeCoverage(cached)) {
    return { response: null, requiresFullRefresh: true, reason: "incomplete-cache" };
  }
  if (incoming.requestedStart === incoming.commodity.historyStart) {
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
  const response: CommodityHistoryResponse = {
    ...incoming,
    requestedStart: incoming.commodity.historyStart,
    candles: [...mergedByTime.values()].sort((left, right) => left.time - right.time),
    quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 },
  };
  return completeCoverage(response)
    ? { response, requiresFullRefresh: false, reason: "none" }
    : { response: null, requiresFullRefresh: true, reason: "incomplete-cache" };
}

export async function readCommodityHistoryCache(symbol: CommoditySymbol): Promise<CommodityHistoryResponse | null> {
  const database = await openCache();
  if (!database) return null;
  try {
    const stored = await new Promise<StoredCommodityHistory | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(symbol);
      request.onsuccess = () => resolve(request.result as StoredCommodityHistory | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached commodity history"));
    });
    if (!stored || stored.version !== CACHE_VERSION || !looksLikeCachedResponse(stored.response, symbol) || !completeCoverage(stored.response)) return null;
    return stored.response;
  } finally {
    database.close();
  }
}

export async function writeCommodityHistoryCache(response: CommodityHistoryResponse): Promise<void> {
  if (!completeCoverage(response)) throw new Error("Refusing to cache incomplete commodity history");
  const database = await openCache();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        version: CACHE_VERSION,
        symbol: response.commodity.symbol,
        savedAt: new Date().toISOString(),
        response,
      } satisfies StoredCommodityHistory);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to cache commodity history"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Commodity history cache was aborted"));
    });
  } finally {
    database.close();
  }
}

export async function deleteCommodityHistoryCache(symbol: CommoditySymbol): Promise<void> {
  const database = await openCache();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(symbol);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clear cached commodity history"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Commodity history cache clear was aborted"));
    });
  } finally {
    database.close();
  }
}

export async function clearAllCommodityHistoryCaches(): Promise<void> {
  const database = await openCache();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clear saved commodity history"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Commodity history cache clear was aborted"));
    });
  } finally {
    database.close();
  }
}
