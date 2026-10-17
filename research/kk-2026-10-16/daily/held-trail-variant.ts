/** Daily KK variants. app = lib behaviour (raw trail, confirm vs raw); held = trail never moves against the trend until 5 consecutive closes beyond it confirm a flip. */
export type C = { time: number; high: number; low: number; close: number };
export function heldKk(c: C[], len: number, f: number, need = 5) {
  const n = c.length, tr = c.map((x, i) => i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)));
  if (n < len + 2) return null;
  let s = 0; for (let i = 0; i < len; i++) s += tr[i]; let atr = s / len;
  let up = NaN, lo = NaN, state: "bull" | "bear" = "bear", T = NaN, count = 0, lastFlip: number | null = null;
  for (let i = len - 1; i < n; i++) {
    if (i >= len) atr = (atr * (len - 1) + tr[i]) / len;
    const hl2 = (c[i].high + c[i].low) / 2, bu = hl2 + f * atr, bl = hl2 - f * atr;
    if (Number.isNaN(up)) { up = bu; lo = bl; T = bu; continue; }
    up = bu < up || c[i - 1].close > up ? bu : up;
    lo = bl > lo || c[i - 1].close < lo ? bl : lo;
    if (count === 0) T = state === "bull" ? Math.max(T, bl) : Math.min(T, bu);
    const beyond = state === "bull" ? c[i].close < T : c[i].close > T;
    count = beyond ? count + 1 : 0;
    if (count >= need) { state = state === "bull" ? "bear" : "bull"; T = state === "bull" ? lo : up; count = 0; lastFlip = c[i].time; }
  }
  return { state, level: T, count, lastFlip };
}
