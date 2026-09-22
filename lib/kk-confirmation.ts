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
