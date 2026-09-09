import type { MarketContext, Timeframe } from "./regimes.ts";
import { xnasDateKey, xnasSessionsBetween } from "./xnas-calendar.ts";

export function signalTiming(candleTime: number | null, timeframe: Timeframe, market: MarketContext) {
  if (candleTime == null) return null;
  const day = 86_400_000;
  if (market === "crypto") {
    const boundary = candleTime + (timeframe === "1w" ? 7 : 1) * day;
    return { confirmedAt: boundary, effectiveAt: boundary };
  }
  // Provider EOD dates do not identify an independently verified COMEX open.
  if (market === "commodity") return { confirmedAt: candleTime + (timeframe === "1w" ? 5 : 1) * day, effectiveAt: null };
  const lastDate = xnasDateKey(candleTime + (timeframe === "1w" ? 4 : 0) * day);
  const sessions = xnasSessionsBetween(xnasDateKey(candleTime), lastDate);
  const session = sessions.at(-1);
  if (!session) return null;
  const following = xnasSessionsBetween(xnasDateKey(Date.parse(`${session.date}T00:00:00Z`) + day), xnasDateKey(candleTime + 21 * day))[0];
  return { confirmedAt: session.closeAt, effectiveAt: following ? following.closeAt - (following.closeHourEastern - 9.5) * 3_600_000 : null };
}
