/** Reproducible daily-only screenshot review. No production presets or data are
 * modified. Run after fetch-kk-october24.ts --fetch; add --search for the grid. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { KK_OCTOBER19_EVIDENCE } from "../lib/kk-october19-evidence.ts";
import { backtest, calculateIndicators, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions, type KkPreset } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";
import { openCandleConfirmationCount } from "../lib/kk-confirmation.ts";
import { buildResearch } from "../lib/research.ts";

const root = "research/kk-2026-10-24/daily", baseline = "research/kk-2026-10-22/daily";
const images = "/home/kos/Downloads/TradingView-MoneyLine-39-daily-charts-6-months-2026-10-24";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const day = (t: number | null) => t == null ? null : new Date(t).toISOString().slice(0, 10);
type Observation = { asset: string; assetClass: "crypto" | "stock" | "commodity"; image: string; imageSha256: string; target: number; targetState: "bull" | "bear"; targetLastFlip: string; chartLastFlipPrice: number; pendingDirection: "bull" | "bear" | null; pendingCount: number | null; chartClose: number; through: string; fixture: string };
const levels: Record<string, number> = { link: 15.073, sui: 1.27540, avax: 11.3733, qnt: 235.60, intc: 105.80, meta: 757.70, gold: 4454.4, silver: 66.090 };
const counts: Record<string, number> = { btc: 1, eth: 1, doge: 3, op: 2, hype: 1, ray: 2, sndk: 1, amd: 2 };
const closes: Record<string, number> = { btc: 80557.13, eth: 2362.80, sol: 101.64, doge: .077331, link: 11.575, xmr: 588.65, sui: .94339, jup: .2934, op: .11225, bonk: .0000030255, ada: .20734, atom: 1.6466, hype: 75.365, dot: 1.0562, bnb: 732.52, zec: 1155.04, avax: 8.8867, ray: 1.7931, vvv: 24.202, qnt: 178.56, tsla: 372.22, googl: 320.21, nvda: 210.96, spcx: 147.49, mu: 877.55, sndk: 1238.03, bmnr: 22.40, mstr: 146.01, crcl: 85.91, intc: 86.96, mrvl: 228.51, amd: 516.79, amzn: 248, meta: 642.62, bot: 22.97, strc: 99.36, pltr: 196.75, gold: 4010.0, silver: 53.960 };
const optionsFor = (o: Pick<Observation, "asset" | "assetClass">): IndicatorCalculationOptions => o.assetClass === "crypto" ? { asset: o.asset as AssetId } : o.assetClass === "stock" ? { market: "equity", stock: o.asset as StockId } : { market: "commodity", commodity: o.asset as CommodityId };
fs.mkdirSync(root, { recursive: true });
const charts: Observation[] = read(`${baseline}/observations.json`).charts.map((old: Observation, i: number) => {
  const image = fs.readdirSync(images).find(name => name.startsWith(`${String(i + 1).padStart(2, "0")}-`) && name.endsWith(".jpg"))!;
  const fixture = fs.readdirSync(root).find(name => name.startsWith(`${old.asset}-`) && name.endsWith(".json") && (old.asset !== "jup" || name === "jup-binance.json"));
  if (!fixture) throw new Error(`Missing fixture for ${old.asset}; fetch tails first`);
  return { ...old, image, imageSha256: sha(fs.readFileSync(`${images}/${image}`)), target: levels[old.asset] ?? old.target, targetState: old.asset === "meta" ? "bear" : old.targetState, targetLastFlip: old.asset === "meta" ? "2026-10-23" : old.targetLastFlip, chartLastFlipPrice: old.asset === "meta" ? 638.17 : old.chartLastFlipPrice, pendingDirection: counts[old.asset] ? "bear" : null, pendingCount: counts[old.asset] ?? null, chartClose: closes[old.asset], through: "2026-10-23", fixture: `${root}/${fixture}` };
});
fs.writeFileSync(`${root}/observations.json`, JSON.stringify({ archive: images.split("/").at(-1), captureDate: "2026-10-24", reviewedAt: "2026-10-25", timeframe: "1d", captureClockUTC: "09:03–09:22", comparison: "All assets through the completed October 23 candle. Crypto October 24 is forming; stocks and COMEX futures are closed for Saturday.", pendingCountConvention: "Crypto adds the forming candle where the chart quote is beyond the trail. Closed stock/futures sessions have no forming Saturday candle.", feeds: "Composite CRYPTO USD except Binance JUP/USDT and HYPEHUSD; NASDAQ/NYSE equities; COMEX GC1!/SI1! continuous futures, not spot.", charts }, null, 2) + "\n");

type Ref = { date: string; fixture: string; candles: Candle[]; target: number; targetState: string; targetLastFlip: string | null; chartPendingCount: number | null; pendingIncludesForming?: boolean; formingPrice?: number };
/** Allocation-light research replay. Every retained candidate is rechecked
 * through calculateIndicators; the production implementation is authoritative. */
