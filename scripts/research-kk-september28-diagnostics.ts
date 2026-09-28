/** Bounded integer diagnostic scan; no backtest performance is scored. */
import fs from "node:fs";
import { calculateIndicators, type Candle, type Timeframe } from "../lib/regimes.ts";
const root = "research/kk-2026-09-28";
const refs = JSON.parse(fs.readFileSync(`${root}/observations.json`, "utf8")) as Array<{ asset: string; timeframe: Timeframe; target: number }>;
for (const ref of refs.filter(r => r.timeframe === "1d" || ["bot", "spcx"].includes(r.asset))) {
  const fixture = JSON.parse(fs.readFileSync(`${root}/${ref.asset}.json`, "utf8")) as { daily: Candle[]; weekly: Candle[] };
  const cs = ref.timeframe === "1d" ? fixture.daily : fixture.weekly;
  const scores = [];
  for (const length of [5, 7, 10, 14, 15, 20, 21, 30, 50]) for (const factor of [1, 2, 3, 4, 5, 6]) {
    const s = calculateIndicators(cs, ref.timeframe, { indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: length, kkSupertrendFactor: factor })[0];
    if (s.values.supertrend != null) scores.push({ length, factor, value: s.values.supertrend, state: s.state, error: 100 * (s.values.supertrend / ref.target - 1), flip: s.lastFlip == null ? null : new Date(s.lastFlip).toISOString().slice(0, 10) });
  }
  fs.writeFileSync(`${root}/${ref.asset}-${ref.timeframe}-diagnostics.json`, JSON.stringify(scores, null, 2) + "\n");
}
