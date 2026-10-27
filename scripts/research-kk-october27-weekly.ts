/** Weekly KK review on completed weeks only. No application or D1 writes. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { aggregateWeekly } from "../lib/market-data.ts";
import { aggregateStockWeeks } from "../lib/stocks.ts";
import { aggregateCommodityWeeks } from "../lib/commodities.ts";
import { backtest, calculateIndicators, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions, type KkPreset } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";

const root = "research/kk-2026-10-27/weekly", daily = "research/kk-2026-10-27/daily";
const baseline = "research/kk-2026-10-19/weekly";
const images = "/home/kos/Downloads/TradingView-MoneyLine-39-weekly-charts-2-years-2026-10-27";
const DAY = 86_400_000, cutoff = Date.UTC(2026, 9, 26), capturedAt = Date.UTC(2026, 9, 26, 23, 10);
const read = (path: string) => JSON.parse(fs.readFileSync(path, "utf8"));
const hash = (path: string) => createHash("sha256").update(fs.readFileSync(path)).digest("hex");
const day = (time: number | null) => time == null ? null : new Date(time).toISOString().slice(0, 10);
type Observation = { asset: string; assetClass: "crypto" | "stock" | "commodity"; image: string; imageSha256: string; target: number; targetState: "bull" | "bear"; chartLastFlipPrice: number; chartLastFlipDate: string; fixture: string; pendingDirection?: string | null; pendingCount?: number | null };
const options = (o: Observation) => (o.assetClass === "crypto" ? { asset: o.asset } : o.assetClass === "stock" ? { market: "equity", stock: o.asset } : { market: "commodity", commodity: o.asset }) as IndicatorCalculationOptions;
const changedLevels: Record<string, number> = { xmr: 475.78, sui: .79803, qnt: 268.13, googl: 377.60, intc: 119.04, gold: 4535.4, silver: 69.420 };
fs.mkdirSync(root, { recursive: true });
const charts: Observation[] = read(`${baseline}/observations.json`).charts.map((o: Observation, index: number) => {
  const image = fs.readdirSync(images).find(name => name.startsWith(`${String(index + 1).padStart(2, "0")}-`) && name.endsWith(".jpg"))!;
  const fixture = read(`${daily}/observations.json`).charts.find((c: Observation) => c.asset === o.asset).fixture;
  return { ...o, image, imageSha256: hash(`${images}/${image}`), fixture, target: changedLevels[o.asset] ?? o.target,
    targetState: ["qnt", "gold"].includes(o.asset) ? "bear" : o.targetState,
    chartLastFlipPrice: o.asset === "qnt" ? 189.98 : o.asset === "gold" ? 4012.2 : o.chartLastFlipPrice,
    chartLastFlipDate: o.asset === "qnt" ? "2026-10-26" : o.asset === "gold" ? "2026-10-25" : o.chartLastFlipDate,
    pendingDirection: o.asset === "tsla" ? "bull" : null, pendingCount: o.asset === "tsla" ? 1 : null };
});
fs.writeFileSync(`${root}/observations.json`, JSON.stringify({ archive: images.split("/").at(-1), captureDate: "2026-10-27", captureDateUTC: "2026-10-26", reviewedAt: "2026-10-27", captureClockUTC: "23:10–23:15", timeframe: "1w", comparison: "Completed weeks through October 19. The October 26 week is forming, including TSLA Bullish 1/1; never count it as a confirmed flip.", chartFlipDateConvention: "Next week's open/date after the completed flip week. Futures use Sunday labels, normalized forward to Monday for comparison.", charts }, null, 2) + "\n");
function weeks(candles: Candle[], o: Observation, end: number, asOf: number) {
  const completed = candles.filter(c => c.complete && c.time < end);
  return (o.assetClass === "crypto" ? aggregateWeekly(completed) : o.assetClass === "stock" ? aggregateStockWeeks(completed, asOf) : aggregateCommodityWeeks(completed, asOf)).filter(c => c.time < end);
}
function nextWeekLabel(date: string, commodity: boolean) {
  let t = Date.parse(`${date}T00:00:00Z`);
  if (commodity && new Date(t).getUTCDay() === 0) t += DAY;
  return day(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY);
}
const weekCache = new Map<string, Candle[]>();
function replay(o: Observation, fixture: string, end: number, asOf: number, preset: KkPreset) {
  const key = `${fixture}:${end}:${asOf}`;
  let candles = weekCache.get(key);
  if (!candles) { candles = weeks(read(fixture).candles, o, end, asOf); weekCache.set(key, candles); }
  const signal = calculateIndicators(candles, "1w", { ...options(o), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: preset.atrLength, kkSupertrendFactor: preset.factor })[0];
  const next = signal.lastFlip == null ? null : day(signal.lastFlip + 7 * DAY);
  return { candles, signal, check: { fixture, throughWeek: day(candles.at(-1)!.time), target: o.target, targetState: o.targetState, targetLastFlip: o.chartLastFlipDate, value: signal.values.supertrend!, state: signal.state, errorPct: 100 * (signal.values.supertrend! / o.target - 1), lastFlipWeek: day(signal.lastFlip), entryWeek: next, flipWeekMatches: next === nextWeekLabel(o.chartLastFlipDate, o.assetClass === "commodity") } };
}
type ReviewRow = {
  asset: string; assetClass: Observation["assetClass"]; fixture: string; fixtureSha256: string; preset: KkPreset;
  previousTarget: number; previousState: string; target: number; targetState: string;
  checks: (ReturnType<typeof replay>["check"] & { date: string })[];
  allLevelsFit: boolean; allFlipWeeksMatch: boolean; backtest: unknown; familyFits: KkPreset[];
  alternateFeeds: { source: string; fixtureSha256: string; check: ReturnType<typeof replay>["check"] }[];
};
const rows: ReviewRow[] = [];
for (const o of charts) {
  const preset = kkSupertrendPreset("1w", options(o)), { candles, signal, check } = replay(o, o.fixture, cutoff, capturedAt, preset);
  assert.equal(check.throughWeek, "2026-10-19", o.asset);
  const priorCharts: Observation[] = ["2026-10-16", "2026-10-19"].map(date => read(`research/kk-${date}/weekly/observations.json`).charts.find((c: Observation) => c.asset === o.asset));
  const checks = priorCharts.map((old, i) => ({ date: i === 0 ? "2026-10-16" : "2026-10-19", ...replay(old, old.fixture, i === 0 ? Date.UTC(2026, 9, 12) : Date.UTC(2026, 9, 19), i === 0 ? Date.UTC(2026, 9, 16, 14, 34) : Date.UTC(2026, 9, 19, 19), preset).check }));
  checks.push({ date: "2026-10-27", ...check });
  const research = buildResearch(candles, [signal], "kk_supertrend", "1w", { market: options(o).market ?? "crypto" });
  const row = { asset: o.asset, assetClass: o.assetClass, fixture: o.fixture, fixtureSha256: hash(o.fixture), preset, previousTarget: priorCharts[1].target, previousState: priorCharts[1].targetState, target: o.target, targetState: o.targetState, checks,
    allLevelsFit: checks.every(c => c.state === c.targetState && Math.abs(c.errorPct) < 1), allFlipWeeksMatch: checks.every(c => c.flipWeekMatches),
    backtest: { periodsPerYear: research.periodsPerYear, costs: [5, 15, 30].map(costBps => ({ costBps, ...backtest(candles, [signal], "1w", costBps, { market: options(o).market ?? "crypto" })[0] })), buyAndHold: research.benchmark?.summary ?? null, rolling: research.rolling },
    // A shared class-wide grid, not 39 independently fitted presets.
    familyFits: [] as KkPreset[], alternateFeeds: [] as { source: string; fixtureSha256: string; check: ReturnType<typeof replay>["check"] }[] };
  const alternate = ({ ray: "binance", ada: "binance", hype: "kucoin", xmr: "kucoin" } as Record<string, string>)[o.asset];
  const alternateFile = alternate ? `${root}/${o.asset}-${alternate}-daily.json` : null;
  if (alternateFile && fs.existsSync(alternateFile)) row.alternateFeeds.push({ source: alternate, fixtureSha256: hash(alternateFile), check: replay(o, alternateFile, cutoff, capturedAt, preset).check });
  if (process.argv.includes("--search")) {
    for (const atrLength of [5, 10, 12, 14, 15, 16, 20, 25, 30]) for (const factor of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      const candidate = { atrLength, factor };
      const refs = [...priorCharts.map((old, i) => ({ o: old, end: i === 0 ? Date.UTC(2026, 9, 12) : Date.UTC(2026, 9, 19), asOf: i === 0 ? Date.UTC(2026, 9, 16, 14, 34) : Date.UTC(2026, 9, 19, 19) })), { o, end: cutoff, asOf: capturedAt }];
      if (refs.every(ref => { const c = replay(ref.o, ref.o.fixture, ref.end, ref.asOf, candidate).check; return c.state === c.targetState && Math.abs(c.errorPct) < 1 && c.flipWeekMatches; })) row.familyFits.push(candidate);
    }
  }
  rows.push(row);
  console.log(`${o.asset}: ${preset.atrLength}/${preset.factor}, ${check.value.toPrecision(8)} ${check.state}, ${check.errorPct.toFixed(2)}%, flip week ${check.flipWeekMatches}`);
}
const groups = ["crypto", "stock", "commodity"].map(assetClass => {
  const relevant = rows.filter(r => r.assetClass === assetClass && (assetClass !== "crypto" || r.preset.atrLength === 15));
  const scores = new Map<string, number>();
  for (const row of relevant) for (const fit of row.familyFits) { const key = `${fit.atrLength}/${fit.factor}`; scores.set(key, (scores.get(key) ?? 0) + 1); }
  return { assetClass, assets: relevant.map(r => r.asset), ranking: [...scores].map(([preset, matches]) => ({ preset, matches })).sort((a, b) => b.matches - a.matches) };
});
fs.writeFileSync(`${root}/review.json`, JSON.stringify({ rows, familySearch: { atrLengths: [5, 10, 12, 14, 15, 16, 20, 25, 30], factors: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], requirement: "All three archived weekly batches: correct state, trail within 1%, and flip entry week", groups } }, null, 2) + "\n");
console.log("Summary", JSON.stringify({ latestFits: rows.filter(r => { const c = r.checks.at(-1)!; return c.state === c.targetState && Math.abs(c.errorPct) < 1; }).length, allBatchesFits: rows.filter(r => r.allLevelsFit).length, flipWeeks: rows.filter(r => r.checks.at(-1)!.flipWeekMatches).length, groups }));
