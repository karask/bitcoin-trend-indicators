import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { aggregateWeekly } from "../lib/market-data.ts";
import { aggregateStockWeeks } from "../lib/stocks.ts";
import { aggregateCommodityWeeks } from "../lib/commodities.ts";
import { openCandleConfirmationCount } from "../lib/kk-confirmation.ts";
import { KK_OCTOBER19_EVIDENCE } from "../lib/kk-october19-evidence.ts";
import { backtestDetail, calculateIndicators, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions, type KkPreset } from "../lib/regimes.ts";

const root = "research/kk-2026-10-27", DAY = 86_400_000, capture = Date.UTC(2026, 9, 26, 23, 10);
const file = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(file(path), "utf8"));
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const day = (time: number | null) => time == null ? null : new Date(time).toISOString().slice(0, 10);
type Check = { date: string; fixture: string; through: string; throughWeek: string; target: number; targetState: string; value: number; state: string; errorPct: number; lastFlip: string | null; lastFlipWeek: string | null; flipWeekMatches: boolean; confirmationCount: number; asCapturedCount: number; chartPendingCount: number };
type Score = KkPreset & { levelFits: boolean; allPendingMatch: boolean; allFlipDatesMatch: boolean; checks: Check[] };
type Backtest = { periodsPerYear: number; costs: { costBps: number; totalReturn: number; start: number; end: number }[]; buyAndHold: { start: number; end: number } | null; rolling: unknown[] };
type Row = { asset: string; assetClass: "crypto" | "stock" | "commodity"; fixture: string; fixtureSha256: string; preset: KkPreset; previousTarget: number; target: number; targetState: string; current: Score; checks: Check[]; candidates: Score[]; fineConsistent: Score[]; backtests: Backtest[]; backtest: Backtest; alternateFeeds: { source: string; fixtureSha256: string; check: Check }[]; availabilityComparison: { through: string; value: number } | null };
const daily = read(`${root}/daily/review.json`) as Row[], weekly = read(`${root}/weekly/review.json`).rows as Row[];
const options = (row: Row) => (row.assetClass === "crypto" ? { asset: row.asset } : row.assetClass === "stock" ? { market: "equity", stock: row.asset } : { market: "commodity", commodity: row.asset }) as IndicatorCalculationOptions;
const latest = (rows: Row[], asset: string) => { const row = rows.find(r => r.asset === asset)!; return (row.current?.checks ?? row.checks).at(-1)!; };
const fits = (c: Check) => c.state === c.targetState && Math.abs(c.errorPct) < 1;
function weeks(row: Row, fixture: string, cutoff: number, asOf: number) {
  const candles = (read(fixture).candles as Candle[]).filter(c => c.complete && c.time < cutoff);
  return row.assetClass === "crypto" ? aggregateWeekly(candles) : row.assetClass === "stock" ? aggregateStockWeeks(candles, asOf) : aggregateCommodityWeeks(candles, asOf);
}

test("both October 27 folders contain 39 identified, readable charts with archived hashes", () => {
  assert.deepEqual(read(`${root}/daily/fetch-failures.json`), []);
  for (const [frame, rows] of [["daily", daily], ["weekly", weekly]] as const) {
    const o = read(`${root}/${frame}/observations.json`);
    assert.equal(o.captureDate, "2026-10-27");
    assert.equal(o.captureDateUTC, "2026-10-26");
    assert.equal(rows.length, 39);
    assert.equal(o.charts.length, 39);
    assert.equal(new Set(rows.map(r => r.asset)).size, 39);
    assert.deepEqual(["crypto", "stock", "commodity"].map(kind => rows.filter(r => r.assetClass === kind).length), [20, 17, 2]);
    for (const row of rows) {
      assert.equal(sha(readFileSync(file(row.fixture))), row.fixtureSha256, row.asset);
      const obs = o.charts.find((c: { asset: string }) => c.asset === row.asset);
      assert.match(obs.imageSha256, /^[a-f0-9]{64}$/);
      const image = `/home/kos/Downloads/${o.archive}/${obs.image}`;
      if (existsSync(image)) assert.equal(sha(readFileSync(image)), obs.imageSha256, obs.image);
      const fixture = read(row.fixture);
      assert.deepEqual(fixture.quality, { gaps: 0, duplicates: 0, malformed: 0 });
      assert.equal(day(fixture.candles.at(-1).time), row.assetClass === "crypto" ? "2026-10-25" : "2026-10-26");
      assert.ok(fixture.candles.every((c: Candle) => c.complete && c.time < Date.UTC(2026, 9, row.assetClass === "crypto" ? 26 : 27)));
    }
  }
});

