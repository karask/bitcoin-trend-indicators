import type { SignalSnapshot } from "../lib/regimes";

export default function DailyConfirmation({ signal }: { signal: Pick<SignalSnapshot, "confirmation" | "readiness"> & { state: SignalSnapshot["state"] | null } }) {
  const confirmation = signal.confirmation;
  if (!confirmation || signal.readiness?.ready === false) return null;
  const direction = confirmation.pending === "bull" ? "Bullish" : "Bearish";
  return <div className="method-card" aria-live="polite"><span>DAILY CONFIRMATION</span><b>{confirmation.pending ? `${direction} ${confirmation.count}/${confirmation.required} · pending` : "No pending reversal"}</b><p>Both directions require five consecutive completed daily candles. A failed confirmation resets the count. The current regime stays {signal.state === "bull" ? "bullish" : "bearish"} until confirmation completes.</p></div>;
}
