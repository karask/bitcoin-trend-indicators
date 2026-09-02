import type { MarketDataset } from "./market-data.ts";
import type { AssetId, SourceId } from "./markets.ts";

const DB_NAME = "crypto-regime-history";
const STORE_NAME = "market-history";
const CACHE_VERSION = 1;
const DAY = 86_400_000;

interface StoredCryptoHistory {
  key: string;
  version: typeof CACHE_VERSION;
  asset: AssetId;
  source: SourceId;
  daily: MarketDataset;
  weekly: MarketDataset;
  savedAt: string;
}

export interface CryptoHistory {
  daily: MarketDataset;
  weekly: MarketDataset;
}

function key(asset: AssetId, source: SourceId): string {
  return `${asset}:${source}`;
}

function validDataset(value: unknown, asset: AssetId, source: SourceId, timeframe: "1d" | "1w"): value is MarketDataset {
  if (!value || typeof value !== "object") return false;
  const dataset = value as Partial<MarketDataset>;
  return dataset.asset === asset && dataset.source === source && dataset.timeframe === timeframe
    && Array.isArray(dataset.candles) && dataset.candles.length > 0
    && dataset.candles.every(candle => Number.isFinite(candle.time) && Number.isFinite(candle.close));
}

function openCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CACHE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the crypto history cache"));
  });
}

export function cryptoIncrementalStart(dataset: MarketDataset): number | undefined {
  const last = dataset.candles.at(-1)?.time;
  if (!Number.isFinite(last)) return undefined;
  const overlap = dataset.timeframe === "1d" ? 45 * DAY : 12 * 7 * DAY;
  return Math.max(0, last! - overlap);
}

export function mergeCryptoDataset(cached: MarketDataset, incoming: MarketDataset, requestedStart?: number): MarketDataset | null {
  if (cached.asset !== incoming.asset || cached.source !== incoming.source || cached.timeframe !== incoming.timeframe) return null;
  if (requestedStart == null) return incoming;
  const retained = cached.candles.filter(candle => candle.time < requestedStart);
  const candles = [...retained, ...incoming.candles]
    .sort((left, right) => left.time - right.time)
    .filter((candle, index, rows) => index === rows.length - 1 || candle.time !== rows[index + 1].time);
  if (!candles.length) return null;
  return { ...incoming, candles, provisional: null };
}

export async function readCryptoHistoryCache(asset: AssetId, source: SourceId): Promise<CryptoHistory | null> {
  const database = await openCache();
  if (!database) return null;
  try {
    const stored = await new Promise<StoredCryptoHistory | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key(asset, source));
      request.onsuccess = () => resolve(request.result as StoredCryptoHistory | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached crypto history"));
    });
    if (!stored || stored.version !== CACHE_VERSION || !validDataset(stored.daily, asset, source, "1d") || !validDataset(stored.weekly, asset, source, "1w")) return null;
    return { daily: stored.daily, weekly: stored.weekly };
  } finally {
    database.close();
  }
}

export async function writeCryptoHistoryCache(asset: AssetId, source: SourceId, history: CryptoHistory): Promise<void> {
  if (!validDataset(history.daily, asset, source, "1d") || !validDataset(history.weekly, asset, source, "1w")) throw new Error("Refusing to cache invalid crypto history");
  const database = await openCache();
  if (!database) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key: key(asset, source), version: CACHE_VERSION, asset, source, ...history, savedAt: new Date().toISOString() } satisfies StoredCryptoHistory);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to cache crypto history"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Crypto history cache was aborted"));
    });
  } finally {
    database.close();
  }
}
