/** Daily-only integer-preset research. Offline fixtures; no production preset changes. */
import fs from "node:fs";
import { calculateIndicators, type Candle } from "../lib/regimes.ts";

const root = "research/kk-2026-09-21-archives";
type Reference = { asset: string; source: string; timeframe: string; target: number; state: string; pending?: number; previous: { atrLength: number; factor: number } };
const references = (JSON.parse(fs.readFileSync(`${root}/results.json`, "utf8")) as Reference[]).filter(r => r.timeframe === "1d");
const lengths = [5, 7, 10, 14, 15, 20, 21, 25, 30, 40, 50, 60, 75, 100, 150, 200];
const factors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const sharedLengths = [10, 15, 20, 30];
const results = references.map(ref => {
  const suffix = ["gold", "silver"].includes(ref.asset) ? "-futures" : "";
  const candles: Candle[] = JSON.parse(fs.readFileSync(`${root}/${ref.asset}-${ref.source}${suffix}.json`, "utf8")).candles;
  const candidates = [];
  for (const atrLength of lengths) for (const factor of factors) {
    if (candles.length < atrLength + 50) continue;
    const signal = calculateIndicators(candles, "1d", { kkSupertrendLegacySingleClose: true, indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: atrLength, kkSupertrendFactor: factor })[0];
    const value = signal.values.supertrend;
    if (value == null) continue;
    candidates.push({ atrLength, factor, value, state: signal.state, errorPct: 100 * (value / ref.target - 1), lastFlip: signal.lastFlip });
  }
  candidates.sort((a, b) => Math.abs(a.errorPct) - Math.abs(b.errorPct));
  const matching = candidates.filter(c => c.state === ref.state);
  const shared = matching.filter(c => sharedLengths.includes(c.atrLength) && c.factor >= 2 && c.factor <= 5);
  const row = { ...ref, candles: candles.length, best: matching[0] ?? null, shared: shared[0] ?? null, alternatives: matching.slice(0, 8), candidates };
  console.log(ref.asset, JSON.stringify({ target: ref.target, best: row.best, shared: row.shared }));
  return row;
});
fs.writeFileSync(`${root}/daily-patterns.json`, JSON.stringify({ lengths, factors, sharedLengths, results }, null, 2) + "\n");
const price = (v: number) => v < 1 ? v.toPrecision(7) : v.toFixed(3);
const cell = (c: typeof results[number]["best"]) => c ? `${c.atrLength}/${c.factor} → ${price(c.value)} (${c.errorPct.toFixed(2)}%)` : "No matching regime";
let report = "# Independent daily KK Supertrend parameter search\n\nWeekly parameters and every production preset remain unchanged. This extends the September 21 archive analysis with a separate daily-only search. All inputs are the same archived, completed candles; no new API requests were made.\n\nInteger ATR lengths tested: " + lengths.join(", ") + ". Integer multipliers: 1–10. Candidates need at least ATR length + 50 history bars. Ranking requires the screenshot's regime as well as the flip level. Pending bullish counters are treated as still bearish, not as an implemented confirmation rule.\n\nThe compact daily family independently tests ATR 10/15/20/30 and factors 2/3/4/5. It is not restricted to weekly assignments. The wider-grid winner is an exploratory single-level fit, not proof of the chart's formula. Selecting from 160 pairs can overfit; multiple historical reversal references are needed.\n\n| Asset | Screenshot flip | Compact daily family: ATR/factor → flip (error) | Wider-grid closest: ATR/factor → flip (error) | Pending |\n|---|---:|---|---|---|\n";
for (const r of results) report += `| ${r.asset.toUpperCase()} | ${price(r.target)} | ${cell(r.shared)} | ${cell(r.best)} | ${r.pending ? `${r.pending}/5` : "—"} |\n`;
report += "\n## Daily-only interpretation\n\nBTC 15/2 remains a reasonable candidate (76,868.64 versus 76,922, -0.07%); 20/2 is numerically closer but that small difference does not identify the original settings. SOL 10/2 and XMR 10/3 already fit within 0.5%. In the compact daily family, multiplier 4 fits ETH/LINK/BNB/SNDK/Gold within 1%; multiplier 5 fits ADA/GOOGL within 0.2%; multiplier 3 fits JUP/ATOM/ZEC/BMNR within 1%. These are descriptive candidate groups, not established rules.\n\nDOGE, DOT, HYPE and Silver get much closer outside the compact family, but those individual winners need independent references before adopting their more scattered settings. SUI, OP, TSLA, SPCX and MU still have over 3% error even at the best tested same-regime pair. Pending confirmation labels additionally prevent treating BONK/NVDA's numeric matches as full behavioral matches. No daily preset is installed by this exploratory report.\n\n## Limitations\n\nThese values use the screenshot venue (or documented proxy), not necessarily the app's default exchange. Futures rolls, short stock history, sparse JUP bars and limited Kraken history still apply; see REPORT.md. One numeric target does not identify both ATR length and factor uniquely. The confirmation counters cannot be reproduced merely by choosing parameters. No market-cap classifications can be inferred from this selected sample or from unit prices.\n";
fs.writeFileSync(`${root}/DAILY-PATTERNS.md`, report);
