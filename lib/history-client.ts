import { cryptoIncrementalStart, mergeCryptoDataset, readCryptoHistoryCache, writeCryptoHistoryCache, type CryptoHistory } from "./crypto-cache.ts";
import { mergeIncrementalStockHistory, readStockHistoryCache, stockIncrementalStartDate, writeStockHistoryCache } from "./stock-cache.ts";
import type { AssetId, SourceId } from "./markets.ts";
import { stockDefinition, type StockHistoryResponse, type StockSymbol } from "./stocks.ts";
import { completedBoundary } from "./confirmation-clock.ts";
import { latestRequiredYahooSession } from "./yahoo.ts";
import { xnasDateEpoch } from "./xnas-calendar.ts";

export type SyncStatus = "checking" | "current" | "healthy" | "cooldown" | "failed" | "development-read-through";
type Fetcher = typeof fetch;

/** Timeout each request, but let a failed upstream sync fall back to a D1 read. */
export async function requestJson<T>(fetcher: Fetcher, url: string, init: RequestInit = {}, timeout = 35_000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("Request timed out. Please retry.")), timeout);
  try {
    const response = await fetcher(url, { ...init, cache: "no-store", signal: controller.signal });
    const body = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? "Your session has expired. Please sign in again." : `Data request failed (${response.status}). Please retry.`);
    return body as T;
  } finally { clearTimeout(timer); init.signal?.removeEventListener("abort", abort); }
}

export async function syncMarket(fetcher: Fetcher, body: object, signal: AbortSignal): Promise<SyncStatus> {
  try {
    const result = await requestJson<{ status?: string }>(fetcher, "/api/v1/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    return ["current", "healthy", "cooldown", "development-read-through"].includes(result.status ?? "") ? result.status as SyncStatus : "failed";
  } catch { if (signal.aborted) throw signal.reason; return "failed"; }
}

async function optionalCache<T>(operation: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation.catch(() => null), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 2_000); })]); }
  finally { clearTimeout(timer); }
}

export async function loadCryptoHistory(asset: AssetId, source: SourceId, fetcher: Fetcher, signal: AbortSignal, onCache?: (history: CryptoHistory) => void) {
  const cached = await optionalCache(readCryptoHistoryCache(asset, source));
  signal.throwIfAborted();
  if (cached) onCache?.(cached);
  const status = await syncMarket(fetcher, { market: "crypto", asset, source }, signal);
  const dailyStart = cached ? cryptoIncrementalStart(cached.daily) : undefined;
  const weeklyStart = cached ? cryptoIncrementalStart(cached.weekly) : undefined;
  const requestHistory = (incremental: boolean) => {
    const query = new URLSearchParams({ asset, source });
    if (incremental && dailyStart != null) query.set("dailyStart", String(dailyStart));
    if (incremental && weeklyStart != null) query.set("weeklyStart", String(weeklyStart));
    return requestJson<CryptoHistory>(fetcher, `/api/v1/dashboard?${query}`, { signal });
  };
  let history = await requestHistory(Boolean(cached));
  if (cached) {
    const daily = mergeCryptoDataset(cached.daily, history.daily, dailyStart), weekly = mergeCryptoDataset(cached.weekly, history.weekly, weeklyStart);
    history = daily && weekly ? { ...history, daily, weekly } : await requestHistory(false);
  }
  if (history.daily.asset !== asset || history.weekly.asset !== asset || history.daily.source !== source || history.weekly.source !== source || !history.daily.candles.length || !history.weekly.candles.length) throw new Error("Market history did not match the requested asset and source.");
  signal.throwIfAborted();
  const cacheSaved = await optionalCache(writeCryptoHistoryCache(asset, source, history).then(() => typeof indexedDB !== "undefined")) === true;
  return { history, status, cacheSaved };
}

export async function loadStockHistory(symbol: StockSymbol, fetcher: Fetcher, signal: AbortSignal, onCache?: (history: StockHistoryResponse) => void) {
  const cached = await optionalCache(readStockHistoryCache(symbol));
  signal.throwIfAborted();
  if (cached) onCache?.(cached);
  const status = await syncMarket(fetcher, { market: "stock", symbol }, signal);
  const startDate = cached ? stockIncrementalStartDate(symbol, cached.candles) : undefined;
  const requestHistory = (start?: string) => requestJson<StockHistoryResponse>(fetcher, `/api/v1/stocks/history?${new URLSearchParams({ symbol, ...(start ? { startDate: start } : {}) })}`, { signal });
  let history = await requestHistory(startDate);
  let rebased = false;
  if (cached && startDate !== stockDefinition(symbol).historyStart) {
    const merged = mergeIncrementalStockHistory(cached, history);
    if (merged.requiresFullRefresh) { history = await requestHistory(); rebased = true; }
    else history = merged.response!;
  }
  if (history.stock.symbol !== symbol || !history.candles.length) throw new Error("Stock history did not match the requested symbol.");
  signal.throwIfAborted();
  const cacheSaved = await optionalCache(writeStockHistoryCache(history).then(() => typeof indexedDB !== "undefined")) === true;
  return { history, status, cacheSaved, rebased };
}

export function historyIsCurrent(market: "crypto" | "stock", dailyLast: number | undefined, weeklyLast: number | undefined, now: number): boolean {
  if (!now || dailyLast == null) return false;
  if (market === "crypto") return dailyLast >= completedBoundary("1d", now) && weeklyLast != null && weeklyLast >= completedBoundary("1w", now);
  const expected = latestRequiredYahooSession(now);
  return Boolean(expected && dailyLast >= xnasDateEpoch(expected.date)!);
}

export function syncMessage(status: SyncStatus, isCurrent: boolean, hasHistory: boolean) {
  if (status === "checking") return hasHistory ? "Checking for updates · cached chart remains available" : "Checking for completed history…";
  if (status === "failed") return hasHistory ? "Update failed — showing the last available snapshot" : "Update failed — no cached history available";
  if (isCurrent) return "Up to date · all expected completed candles available";
  if (status === "cooldown") return "Update in progress or cooling down — snapshot is behind; check again shortly";
  return "Snapshot is behind the latest expected candle — check for updates";
}
