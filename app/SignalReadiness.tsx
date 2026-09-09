import { signalTiming } from "../lib/signal-timing";
import type { MarketContext, SignalSnapshot, Timeframe } from "../lib/regimes";

export default function SignalReadiness({ readiness, lastFlip, timeframe, market }: { readiness: SignalSnapshot["readiness"]; lastFlip: number | null; timeframe: Timeframe; market: MarketContext }) {
  if (readiness?.ready === false) return <p className="readiness-notice" role="status">Insufficient history · {readiness.availableCandles} / {readiness.requiredCandles} {timeframe === "1w" ? "weeks" : market === "equity" ? "sessions" : "days"}. Not a neutral signal; excluded from family agreement and unavailable backtests.</p>;
  const timing = signalTiming(lastFlip, timeframe, market);
  const format = (time: number | null) => time == null ? "Not yet scheduled" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: market === "equity" ? "America/New_York" : "UTC", timeZoneName: "short" }).format(time);
  return <dl className="signal-timing"><div><dt>{market === "commodity" ? "Last reversal · completion cutoff" : "Last reversal confirmed"}</dt><dd>{timing ? format(timing.confirmedAt) : "No reversal in available history"}</dd></div>{timing && <div><dt>Effective next open</dt><dd>{market === "commodity" ? "Next available futures bar open" : format(timing.effectiveAt)}</dd></div>}</dl>;
}