function preparedReplay(candles: Candle[]) {
  const ranges = candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
  const cache = new Map<number, Float64Array>();
  return ({ atrLength: n, factor }: KkPreset) => {
    let atr = cache.get(n);
    if (!atr) {
      atr = new Float64Array(candles.length);
      let seed = 0;
      for (let i = 0; i < n; i++) seed += ranges[i];
      atr[n - 1] = seed / n;
      for (let i = n; i < candles.length; i++) atr[i] = (atr[i - 1] * (n - 1) + ranges[i]) / n;
      cache.set(n, atr);
    }
    let state: "bull" | "bear" = "bear", count = 0, level = NaN, upper = NaN, lower = NaN, flip = -1;
    for (let i = n - 1; i < candles.length; i++) {
      const c = candles[i], hl2 = (c.high + c.low) / 2, bu = hl2 + factor * atr[i], bl = hl2 - factor * atr[i];
      if (Number.isNaN(level)) { upper = bu; lower = bl; level = bu; }
      else {
        upper = bu < upper || candles[i - 1].close > upper ? bu : upper;
        lower = bl > lower || candles[i - 1].close < lower ? bl : lower;
        if (count === 0) level = state === "bull" ? Math.max(level, bl) : Math.min(level, bu);
        count = (state === "bull" ? c.close < level : c.close > level) ? count + 1 : 0;
        if (count === 5) { state = state === "bull" ? "bear" : "bull"; level = state === "bull" ? lower : upper; count = 0; flip = i; }
      }
    }
    return { value: level, state, count, lastFlip: flip < 0 ? null : day(candles[flip].time), flipIndex: flip };
  };
}
const rows = [];
for (const o of charts) {
  const refs: Ref[] = KK_OCTOBER19_EVIDENCE.find(row => row.asset === o.asset)!.checks.map(c => ({ date: c.date, fixture: c.fixture, candles: (read(c.fixture).candles as Candle[]).filter(x => x.complete && day(x.time)! <= c.through), target: c.target, targetState: c.targetState, targetLastFlip: c.targetLastFlip, chartPendingCount: c.chartPending == null ? null : +c.chartPending.split(" ")[1].split("/")[0], pendingIncludesForming: c.chartPending != null && (o.assetClass === "crypto" || o.assetClass === "commodity" || ["2026-10-12", "2026-10-16", "2026-10-19"].includes(c.date)) }));
  const old: Observation = read(`${baseline}/observations.json`).charts.find((c: Observation) => c.asset === o.asset);
  const oldFile = fs.readdirSync(baseline).find(name => name.startsWith(`${o.asset}-`) && name.endsWith(".json") && (o.asset !== "jup" || name === "jup-binance.json"))!;
  refs.push({ date: "2026-10-22", fixture: `${baseline}/${oldFile}`, candles: read(`${baseline}/${oldFile}`).candles, target: old.target, targetState: old.targetState, targetLastFlip: old.targetLastFlip, chartPendingCount: old.pendingCount, pendingIncludesForming: old.pendingCount != null && o.assetClass === "crypto" });
  const fixture = read(o.fixture), candles = fixture.candles as Candle[];
  if (day(candles.at(-1)!.time) !== o.through || candles.some(c => !c.complete || day(c.time)! > o.through)) throw new Error(`Invalid cutoff: ${o.asset}`);
  refs.push({ date: "2026-10-24", fixture: o.fixture, candles, target: o.target, targetState: o.targetState, targetLastFlip: o.targetLastFlip, chartPendingCount: o.pendingCount, formingPrice: o.assetClass === "crypto" ? o.chartClose : undefined });
  const preset = kkSupertrendPreset("1d", optionsFor(o));
  const fastReplays = refs.map(ref => preparedReplay(ref.candles));
  const score = (p: KkPreset) => {
    const checks = refs.map(ref => {
      const kk = calculateIndicators(ref.candles, "1d", { ...optionsFor(o), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: p.atrLength, kkSupertrendFactor: p.factor })[0];
      const price = ref.formingPrice;
      // Earlier archives lack the forming quote. Do not invent it: pending
      // counts there are compared as completed closes + one only when printed.
      const chartCount = ref.date === "2026-10-24" && price != null ? openCandleConfirmationCount(kk, { price, time: Date.UTC(2026, 9, 24, 9, 15) }) : (kk.confirmation!.count + (ref.pendingIncludesForming ? 1 : 0));
      const i = kk.lastFlip == null ? -1 : ref.candles.findIndex(c => c.time === kk.lastFlip);
      const nextSession = i >= 0 ? ref.candles[i + 1]?.time : undefined;
      const printedFlip = kk.lastFlip == null ? null : o.assetClass === "crypto" || o.assetClass === "commodity" ? day(kk.lastFlip + 86_400_000) : nextSession == null ? null : day(nextSession);
      return { date: ref.date, fixture: ref.fixture, through: day(ref.candles.at(-1)!.time), target: ref.target, targetState: ref.targetState, targetLastFlip: ref.targetLastFlip, chartPendingCount: ref.chartPendingCount ?? 0, value: kk.values.supertrend!, state: kk.state, errorPct: 100 * (kk.values.supertrend! / ref.target - 1), lastFlip: day(kk.lastFlip), nextBarFlip: printedFlip, confirmationCount: kk.confirmation!.count, asCapturedCount: chartCount ?? kk.confirmation!.count, flipDateMatches: ref.targetLastFlip == null || printedFlip === ref.targetLastFlip || day(kk.lastFlip) === ref.targetLastFlip };
    });
    const worst = Math.max(...checks.map(c => c.state === c.targetState ? Math.abs(c.errorPct) : Infinity));
    return { ...p, maxErrorPct: Number.isFinite(worst) ? worst : null, stateMatches: checks.every(c => c.state === c.targetState), levelFits: worst < 1, allPendingMatch: checks.every(c => c.asCapturedCount === c.chartPendingCount), allFlipDatesMatch: checks.every(c => c.flipDateMatches), checks };
  };
  const current = score(preset);
  for (const [i, c] of current.checks.entries()) {
    const fast = fastReplays[i](preset);
    assert.equal(fast.value, c.value, `${o.asset}: fast level`);
    assert.equal(fast.state, c.state, `${o.asset}: fast state`);
    assert.equal(fast.count, c.confirmationCount, `${o.asset}: fast count`);
    assert.equal(fast.lastFlip, c.lastFlip, `${o.asset}: fast flip`);
  }
  const hypotheses = [preset, { atrLength: 70, factor: 4 }, { atrLength: 27, factor: 3.9 }, { atrLength: 30, factor: 4 }, { atrLength: 15, factor: 2 }].filter((p, i, ps) => ps.findIndex(x => x.atrLength === p.atrLength && x.factor === p.factor) === i).map(score);
  const result = { asset: o.asset, assetClass: o.assetClass, source: fixture.source, fixture: o.fixture, fixtureSha256: sha(fs.readFileSync(o.fixture)), previousTarget: old.target, target: o.target, targetState: o.targetState, preset, current, hypotheses, candidates: [] as ReturnType<typeof score>[], fineConsistent: [] as ReturnType<typeof score>[], fineBestReplay: null as ReturnType<typeof score> | null, grid: { coarseTested: 0, fineTested: 0, fineLevelFits: 0, fineBest: null as null | { atrLength: number; factor: number; maxErrorPct: number; stateMatches: boolean } }, backtests: [] as unknown[] };
  if (process.argv.includes("--search")) {
    // Keep the existing half-step family first. A fine pass is diagnostic only:
    // a single closer level must not manufacture a new production preset.
    const lengths = [5, 7, 10, 12, 15, 20, 21, 25, 27, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100, 110, 120, 140, 150, 175, 200];
    const fastScore = (p: KkPreset) => {
      let worst = 0, pendingMatches = true, flipDatesMatch = true;
      for (let i = refs.length - 1; i >= 0; i--) {
        const check = fastReplays[i](p), ref = refs[i];
        if (check.state !== ref.targetState) return { maxErrorPct: Infinity, stateMatches: false };
        worst = Math.max(worst, Math.abs(100 * (check.value / ref.target - 1)));
        const openCount = ref.formingPrice == null ? check.count + (ref.pendingIncludesForming ? 1 : 0) : (check.state === "bull" ? ref.formingPrice < check.value : ref.formingPrice > check.value) ? Math.min(5, check.count + 1) : 0;
        pendingMatches &&= openCount === (ref.chartPendingCount ?? 0);
        const next = check.flipIndex < 0 ? null : o.assetClass === "stock" ? day(ref.candles[check.flipIndex + 1]?.time ?? null) : day(ref.candles[check.flipIndex].time + 86_400_000);
        flipDatesMatch &&= ref.targetLastFlip == null || check.lastFlip === ref.targetLastFlip || next === ref.targetLastFlip;
      }
      return { maxErrorPct: worst, stateMatches: true, pendingMatches, flipDatesMatch };
    };
    for (const atrLength of lengths) for (let factor = 1.5; factor <= 8; factor += .5) {
      result.grid.coarseTested++;
      const fast = fastScore({ atrLength, factor });
      if (fast.maxErrorPct < 1) {
        const candidate = score({ atrLength, factor });
        assert.ok(candidate.levelFits, `${o.asset}: candidate production replay`);
        result.candidates.push(candidate);
      }
    }
    result.candidates.sort((a, b) => Number(b.allPendingMatch && b.allFlipDatesMatch) - Number(a.allPendingMatch && a.allFlipDatesMatch) || a.maxErrorPct! - b.maxErrorPct!);
    if (!result.candidates.length || !current.allPendingMatch || !current.levelFits) {
      const fineLengths = [...new Set([...lengths, ...Array.from({ length: 40 }, (_, i) => (i + 1) * 5)])].sort((a, b) => a - b);
      for (const atrLength of fineLengths) for (let tenth = 15; tenth <= 90; tenth++) {
        result.grid.fineTested++;
        const factor = tenth / 10, fast = fastScore({ atrLength, factor });
        if (fast.maxErrorPct < 1) {
          result.grid.fineLevelFits++;
          if (fast.pendingMatches && fast.flipDatesMatch) {
            const replay = score({ atrLength, factor });
            assert.ok(replay.levelFits && replay.allPendingMatch && replay.allFlipDatesMatch, `${o.asset}: fine production replay`);
            result.fineConsistent.push(replay);
          }
        }
        if (Number.isFinite(fast.maxErrorPct) && (result.grid.fineBest == null || fast.maxErrorPct < result.grid.fineBest.maxErrorPct)) result.grid.fineBest = { atrLength, factor, ...fast };
      }
      if (result.grid.fineBest) result.fineBestReplay = score(result.grid.fineBest);
    }
  }
  for (const p of [preset, ...result.candidates.slice(0, 1).map(c => ({ atrLength: c.atrLength, factor: c.factor }))]) {
    const signal = calculateIndicators(candles, "1d", { ...optionsFor(o), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: p.atrLength, kkSupertrendFactor: p.factor });
    const research = buildResearch(candles, signal, "kk_supertrend", "1d", { market: optionsFor(o).market ?? "crypto" });
    result.backtests.push({ preset: p, costs: [5, 15, 30].map(bps => ({ costBps: bps, ...backtest(candles, signal, "1d", bps, { market: optionsFor(o).market ?? "crypto" })[0] })), periodsPerYear: research.periodsPerYear, buyAndHold: research.benchmark?.summary ?? null, rolling: research.rolling });
  }
  rows.push(result);
  console.log(`${o.asset}: ${preset.atrLength}/${preset.factor}, latest ${current.checks.at(-1)!.value.toPrecision(8)} ${current.checks.at(-1)!.state} (${current.checks.at(-1)!.errorPct.toFixed(2)}%), all-eight ${current.maxErrorPct == null ? "wrong state" : current.maxErrorPct.toFixed(2) + "%"}, fits ${result.candidates.length}`);
}
fs.writeFileSync(`${root}/review.json`, JSON.stringify(rows, null, 2) + "\n");