test("daily and weekly chart changes, new weekly flips and provisional TSLA are transcribed separately", () => {
  assert.deepEqual(Object.fromEntries(daily.filter(r => r.previousTarget !== r.target).map(r => [r.asset, r.target])), { link: 14.183, sui: 1.15943, avax: 11.0109, googl: 360.66, meta: 740.56, gold: 4369.3, silver: 63.775 });
  const o = read(`${root}/weekly/observations.json`).charts;
  const qnt = o.find((c: { asset: string }) => c.asset === "qnt"), gold = o.find((c: { asset: string }) => c.asset === "gold");
  assert.deepEqual([qnt.target, qnt.targetState, qnt.chartLastFlipDate, qnt.chartLastFlipPrice], [268.13, "bear", "2026-10-26", 189.98]);
  assert.deepEqual([gold.target, gold.targetState, gold.chartLastFlipDate, gold.chartLastFlipPrice], [4535.4, "bear", "2026-10-25", 4012.2]);
  const tsla = o.find((c: { asset: string }) => c.asset === "tsla");
  assert.equal(tsla.targetState, "bear");
  assert.equal(tsla.pendingDirection, "bull");
  assert.equal(tsla.pendingCount, 1);
  assert.equal(latest(weekly, "tsla").state, "bear");
  assert.equal(read(`${root}/daily/observations.json`).charts.find((c: { asset: string }) => c.asset === "strc").chartClose, null);
});

test("all dated daily references replay through the authoritative engine without future candles", () => {
  for (const row of daily) {
    assert.equal(row.current.checks.length, ["link", "gold", "silver"].includes(row.asset) ? 8 : 9);
    for (const c of row.current.checks) {
      const candles = (read(c.fixture).candles as Candle[]).filter(x => x.complete && day(x.time)! <= c.through);
      assert.equal(day(candles.at(-1)!.time), c.through);
      const s = calculateIndicators(candles, "1d", { ...options(row), indicatorIds: ["kk_supertrend"] })[0];
      assert.equal(s.values.supertrend, c.value, `${row.asset} ${c.date}`);
      assert.equal(s.state, c.state);
      assert.equal(day(s.lastFlip), c.lastFlip);
      assert.equal(s.confirmation!.count, c.confirmationCount);
      assert.equal(s.confirmation!.required, 5);
    }
  }
});

test("crypto open counters do not confirm a fifth close; Monday stock closes are counted only once", () => {
  const charts = read(`${root}/daily/observations.json`).charts;
  for (const row of daily.filter(r => r.assetClass === "crypto")) {
    const candles = read(row.fixture).candles as Candle[];
    const signal = calculateIndicators(candles, "1d", { ...options(row), indicatorIds: ["kk_supertrend"] })[0];
    const quote = charts.find((c: { asset: string }) => c.asset === row.asset).chartClose;
    assert.equal(openCandleConfirmationCount(signal, { price: quote, time: capture }), latest(daily, row.asset).asCapturedCount);
  }
  const doge = latest(daily, "doge");
  assert.deepEqual([doge.state, doge.confirmationCount, doge.asCapturedCount, doge.chartPendingCount], ["bull", 4, 5, 5]);
  assert.deepEqual([latest(daily, "btc").asCapturedCount, latest(daily, "btc").chartPendingCount], [5, 3]);
  assert.deepEqual([latest(daily, "sol").asCapturedCount, latest(daily, "sol").chartPendingCount], [2, 1]);
  for (const asset of ["bmnr", "amd"]) assert.equal(latest(daily, asset).asCapturedCount, latest(daily, asset).confirmationCount);
});

test("weekly replays exclude the October 26 week and reproduce both new bear trails", () => {
  for (const row of weekly) for (const c of row.checks) {
    const end = Date.UTC(2026, 9, c.date === "2026-10-16" ? 12 : c.date === "2026-10-19" ? 19 : 26);
    const candles = weeks(row, c.fixture, end, Date.parse(`${c.date}T00:00:00Z`));
    assert.equal(day(candles.at(-1)!.time), c.throughWeek);
    assert.ok(candles.every(x => x.time < end && x.complete));
    const signal = calculateIndicators(candles, "1w", { ...options(row), indicatorIds: ["kk_supertrend"] })[0];
    assert.equal(signal.state, c.state, row.asset);
    assert.equal(signal.values.supertrend, c.value, row.asset);
    assert.equal(day(signal.lastFlip), c.lastFlipWeek);
    if (c.date === "2026-10-27") assert.equal(c.throughWeek, "2026-10-19");
  }
  for (const asset of ["qnt", "gold"]) {
    const c = latest(weekly, asset);
    assert.equal(c.state, "bear");
    assert.equal(c.lastFlipWeek, "2026-10-19");
    assert.ok(c.flipWeekMatches && Math.abs(c.errorPct) < 1);
  }
});

