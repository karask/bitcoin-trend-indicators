import type { Candle, Timeframe } from "./regimes.ts";
import { xnasDateEpoch, xnasDateKey, xnasSessionsBetween } from "./xnas-calendar.ts";

export type CommodityId = "gold" | "silver";
export type CommoditySymbol = "GC=F" | "SI=F";
export const COMMODITIES = [
  { id: "gold", symbol: "GC=F", label: "Gold futures", exchange: "COMEX", currency: "USD", unit: "troy ounce", provider: "yahoo", historyStart: "2019-01-02" },
  { id: "silver", symbol: "SI=F", label: "Silver futures", exchange: "COMEX", currency: "USD", unit: "troy ounce", provider: "yahoo", historyStart: "2019-01-02" },
] as const;
export type CommodityDefinition = typeof COMMODITIES[number];
export const COMMODITY_PROVIDER = { id: "yahoo", label: "Yahoo Finance" } as const;
export const COMMODITY_ADJUSTMENT = "provider-continuous-futures" as const;
export const COMMODITY_CAVEAT = "Yahoo continuous futures, not spot metal. Prices are USD per troy ounce. Contract changes and thin historical bars can affect indicators; the provider's roll adjustment is not independently verified.";
export interface CommodityHistoryResponse {
  commodity: CommodityDefinition;
  provider: typeof COMMODITY_PROVIDER;
  providerUrl: "https://finance.yahoo.com/";
  exchange: "COMEX";
  timeframe: "1d";
  requestedStart: string;
  requiredThrough: string;
  retrievedAt: string;
  adjustment: typeof COMMODITY_ADJUSTMENT;
  contractLabel: string;
  candles: Candle[];
  quality: { gaps: number; duplicates: number; malformed: number; unexpectedSessions: number };
}
export interface CommodityQuote {
  commodity: CommodityDefinition;
  provider: typeof COMMODITY_PROVIDER;
  price: number;
  previousClose: number | null;
  currency: "USD";
  contractLabel: string;
  quoteTime: string;
  retrievedAt: string;
}
export const isCommodityId = (value: string): value is CommodityId => COMMODITIES.some(item => item.id === value);
export const isCommoditySymbol = (value: string): value is CommoditySymbol => COMMODITIES.some(item => item.symbol === value);
export function commodityDefinition(value: CommodityId | CommoditySymbol): CommodityDefinition {
  const result = COMMODITIES.find(item => item.id === value || item.symbol === value);
  if (!result) throw new Error("Unsupported commodity");
  return result;
}
const DAY = 86_400_000;
export const commodityDateKey = xnasDateKey;
export const commodityDateEpoch = xnasDateEpoch;
/** Yahoo EOD publication baseline, NOT a COMEX trading-hours calendar.
 * US cash-session dates are a conservative minimum; additional valid weekday
 * holiday bars are retained when Yahoo publishes them. Never manufacture bars.
 */
export const expectedCommodityDates = (start: string, end: string) => xnasSessionsBetween(start, end).map(row => row.date);
export const isCommodityBarDate = (date: string) => {
  const time = xnasDateEpoch(date);
  return time != null && ![0, 6].includes(new Date(time).getUTCDay());
};
// Deliberately wait until 00:00 UTC AFTER the labelled day, later than normal
// COMEX trading close in both DST regimes. This is not the settlement instant.
export const commodityBarComplete = (date: string, now: number) => (xnasDateEpoch(date) ?? Infinity) + DAY <= now;
export function latestRequiredCommodityDate(now: number): string | null {
  const end = xnasDateKey(now - DAY);
  return expectedCommodityDates(xnasDateKey(now - 14 * DAY), end).at(-1) ?? null;
}
export function commodityQuality(candles: Candle[], start: string, end: string) {
  const dates = new Set(candles.map(row => xnasDateKey(row.time)));
  return expectedCommodityDates(start, end).filter(date => !dates.has(date)).length;
}
export function aggregateCommodityWeeks(daily: Candle[], now: number): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const row of daily) {
    if (!row.complete || !commodityBarComplete(xnasDateKey(row.time), now)) continue;
    const monday = row.time - ((new Date(row.time).getUTCDay() + 6) % 7) * DAY;
    groups.set(monday, [...(groups.get(monday) ?? []), row]);
  }
  return [...groups].sort(([a], [b]) => a - b).flatMap(([monday, rows]) => {
    if (monday + 5 * DAY > now || commodityQuality(rows, xnasDateKey(monday), xnasDateKey(monday + 4 * DAY))) return [];
    rows.sort((a,b) => a.time-b.time);
    return [{ time: monday, open: rows[0].open, high: Math.max(...rows.map(r=>r.high)), low: Math.min(...rows.map(r=>r.low)), close: rows.at(-1)!.close, volume: rows.reduce((sum,r)=>sum+r.volume,0), complete: true }];
  });
}
export function commodityConfirmationClock(timeframe: Timeframe, now: number) {
  if (!now) return { title: "Next bar completion check", boundary: "Conservative 00:00 UTC cutoff · not exchange settlement", target: 0, remaining: "—" };
  const today = Math.floor(now / DAY) * DAY;
  let target = today + DAY;
  if (timeframe === "1w") target = today + (((6 - new Date(today).getUTCDay() + 7) % 7) || 7) * DAY;
  else while ([0,1].includes(new Date(target).getUTCDay())) target += DAY;
  const minutes = Math.max(0, Math.floor((target-now)/60000));
  return { title: timeframe === "1w" ? "Next weekly bar check" : "Next daily bar check", boundary: "00:00 UTC cutoff · holidays may have no bar · not settlement", target, remaining: `${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h ${minutes%60}m` };
}
