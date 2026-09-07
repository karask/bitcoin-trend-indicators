import { ASSETS, marketDefinition, type AssetId, type SourceId } from "./markets.ts";
import { STOCKS, aggregateStockWeeks, type StockHistoryResponse, type StockId } from "./stocks.ts";
import { calculateIndicators, INDICATOR_SPECS, type Candle, type SignalSnapshot, type Timeframe } from "./regimes.ts";
import type { CryptoHistory } from "./crypto-cache.ts";
import { viewUrl } from "./view-preferences.ts";

export const OVERVIEW_ASSETS = [
  ...ASSETS.map(asset => ({ lab: "crypto" as const, asset: asset.id, source: asset.defaultSource, symbol: asset.symbol, label: asset.label, venue: marketDefinition(asset.id, asset.defaultSource).label })),
  ...STOCKS.map(stock => ({ lab: "stock" as const, asset: stock.id, source: "yahoo" as const, symbol: stock.symbol, label: stock.label, venue: "Yahoo Finance · NASDAQ" })),
];
export type OverviewAsset = typeof OVERVIEW_ASSETS[number];
export type OverviewHistory = { lab: "crypto"; history: CryptoHistory } | { lab: "stock"; history: StockHistoryResponse };
export const overviewIndicator = (id: string | null) => INDICATOR_SPECS.find(spec => spec.id === id) ?? INDICATOR_SPECS.find(spec => spec.id === "kk_supertrend")!;
export const overviewTimeframe = (id: string): Timeframe => overviewIndicator(id).supportedTimeframes.includes("1w") ? "1w" : "1d";
export const overviewUrl = (asset: OverviewAsset, indicator: string) => viewUrl(asset.lab, { asset: asset.asset as AssetId | StockId, source: asset.source as SourceId | "yahoo", indicator, timeframe: overviewTimeframe(indicator) });

export function summarizeOverview(data: OverviewHistory, indicator: string) {
  const daily = data.lab === "crypto" ? data.history.daily.candles : data.history.candles;
  const weekly = data.lab === "crypto" ? data.history.weekly.candles : aggregateStockWeeks(daily, Date.parse(data.history.retrievedAt));
  const options = { market: data.lab === "crypto" ? "crypto" as const : "equity" as const, asset: data.lab === "crypto" ? data.history.daily.asset : undefined, indicatorIds: [indicator] };
  const signal = (candles: Candle[], timeframe: Timeframe) => calculateIndicators(candles, timeframe, options)[0];
  const day = signal(daily, "1d"), week = signal(weekly, "1w");
  return { day, week, selected: overviewTimeframe(indicator) === "1w" ? week : day, close: daily.at(-1)?.close, dailyLast: daily.at(-1)?.time, weeklyLast: weekly.at(-1)?.time, denomination: data.lab === "crypto" ? data.history.daily.denomination : "USD" };
}

export function overviewState(signal: SignalSnapshot | undefined, supported: boolean) {
  if (!supported) return "N/A";
  if (!signal) return "Not loaded";
  if (!signal.readiness?.ready) return "Insufficient history";
  const state = signal.state;
  if (signal.id === "mayer") return `${signal.values.multiple!.toFixed(2)}× 200D price ratio`;
  if (signal.role === "valuation") return state === "bull" ? "Above baseline" : "Below baseline";
  if (signal.role === "confirmation") return state === "bull" ? "Positive" : state === "bear" ? "Negative" : "No confirmation";
  if (signal.role === "exit") return state === "bull" ? "Stop intact" : "Exit condition";
  return state === "bull" ? "Bullish" : state === "bear" ? "Bearish" : "Neutral";
}

/** Conditional models do not have a guaranteed one-price reversal. */
export function overviewLevels(signal: SignalSnapshot | undefined): Array<{ label: string; price: number }> {
  if (!signal?.readiness?.ready || signal.thresholdKind === "conditional") return [];
  if (signal.id === "ma_200w") return signal.values.sma200 != null ? [{ label: "Baseline", price: signal.values.sma200 }] : [];
  const levels = [];
  if (signal.state !== "bull" && signal.bullTrigger != null) levels.push({ label: signal.role === "exit" ? "Stop above" : "Bull above", price: signal.bullTrigger });
  if (signal.state !== "bear" && signal.bearTrigger != null) levels.push({ label: signal.role === "exit" ? "Exit below" : "Bear below", price: signal.bearTrigger });
  return levels;
}