test("venue diagnostics retain the same weekly settings and silver revisions are not silently spliced", () => {
  for (const row of weekly) for (const alt of row.alternateFeeds) {
    assert.equal(sha(readFileSync(file(alt.check.fixture))), alt.fixtureSha256);
    const candles = weeks(row, alt.check.fixture, Date.UTC(2026, 9, 26), capture);
    const s = calculateIndicators(candles, "1w", { ...options(row), indicatorIds: ["kk_supertrend"] })[0];
    assert.equal(s.values.supertrend, alt.check.value);
    assert.equal(s.state, alt.check.state);
    assert.ok(fits(alt.check));
  }
  const silver = read(`${root}/daily/silver-yahoo.json`);
  assert.equal(silver.provenance.revalidation.changed.length, 1);
  const revision = silver.provenance.revalidation.changed[0];
  assert.equal(revision.date, "2026-10-23");
  assert.equal(revision.previous.volume, 57273);
  assert.equal(revision.current.volume, 15);
  assert.equal(revision.current.open, revision.current.close);
  assert.equal(silver.provenance.revalidation.start, "2019-01-02");
  for (const row of daily.filter(r => r.assetClass === "commodity")) {
    assert.equal(row.availabilityComparison!.through, "2026-10-23");
    const candles = (read(row.fixture).candles as Candle[]).filter(c => c.time + DAY <= capture);
    assert.equal(calculateIndicators(candles, "1d", { ...options(row), indicatorIds: ["kk_supertrend"] })[0].values.supertrend, row.availabilityComparison!.value);
  }
});

test("calibration success statistics retain counter/date failures and production presets stay unchanged", () => {
  assert.equal(daily.filter(r => fits(latest(daily, r.asset))).length, 23);
  assert.equal(daily.filter(r => r.current.levelFits).length, 19);
  assert.equal(daily.filter(r => r.current.levelFits && r.current.allPendingMatch && r.current.allFlipDatesMatch).length, 10);
  assert.deepEqual(daily.filter(r => latest(daily, r.asset).state !== r.targetState).map(r => r.asset), ["bonk", "tsla", "bot"]);
  assert.equal(weekly.filter(r => fits(latest(weekly, r.asset))).length, 33);
  assert.equal(weekly.filter(r => fits(latest(weekly, r.asset)) || r.alternateFeeds.some(a => fits(a.check))).length, 35);
  for (const row of daily) {
    assert.deepEqual(row.preset, kkSupertrendPreset("1d", options(row)));
    assert.deepEqual(row.preset, KK_OCTOBER19_EVIDENCE.find(c => c.asset === row.asset)!.preset);
    for (const candidate of row.candidates) assert.ok(candidate.levelFits && candidate.checks.every(fits));
    for (const candidate of row.fineConsistent) assert.ok(candidate.levelFits && candidate.allPendingMatch && candidate.allFlipDatesMatch);
  }
  for (const row of weekly) assert.deepEqual(row.preset, kkSupertrendPreset("1w", options(row)));
});

test("partial daily candles never repaint and backtests retain next-open execution, costs and annualization", () => {
  for (const row of daily) {
    const candles = read(row.fixture).candles as Candle[], last = candles.at(-1)!;
    const opts = { ...options(row), indicatorIds: ["kk_supertrend"] };
    const signal = calculateIndicators(candles, "1d", opts)[0];
    const partial = { ...last, time: last.time + DAY, high: last.close * 10, low: last.close / 10, close: last.close * 5, complete: false };
    const withPartial = calculateIndicators([...candles, partial], "1d", opts)[0];
    assert.deepEqual(withPartial.values, signal.values);
    assert.deepEqual(withPartial.confirmation, signal.confirmation);
    assert.equal(withPartial.lastFlip, signal.lastFlip);
    const research = row.backtests[0];
    assert.equal(research.periodsPerYear, row.assetClass === "crypto" ? 365 : 252);
    assert.deepEqual(research.costs.map(c => c.costBps), [5, 15, 30]);
    assert.ok(research.costs[0].totalReturn >= research.costs[1].totalReturn && research.costs[1].totalReturn >= research.costs[2].totalReturn);
    if (research.buyAndHold) assert.deepEqual([research.buyAndHold.start, research.buyAndHold.end], [research.costs[1].start, research.costs[1].end]);
    const detail = backtestDetail(candles, signal, "1d", 15, { market: opts.market ?? "crypto" });
    for (const execution of detail?.executions ?? []) {
      const i = candles.findIndex(c => c.time === execution.time);
      assert.equal(execution.signalTime, candles[i - 1].time);
      assert.equal(execution.price, candles[i].open);
      assert.ok(execution.time > execution.signalTime);
    }
  }
  for (const row of weekly) {
    assert.equal(row.backtest.periodsPerYear, 52);
    assert.deepEqual(row.backtest.costs.map(c => c.costBps), [5, 15, 30]);
  }
  assert.ok(daily.find(r => r.asset === "btc")!.backtests[0].rolling.length > 0);
  assert.deepEqual(daily.find(r => r.asset === "spcx")!.backtests[0].rolling, []);
});
