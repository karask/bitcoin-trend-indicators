/** Archive approved daily families against the original completed-candle fixtures. */
import fs from "node:fs";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, KK_SUPERTREND_COMMODITY_PRESETS, type Candle } from "../lib/regimes.ts";
const root = "research/kk-2026-09-21-archives";
type Ref = { asset: string; source: string; timeframe: string; target: number; pending?: number; state: string; previous: { atrLength: number; factor: number } };
const refs = (JSON.parse(fs.readFileSync(`${root}/results.json`, "utf8")) as Ref[]).filter(r => r.timeframe === "1d" && !["sui", "op"].includes(r.asset));
const presets = { ...KK_SUPERTREND_PRESETS, ...KK_SUPERTREND_STOCK_PRESETS, ...KK_SUPERTREND_COMMODITY_PRESETS };
const rows = refs.map(r => {
  const preset = presets[r.asset as keyof typeof presets]["1d"];
  const metal = r.asset === "gold" || r.asset === "silver";
  const candles: Candle[] = JSON.parse(fs.readFileSync(`${root}/${r.asset}-${r.source}${metal ? "-futures" : ""}.json`, "utf8")).candles;
  const signal = calculateIndicators(candles, "1d", { indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: preset.atrLength, kkSupertrendFactor: preset.factor })[0];
  return { asset: r.asset, source: r.source, previous: r.previous, preset, target: r.target, targetState: r.state, value: signal.values.supertrend!, state: signal.state, errorPct: 100 * (signal.values.supertrend! / r.target - 1), pending: r.pending ?? null };
});
fs.writeFileSync("lib/kk-daily-evidence.ts", "/** Approved daily-only compact families, September 22, 2026. Approximate fits, not private-formula replication. */\nexport const KK_DAILY_EVIDENCE = " + JSON.stringify(rows, null, 2) + " as const;\n");
let report = "# Applied daily KK Supertrend families — September 22, 2026\n\nSupersedes the exploratory no-change decisions in REPORT.md and DAILY-PATTERNS.md for these daily assets only. Weekly presets and every other indicator are unchanged. Crypto family: 15/2, 15/3, 15/4, 15/5. Stocks: 15/3, 15/4, 30/2, 30/4. Commodities: 15/3, 15/4.\n\nSUI/OP retain 10/3 because no matching grouped calibration was found. AVAX/MSTR retain 10/3 because no daily screenshot was supplied. No confirmation-counter rule is introduced. Numeric fits are approximate; actual errors are below. Fits use archived screenshot venues, not necessarily the default app exchange.\n\n| Asset | Previous → applied | Image flip | Calculated flip | Error | Confirmation unresolved |\n|---|---|---:|---:|---:|---|\n";
for (const r of rows) report += `| ${r.asset.toUpperCase()} | ${r.previous.atrLength}/${r.previous.factor} → ${r.preset.atrLength}/${r.preset.factor} | ${r.target} | ${Number(r.value.toPrecision(8))} | ${r.errorPct.toFixed(2)}% | ${r.pending ? `${r.pending}/5` : "—"} |\n`;
fs.writeFileSync(`${root}/DAILY-APPLIED.md`, report);
