import { openCandleConfirmationCount, openCandleConfirmationNote } from "../lib/kk-confirmation";
import type { SignalSnapshot } from "../lib/regimes";

type Signal = Pick<SignalSnapshot, "confirmation" | "readiness" | "values" | "overlays"> & { state: SignalSnapshot["state"] | null };

export default function DailyConfirmation({ signal, quote }: { signal: Signal; quote?: { price: number; time: number } | null }) {
  const confirmation = signal.confirmation;
  if (!confirmation || signal.readiness?.ready === false) return null;
  const direction = confirmation.pending === "bull" ? "Bullish" : "Bearish";
  const note = openCandleConfirmationNote(signal, openCandleConfirmationCount(signal, quote));
  return <div className="method-card" aria-live="polite"><span>DAILY CONFIRMATION</span><b>{confirmation.pending ? `${direction} ${confirmation.count}/${confirmation.required} completed closes · pending` : "No pending reversal"}</b>{note && <small>{note.charAt(0).toUpperCase() + note.slice(1)} · TradingView counts the open candle; the signal waits for completed closes.</small>}<p>Both directions require five consecutive completed daily candles. A failed confirmation resets the count. The current regime stays {signal.state === "bull" ? "bullish" : "bearish"} until confirmation completes.</p></div>;
}

/** The rule label with the open-candle count appended when it is known. */
export function ruleLabel(signal: Signal & { triggerLabel: string }, quote?: { price: number; time: number } | null) {
  const note = openCandleConfirmationNote(signal, openCandleConfirmationCount(signal, quote));
  return note ? `${signal.triggerLabel} · ${note}` : signal.triggerLabel;
}