if (process.argv.includes("--search")) {
  const latest = (r: { current: { checks: { state: string; errorPct: number; value: number; chartPendingCount: number; asCapturedCount: number; confirmationCount: number }[] } }) => r.current.checks.at(-1)!;
  const numeric = (n: number) => n < .0001 ? n.toPrecision(8) : n < 1 ? n.toFixed(7).replace(/0+$/, "") : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  const asPreset = (p: KkPreset) => `${p.atrLength}/${p.factor}`;
  const changed = rows.filter(r => r.target !== r.previousTarget);
  const levelFits = rows.filter(r => r.current.levelFits);
  const todayFits = rows.filter(r => latest(r).state === r.targetState && Math.abs(latest(r).errorPct) < 1);
  const currentStates = rows.filter(r => latest(r).state === r.targetState);
  const priorFits = rows.filter(r => r.current.checks.slice(0, -1).every(c => c.state === c.targetState && Math.abs(c.errorPct) < 1));
  const pending = rows.filter(r => latest(r).chartPendingCount);
  const lines = [
    "# Daily KK Supertrend — 24 October 2026 screenshots",
    "",
    "Reviewed on **25 October 2026**. Source: `TradingView-MoneyLine-39-daily-charts-6-months-2026-10-24` in Downloads.",
    "",
    "**39 daily charts: 20 crypto, 17 stocks, 2 COMEX futures. All readable; none skipped and no new assets required.** The gold and silver charts remain GC1!/SI1! futures, not spot. Captures were approximately 09:03–09:22 UTC on Saturday 24 October. All comparisons use completed candles through **23 October**; the forming Saturday crypto candle is used only to check the displayed pending count, never the official signal or backtest.",
    "",
    "**Production presets changed: none.** This is a research review. Weekly KK, other indicators, production databases, and the existing uncommitted October 22 review and overview edits were not changed. No commit, push or deployment was requested or performed.",
    "",
    "## Findings",
    "",
    `- Current daily presets match the latest official state for **${currentStates.length}/39** charts; BONK, TSLA and BOT remain wrong-state cases.`,
    `- Current daily presets match both state and trail within 1% on **${todayFits.length}/39** latest charts.`,
    `- Across the eight October batches (3, 5, 9, 12, 16, 19, 22, 24), **${levelFits.length}/39** current presets keep every scored state and level within 1%, down from **${priorFits.length}/39** before this batch. QNT, GOOGL, META and silver drop out. Silver has seven scored references because its October 3 target was unavailable. This is a level/state statistic, NOT a claim that all historical flip dates match.`,
    "- META has the only newly printed reversal: bearish, labelled 23 October. The app confirms its fifth close on 22 October, consistent with the next-session 23 October label; its new bear trail is nevertheless 8.94% too low.",
    "- The earlier 22 October proposal to change INTC to 70/4 is **not supported** by this batch: it produces 110.7054 versus 105.80 (+4.64%). Keep the production 15/4 pending investigation; its error is +2.89%.",
    "",
    "## Screenshot trail changes since 22 October",
    "",
    "Eight levels moved; the other 31 are unchanged. Only META also changed official state.",
    "",
    "| Asset | 22 Oct chart | 24 Oct chart | Current app calculation | Error |",
    "|---|---:|---:|---:|---:|",
    ...changed.map(r => `| ${r.asset.toUpperCase()} | ${numeric(r.previousTarget)} | ${numeric(r.target)} | ${numeric(latest(r).value)} | ${signed(latest(r).errorPct)} |`),
    "",
    "## Pending confirmations",
    "",
    "Crypto figures below include the forming Saturday candle, exactly as the screenshots do. Stock figures count the closed Friday session only: **no Saturday session is invented**. Both directions still require five consecutive completed closes, resetting on failure.",
    "",
    "| Asset | Screenshot bearish count | App as captured | App completed closes |",
    "|---|---:|---:|---:|",
    ...pending.map(r => `| ${r.asset.toUpperCase()} | ${latest(r).chartPendingCount}/5 | ${latest(r).asCapturedCount}/5 | ${latest(r).confirmationCount}/5 |`),
    "",
    "Seven of the eight printed pending counts match. **BTC does not:** its app trail is 81,620.16 rather than 80,859.48, so two earlier completed closes count as bearish and the open candle makes 3/5 instead of 1/5. SOL, JUP and ADA show no pending count on their charts, but the app's higher thresholds produce 1/5, 1/5 and 3/5 respectively as captured. This shows why a sub-1% level difference can still change reversal timing. These are dated comparisons, not live 25 October signals.",
    "",
    "## Parameter search and decisions",
    "",
    "The search changes only daily KK ATR length and multiplier. Each candidate must replay all archived observations; candidates are never ranked by backtest return. The coarse search uses 26 sampled ATR lengths from 5 to 200 and multipliers 1.5–8 in 0.5 steps (364 settings per asset). A diagnostic pass uses 44 sampled lengths and multipliers 1.5–9 in 0.1 steps on cases needing review. This is a bounded search, **not proof that no other possible setting exists**. Every retained coarse candidate and every fully consistent fine candidate is rechecked with the production indicator engine. Research flip-date checks accept a match on the completed signal bar or next bar/session; both dates remain recorded separately.",
    "",
    "- **XMR:** 30/4 is only +0.05% on the new chart, but its worst earlier error remains 1.13%. The earlier diagnostic 27/3.9 still fits all eight levels (worst 0.66%), counts and date alignment. It is a possible finer fit, not a recovered setting or a new market-cap family. Retained 30/4 to respect the preference for a compact family and avoid another arbitrary decimal exception.",
    "- **Silver:** 120/5.5 is +1.02% on the new chart, only just outside the 1% research threshold. 110/5 keeps all seven levels within 0.98% and retains the chart's printed flip-date alignment; 115/5.3 fits more tightly (worst 0.27%) but is a new decimal setting. Neither is adopted just to cross an arbitrary tolerance boundary. Silver's precise session/date convention remains uncertain.",
    "- **GOOGL:** several settings improve the level (for example 100/5.5), but none of the tested fitting candidates also reproduces the historical June 8 flip. A tighter single line is not enough to justify another setting.",
    "- **BTC and SOL:** alternative settings improve the displayed counts, but the tested level-fitting candidates still miss the historical flip date. Their 15/2 and 15/4 are kept, with the new count discrepancies recorded.",
    "- **QNT and META:** newly expose the same post-flip identification problem already seen on ZEC, SUI, LINK and AVAX. They matched earlier bullish/pending behaviour, but no tested setting now keeps every level within 1% on both sides of the reversal. Their five-close timing can be right while the new opposite trail is wrong. Do not change the confirmation mechanism from a guess.",
    "- **No new market-cap thresholds can be inferred.** Crypto cap tiers remain a fallback, not a demonstrated daily formula. The post-flip discrepancies appear in both crypto and equities, so market cap alone does not explain them. Weekly rules remain separate and untouched.",
    "",
    "**Recommendation:** keep the current family rather than install more screenshot-specific exceptions. The most useful next evidence is the MoneyLine Inputs/settings panel (and, if possible, the indicator version) for one problematic asset such as QNT, META, SUI or LINK, including any separate bull/bear factor or trail-reset controls. More opposite-regime examples can distinguish rules, but these screenshots alone do not identify the private formula.",
    "",
    "## All 39 current presets",
    "",
    "Errors compare completed October 23 candles with the October 24 chart level. Wrong-state lines are not accepted as fits even when their numerical error happens to be small. Last-flip and pending mismatches are retained in review.json.",
    "",
    "| Asset | ATR / factor | Chart state | App state | Chart trail | App trail | Error | Worst across batches |",
    "|---|---|---|---|---:|---:|---:|---:|",
    ...rows.map(r => `| ${r.asset.toUpperCase()} | ${asPreset(r.preset)} | ${r.targetState} | ${latest(r).state} | ${numeric(r.target)} | ${numeric(latest(r).value)} | ${signed(latest(r).errorPct)} | ${r.current.maxErrorPct == null ? "wrong state" : r.current.maxErrorPct.toFixed(2) + "%"} |`),
    "",
    "## Reproduction, execution and evidence",
    "",
    "- `observations.json`: manually read chart levels, state, flip dates, eight pending counters, quote prices and SHA-256 image hashes. Original filenames remain recorded.",
    "- `*-{venue}.json`: archived histories plus only the missing provider tail, ending 23 October. Yahoo split-adjustment overlap was checked before merging. Crypto requests and Yahoo session checks were paced sequentially. `fetch-failures.json` is empty after the completed fetch.",
    "- `review.json`: every baseline replay, all coarse-grid level fits, bounded fine-grid summaries and fully consistent fine candidates. Latest and earlier chart checks are scored with their own dated fixtures, not today's entire history.",
    "- Cost checks use 5/15/30 bps, next-session-open execution and 365 crypto / 252 equity-and-futures periods per year. Buy-and-hold uses the same evaluation window. Rolling four-year results are present where history permits; short listings do not fabricate four years. These backtests are diagnostics only; no return or profitability result selected a calibration.",
    "- Scripts: `node --experimental-strip-types scripts/fetch-kk-october24.ts --fetch`, then `node --experimental-strip-types scripts/research-kk-october24.ts --search`. A rerun reuses downloaded fixtures; no market data is seeded or modified in production.",
    "",
  ];
  fs.writeFileSync(`${root}/REPORT.md`, lines.join("\n"));
}
