import { ASSETS, isAssetId, isSourceId, resolveSourceForAsset, type AssetId, type SourceId } from "./markets.ts";
import { STOCKS, isStockId, aggregateStockWeeks, type StockHistoryResponse, type StockId } from "./stocks.ts";
import { calculateIndicators, type Candle } from "./regimes.ts";
import type { CryptoHistory } from "./crypto-cache.ts";
import type { Lab } from "./view-preferences.ts";

export type WatchPin = { asset: AssetId | StockId; source: SourceId | "yahoo" };
export const pinKey = (pin: WatchPin) => `${pin.asset}:${pin.source}`;
export function normalizePins(lab: Lab, input: unknown): WatchPin[] {
  if (!Array.isArray(input)) return lab === "crypto" ? ASSETS.slice(0, 3).map(asset => ({ asset: asset.id, source: asset.defaultSource })) : STOCKS.slice(0, 3).map(stock => ({ asset: stock.id, source: "yahoo" }));
  const unique = new Map<string, WatchPin>();
  for (const item of input.slice(0, 30)) {
    if (!item || typeof item !== "object" || typeof item.asset !== "string") continue;
    if (lab === "crypto" && isAssetId(item.asset)) {
      const source = resolveSourceForAsset(item.asset, isSourceId(item.source) ? item.source : ASSETS.find(asset => asset.id === item.asset)!.defaultSource);
      const pin = { asset: item.asset, source }; unique.set(pinKey(pin), pin);
    } else if (lab === "stock" && isStockId(item.asset)) { const pin: WatchPin = { asset: item.asset, source: "yahoo" }; unique.set(pinKey(pin), pin); }
  }
  return [...unique.values()].slice(0, 12);
}

function summarize(daily: Candle[], weekly: Candle[], asset?: AssetId) {
  const options = { asset, market: asset ? "crypto" as const : "equity" as const, indicatorIds: ["kk_supertrend"] };
  const day = calculateIndicators(daily, "1d", options)[0], week = calculateIndicators(weekly, "1w", options)[0];
  return { dailyState: day.readiness?.ready ? day.state : null, weeklyState: week.readiness?.ready ? week.state : null, level: week.readiness?.ready ? week.values.supertrend : null, lastFlip: week.lastFlip, close: daily.at(-1)?.close, dailyLast: daily.at(-1)?.time, weeklyLast: weekly.at(-1)?.time };
}
export function cryptoWatchSummary(history: CryptoHistory, asset: AssetId) { return { ...summarize(history.daily.candles, history.weekly.candles, asset), denomination: history.daily.denomination, retrievedAt: history.daily.retrievedAt }; }
export function stockWatchSummary(history: StockHistoryResponse) { return { ...summarize(history.candles, aggregateStockWeeks(history.candles, Date.parse(history.retrievedAt))), denomination: "USD", retrievedAt: history.retrievedAt }; }
export type WatchSummary = ReturnType<typeof cryptoWatchSummary>;
