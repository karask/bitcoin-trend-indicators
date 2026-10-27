/** Reproducible October 27 daily screenshot review. No production presets or data are
 * modified. Run after fetch-kk-october27.ts --fetch; add --search for the grid. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { backtest, calculateIndicators, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions, type KkPreset } from "../lib/regimes.ts";
import type { AssetId } from "../lib/markets.ts";
import type { StockId } from "../lib/stocks.ts";
import type { CommodityId } from "../lib/commodities.ts";
import { openCandleConfirmationCount } from "../lib/kk-confirmation.ts";
import { buildResearch } from "../lib/research.ts";

const root = "research/kk-2026-10-27/daily", baseline = "research/kk-2026-10-24/daily";
const images = "/home/kos/Downloads/TradingView-MoneyLine-39-daily-charts-6-months-2026-10-27";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const day = (t: number | null) => t == null ? null : new Date(t).toISOString().slice(0, 10);
type Observation = { asset: string; assetClass: "crypto" | "stock" | "commodity"; image: string; imageSha256: string; target: number; targetState: "bull" | "bear"; targetLastFlip: string; chartLastFlipPrice: number; pendingDirection: "bull" | "bear" | null; pendingCount: number | null; chartClose: number | null; through: string; fixture: string };
const levels: Record<string, number> = { link: 14.183, sui: 1.15943, avax: 11.0109, googl: 360.66, meta: 740.56, gold: 4369.3, silver: 63.775 };
const counts: Record<string, number> = { btc: 3, eth: 3, sol: 1, doge: 5, jup: 2, op: 4, ray: 1, bmnr: 1, amd: 3 };
const closes: Record<string, number> = { btc: 79633.69, eth: 2301.04, sol: 99.82, doge: .076855, link: 11.249, xmr: 597.62, sui: .90432, jup: .2750, op: .11018, bonk: .0000029958, ada: .20386, atom: 1.6236, hype: 77.461, dot: 1.0000, bnb: 739.08, zec: 1213.77, avax: 8.8644, ray: 1.7986, vvv: 24.802, qnt: 201.32, tsla: 391.62, googl: 316.80, nvda: 216, spcx: 146.90, mu: 903.70, sndk: 1255.58, bmnr: 20.95, mstr: 139.82, crcl: 79.84, intc: 90.47, mrvl: 233.78, amd: 531.28, amzn: 249.09, meta: 630.56, bot: 23.94, pltr: 198.84, gold: 4025.6, silver: 53.970 };
const optionsFor = (o: Pick<Observation, "asset" | "assetClass">): IndicatorCalculationOptions => o.assetClass === "crypto" ? { asset: o.asset as AssetId } : o.assetClass === "stock" ? { market: "equity", stock: o.asset as StockId } : { market: "commodity", commodity: o.asset as CommodityId };
fs.mkdirSync(root, { recursive: true });
const charts: Observation[] = read(`${baseline}/observations.json`).charts.map((old: Observation, i: number) => {
  const image = fs.readdirSync(images).find(name => name.startsWith(`${String(i + 1).padStart(2, "0")}-`) && name.endsWith(".jpg"))!;
  const fixture = fs.readdirSync(root).find(name => name.startsWith(`${old.asset}-`) && name.endsWith(".json") && (old.asset !== "jup" || name === "jup-binance.json"));
  if (!fixture) throw new Error(`Missing fixture for ${old.asset}; fetch tails first`);
  return { ...old, image, imageSha256: sha(fs.readFileSync(`${images}/${image}`)), target: levels[old.asset] ?? old.target, targetState: old.targetState, targetLastFlip: old.targetLastFlip, chartLastFlipPrice: old.chartLastFlipPrice, pendingDirection: counts[old.asset] ? "bear" : null, pendingCount: counts[old.asset] ?? null, chartClose: closes[old.asset] ?? null, through: old.assetClass === "crypto" ? "2026-10-25" : "2026-10-26", fixture: `${root}/${fixture}` };
});
fs.writeFileSync(`${root}/observations.json`, JSON.stringify({ archive: images.split("/").at(-1), captureDate: "2026-10-27", captureDateUTC: "2026-10-26", reviewedAt: "2026-10-27", timeframe: "1d", captureClockUTC: "23:05–23:10", comparison: "Crypto through completed October 25; stocks through completed October 26; COMEX October 26 session closed, October 27 forming. Conservative app futures cutoff October 23 is diagnosed separately.", pendingCountConvention: "Only crypto includes the forming October 26 candle. Completed stock session is counted once; no invented October 27 US session.", feeds: "Composite CRYPTO USD except Binance JUP/USDT and HYPEHUSD; NASDAQ/NYSE equities; COMEX GC1!/SI1! continuous futures, not spot.", charts }, null, 2) + "\n");

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
  const previousReview = read(`${baseline}/review.json`).find((r: { asset: string }) => r.asset === o.asset);
  const old: Observation = read(`${baseline}/observations.json`).charts.find((c: Observation) => c.asset === o.asset);
  const refs: Ref[] = previousReview.current.checks.map((c: { date: string; fixture: string; through: string; target: number; targetState: string; targetLastFlip: string | null; chartPendingCount: number }) => ({
    date: c.date, fixture: c.fixture, candles: (read(c.fixture).candles as Candle[]).filter(x => x.complete && day(x.time)! <= c.through),
    target: c.target, targetState: c.targetState, targetLastFlip: c.targetLastFlip, chartPendingCount: c.chartPendingCount || null,
    pendingIncludesForming: !!c.chartPendingCount && (o.assetClass === "crypto" || (o.assetClass === "commodity" && c.date < "2026-10-22") || ["2026-10-12", "2026-10-16", "2026-10-19"].includes(c.date)),
    formingPrice: c.date === "2026-10-24" && o.assetClass === "crypto" ? old.chartClose ?? undefined : undefined,
  }));
  const fixture = read(o.fixture), candles = fixture.candles as Candle[];
  if (day(candles.at(-1)!.time) !== o.through || candles.some(c => !c.complete || day(c.time)! > o.through)) throw new Error(`Invalid cutoff: ${o.asset}`);
  refs.push({ date: "2026-10-27", fixture: o.fixture, candles, target: o.target, targetState: o.targetState, targetLastFlip: o.targetLastFlip, chartPendingCount: o.pendingCount, formingPrice: o.assetClass === "crypto" ? o.chartClose ?? undefined : undefined });
  const preset = kkSupertrendPreset("1d", optionsFor(o));
  const fastReplays = refs.map(ref => preparedReplay(ref.candles));
  const score = (p: KkPreset) => {
    const checks = refs.map(ref => {
      const kk = calculateIndicators(ref.candles, "1d", { ...optionsFor(o), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: p.atrLength, kkSupertrendFactor: p.factor })[0];
      const price = ref.formingPrice;
      // Earlier archives lack the forming quote. Do not invent it: pending
      // counts there are compared as completed closes + one only when printed.
      const chartCount = price != null ? openCandleConfirmationCount(kk, { price, time: ref.date === "2026-10-27" ? Date.UTC(2026, 9, 26, 23, 5) : Date.UTC(2026, 9, 24, 9, 15) }) : (kk.confirmation!.count + (ref.pendingIncludesForming ? 1 : 0));
      const i = kk.lastFlip == null ? -1 : ref.candles.findIndex(c => c.time === kk.lastFlip);
      const nextSession = i >= 0 ? ref.candles[i + 1]?.time : undefined;
      const printedFlip = kk.lastFlip == null ? null : o.assetClass === "crypto" || o.assetClass === "commodity" ? day(kk.lastFlip + 86_400_000) : nextSession == null ? null : day(nextSession);
      return { date: ref.date, fixture: ref.fixture, through: day(ref.candles.at(-1)!.time), target: ref.target, targetState: ref.targetState, targetLastFlip: ref.targetLastFlip, chartPendingCount: ref.chartPendingCount ?? 0, value: kk.values.supertrend!, state: kk.state, errorPct: 100 * (kk.values.supertrend! / ref.target - 1), lastFlip: day(kk.lastFlip), nextBarFlip: printedFlip, confirmationCount: kk.confirmation!.count, asCapturedCount: chartCount ?? kk.confirmation!.count, flipDateMatches: ref.targetLastFlip == null || printedFlip === ref.targetLastFlip || day(kk.lastFlip) === ref.targetLastFlip };
    });
    const worst = Math.max(...checks.map(c => c.state === c.targetState ? Math.abs(c.errorPct) : Infinity));
    return { ...p, maxErrorPct: Number.isFinite(worst) ? worst : null, stateMatches: checks.every(c => c.state === c.targetState), levelFits: worst < 1, allPendingMatch: checks.every(c => c.asCapturedCount === c.chartPendingCount), allFlipDatesMatch: checks.every(c => c.flipDateMatches), checks };
  };
  const current = score(preset);
  const strictCandles = o.assetClass === "commodity" ? candles.filter(c => c.time + 86_400_000 <= Date.UTC(2026, 9, 26, 23, 5)) : null;
  const strictSignal = strictCandles ? calculateIndicators(strictCandles, "1d", { ...optionsFor(o), indicatorIds: ["kk_supertrend"] })[0] : null;
  const availabilityComparison = strictSignal && strictCandles ? { convention: "Production conservative 00:00 UTC completion policy at the actual capture time", through: day(strictCandles.at(-1)!.time), value: strictSignal.values.supertrend!, state: strictSignal.state, errorPct: 100 * (strictSignal.values.supertrend! / o.target - 1) } : null;
  for (const [i, c] of current.checks.entries()) {
    const fast = fastReplays[i](preset);
    assert.equal(fast.value, c.value, `${o.asset}: fast level`);
    assert.equal(fast.state, c.state, `${o.asset}: fast state`);
    assert.equal(fast.count, c.confirmationCount, `${o.asset}: fast count`);
    assert.equal(fast.lastFlip, c.lastFlip, `${o.asset}: fast flip`);
  }
  const hypotheses = [preset, { atrLength: 70, factor: 4 }, { atrLength: 27, factor: 3.9 }, { atrLength: 30, factor: 4 }, { atrLength: 15, factor: 2 }, ...(o.asset === "silver" ? [{ atrLength: 110, factor: 5 }, { atrLength: 115, factor: 5.3 }] : [])].filter((p, i, ps) => ps.findIndex(x => x.atrLength === p.atrLength && x.factor === p.factor) === i).map(score);
  const result = { asset: o.asset, assetClass: o.assetClass, source: fixture.source, fixture: o.fixture, fixtureSha256: sha(fs.readFileSync(o.fixture)), previousTarget: old.target, target: o.target, targetState: o.targetState, preset, current, availabilityComparison, hypotheses, candidates: [] as ReturnType<typeof score>[], fineConsistent: [] as ReturnType<typeof score>[], fineBestReplay: null as ReturnType<typeof score> | null, grid: { coarseTested: 0, fineTested: 0, fineLevelFits: 0, fineBest: null as null | { atrLength: number; factor: number; maxErrorPct: number; stateMatches: boolean } }, backtests: [] as unknown[] };
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
  console.log(`${o.asset}: ${preset.atrLength}/${preset.factor}, latest ${current.checks.at(-1)!.value.toPrecision(8)} ${current.checks.at(-1)!.state} (${current.checks.at(-1)!.errorPct.toFixed(2)}%), all-batches ${current.maxErrorPct == null ? "wrong state" : current.maxErrorPct.toFixed(2) + "%"}, fits ${result.candidates.length}`);
}
fs.writeFileSync(`${root}/review.json`, JSON.stringify(rows, null, 2) + "\n");

console.log("Summary", JSON.stringify({ latestStates: rows.filter(r => r.current.checks.at(-1)!.state === r.targetState).length, latestFits: rows.filter(r => { const c = r.current.checks.at(-1)!; return c.state === r.targetState && Math.abs(c.errorPct) < 1; }).length, allBatchesFits: rows.filter(r => r.current.levelFits).length }));
