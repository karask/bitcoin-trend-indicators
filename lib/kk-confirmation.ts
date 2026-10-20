import type { RegimeState } from "./regimes.ts";

export const KK_DAILY_CONFIRMATIONS = 5;

/** Confirm an opposite underlying regime on its fifth consecutive closed bar.
 * Null observations neither count nor confirm a reversal. The initial regime is
 * the underlying ATR warmup seed; only subsequent reversals are actionable.
 */
export function confirmDailyRegimes(raw: Array<RegimeState | null>, qualifies?: boolean[]) {
  let confirmed: RegimeState | null = null;
  let pending: RegimeState | null = null;
  let count = 0;
  const states = raw.map((state, index) => {
    if (state == null) { pending = null; count = 0; return null; }
    if (confirmed == null) confirmed = state;
    if (state === confirmed || qualifies?.[index] === false) { pending = null; count = 0; }
    else {
      count = pending === state ? count + 1 : 1;
      pending = state;
      if (count === KK_DAILY_CONFIRMATIONS) {
        confirmed = state; pending = null; count = 0;
      }
    }
    return confirmed;
  });
  return { states, pending: pending as RegimeState | null, count };
}

type ConfirmationSignal = { state: RegimeState | null; confirmation?: { required: number; count: number; pending: RegimeState | null }; values: { supertrend?: number | null }; overlays: { points: { time: number }[] }[] };

/**
 * Display only: the count TradingView prints, which also includes today's open
 * candle. The live quote stands in for that candle when it belongs to a later day
 * than the last completed candle. It never enters the signal, which counts only
 * completed closes. Returns null when no open candle is known.
 */
export function openCandleConfirmationCount(signal: ConfirmationSignal, quote: { price: number; time: number } | null | undefined): number | null {
  const confirmation = signal.confirmation, level = signal.values.supertrend, last = signal.overlays[0]?.points.at(-1)?.time;
  if (!confirmation || !quote || level == null || last == null || !Number.isFinite(quote.price) || !Number.isFinite(quote.time)) return null;
  if (Math.floor(quote.time / 86_400_000) <= Math.floor(last / 86_400_000)) return null;
  const beyond = signal.state === "bull" ? quote.price < level : signal.state === "bear" ? quote.price > level : false;
  return beyond ? Math.min(confirmation.count + 1, confirmation.required) : 0;
}

/** Both counts for the confirmation card and rule label: completed closes, then the count including today's open candle. */
export function openCandleConfirmationNote(signal: ConfirmationSignal, openCount: number | null): string | null {
  const confirmation = signal.confirmation;
  if (!confirmation || openCount == null) return null;
  const toward = signal.state === "bull" ? "Bearish" : "Bullish";
  if (openCount > 0) return `${confirmation.pending ? "" : `${toward} `}${openCount}/${confirmation.required} including today's open candle`;
  return confirmation.pending ? `today's open candle is back on the ${signal.state === "bull" ? "bullish" : "bearish"} side of the trail (0/${confirmation.required} if it closes there)` : null;
}
