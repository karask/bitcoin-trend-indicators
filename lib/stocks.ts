import type { Candle } from "./regimes.ts";
import { isXnasSessionComplete, isXnasSessionDate, xnasDateEpoch, xnasDateKey, xnasSessionsBetween } from "./xnas-calendar.ts";

export type StockId = "tsla" | "googl" | "nvda" | "spcx" | "mu" | "sndk";
export type StockSymbol = "TSLA" | "GOOGL" | "NVDA" | "SPCX" | "MU" | "SNDK";

export interface StockDefinition {
  id: StockId;
  company: string;
  ticker: StockSymbol;
  label: string;
  symbol: StockSymbol;
  exchange: "NASDAQ";
  currency: "USD";
  provider: "yahoo";
  calendar: "XNAS";
  historyStart: string;
}

export const STOCKS: readonly StockDefinition[] = [
  { id: "tsla", company: "Tesla", ticker: "TSLA", label: "Tesla", symbol: "TSLA", exchange: "NASDAQ", currency: "USD", provider: "yahoo", calendar: "XNAS", historyStart: "2010-06-29" },
  { id: "googl", company: "Alphabet Class A", ticker: "GOOGL", label: "Alphabet Class A", symbol: "GOOGL", exchange: "NASDAQ", currency: "USD", provider: "yahoo", calendar: "XNAS", historyStart: "2004-08-19" },
  { id: "nvda", company: "NVIDIA", ticker: "NVDA", label: "NVIDIA", symbol: "NVDA", exchange: "NASDAQ", currency: "USD", provider: "yahoo", calendar: "XNAS", historyStart: "1999-01-22" },
  { id: "spcx", company: "SpaceX", ticker: "SPCX", label: "SpaceX", symbol: "SPCX", exchange: "NASDAQ", currency: "USD", provider: "yahoo", calendar: "XNAS", historyStart: "2026-06-12" },
  { id: "mu", company: "Micron Technology", ticker: "MU", label: "Micron Technology", symbol: "MU", exchange: "NASDAQ", currency: "USD", provider: "yahoo", calendar: "XNAS", historyStart: "1999-01-04" },
  { id: "sndk", company: "Sandisk", ticker: "SNDK", label: "Sandisk", symbol: "SNDK", exchange: "NASDAQ", currency: "USD", provider: "yahoo", calendar: "XNAS", historyStart: "2025-02-24" },
];

export const STOCK_DATA_ADJUSTMENT = "split-adjusted" as const;
export const STOCK_DATA_PROVIDER = { id: "yahoo", label: "Yahoo Finance" } as const;
export const STOCK_DATA_ATTRIBUTION = "Data sourced from Yahoo Finance";
export const STOCK_DATA_PROVIDER_URL = "https://finance.yahoo.com/";

export interface StockHistoryQuality {
  gaps: number;
  duplicates: number;
  malformed: number;
  unexpectedSessions: number;
}

export interface StockHistoryResponse {
  stock: StockDefinition;
  provider: typeof STOCK_DATA_PROVIDER;
  providerUrl: typeof STOCK_DATA_PROVIDER_URL;
  exchange: "NASDAQ";
  timeframe: "1d";
  requestedStart: string;
  requiredThrough: string;
  retrievedAt: string;
  adjustment: typeof STOCK_DATA_ADJUSTMENT;
  candles: Candle[];
  quality: StockHistoryQuality;
}

export function isStockId(value: string): value is StockId {
  return STOCKS.some(stock => stock.id === value);
}

export function isStockSymbol(value: string): value is StockSymbol {
  return STOCKS.some(stock => stock.ticker === value);
}

export function stockDefinition(value: StockId | StockSymbol): StockDefinition {
  const stock = STOCKS.find(item => item.id === value || item.ticker === value);
  if (!stock) throw new Error("Unsupported stock symbol");
  return stock;
}

function mondayForEpoch(epoch: number): number {
  const weekday = new Date(epoch).getUTCDay();
  return epoch - ((weekday + 6) % 7) * 86_400_000;
}

/**
 * Builds completed Monday-anchored trading weeks from adjusted daily bars.
 * A week is omitted if any expected XNAS session is absent or if its final
 * session had not closed at `asOfMs`.
 */
export function aggregateStockWeeks(daily: Candle[], asOfMs: number): Candle[] {
  const groups = new Map<number, Map<string, Candle>>();
  for (const candle of daily) {
    if (!Number.isFinite(candle.time)) continue;
    const date = xnasDateKey(candle.time);
    if (!isXnasSessionDate(date)) continue;
    const monday = mondayForEpoch(candle.time);
    const rows = groups.get(monday) ?? new Map<string, Candle>();
    rows.set(date, candle);
    groups.set(monday, rows);
  }

  return [...groups.entries()].sort(([a], [b]) => a - b).flatMap(([monday, rows]) => {
    const friday = monday + 4 * 86_400_000;
    const expected = xnasSessionsBetween(xnasDateKey(monday), xnasDateKey(friday));
    if (!expected.length || !isXnasSessionComplete(expected.at(-1)!.date, asOfMs)) return [];
    if (expected.some(session => !rows.has(session.date))) return [];
    const candles = expected.map(session => rows.get(session.date)!);
    return [{
      time: monday,
      open: candles[0].open,
      high: Math.max(...candles.map(candle => candle.high)),
      low: Math.min(...candles.map(candle => candle.low)),
      close: candles.at(-1)!.close,
      volume: candles.reduce((total, candle) => total + candle.volume, 0),
      complete: true,
    }];
  });
}

export function stockSessionDate(candle: Candle): string | null {
  const date = xnasDateKey(candle.time);
  return xnasDateEpoch(date) === candle.time ? date : null;
}
