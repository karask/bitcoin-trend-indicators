import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateIndicators, kkSupertrendPreset, type Candle, type IndicatorCalculationOptions, type KkPreset } from "../lib/regimes.ts";
import { KK_OCTOBER19_EVIDENCE } from "../lib/kk-october19-evidence.ts";
import { openCandleConfirmationCount } from "../lib/kk-confirmation.ts";

const root = "research/kk-2026-10-24/daily";
const read = (file: string) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
type Check = { date: string; fixture: string; through: string; target: number; targetState: string; value: number; state: string; lastFlip: string | null; confirmationCount: number; asCapturedCount: number; chartPendingCount: number; errorPct: number };
type Score = KkPreset & { levelFits: boolean; allPendingMatch: boolean; allFlipDatesMatch: boolean; maxErrorPct: number | null; checks: Check[] };
type Row = { asset: string; assetClass: "crypto" | "stock" | "commodity"; target: number; previousTarget: number; targetState: string; preset: KkPreset; fixture: string; fixtureSha256: string; current: Score; hypotheses: Score[]; candidates: Score[]; fineConsistent: Score[]; backtests: { periodsPerYear: number; costs: { costBps: number; totalReturn: number }[]; rolling: unknown[] }[] };
const rows = read(`${root}/review.json`) as Row[];
const options = (row: Row) => (row.assetClass === "crypto" ? { asset: row.asset } : row.assetClass === "stock" ? { market: "equity", stock: row.asset } : { market: "commodity", commodity: row.asset }) as IndicatorCalculationOptions;
const day = (time: number | null) => time == null ? null : new Date(time).toISOString().slice(0, 10);
const latest = (asset: string) => rows.find(r => r.asset === asset)!.current.checks.at(-1)!;

test("October 24 review contains all 39 readable daily charts with completed October 23 tails", () => {
  const observations = read(`${root}/observations.json`);
  assert.equal(observations.captureDate, "2026-10-24");
  assert.equal(observations.reviewedAt, "2026-10-25");
  assert.equal(observations.timeframe, "1d");
  assert.equal(observations.charts.length, 39);
  assert.equal(rows.length, 39);
  assert.equal(new Set(rows.map(r => r.asset)).size, 39);
  assert.equal(rows.filter(r => r.assetClass === "crypto").length, 20);
  assert.equal(rows.filter(r => r.assetClass === "stock").length, 17);
  assert.equal(rows.filter(r => r.assetClass === "commodity").length, 2);
  assert.deepEqual(read(`${root}/fetch-failures.json`), []);
  for (const row of rows) {
    const bytes = readFileSync(new URL(`../${row.fixture}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), row.fixtureSha256, row.asset);
    const fixture = JSON.parse(bytes.toString());
    assert.equal(day(fixture.candles.at(-1).time), "2026-10-23", row.asset);
    assert.ok(fixture.candles.every((c: Candle) => c.complete && c.time < Date.UTC(2026, 9, 24)), row.asset);
    assert.deepEqual(fixture.quality, { gaps: 0, duplicates: 0, malformed: 0 }, row.asset);
    assert.match(observations.charts.find((c: { asset: string }) => c.asset === row.asset).imageSha256, /^[a-f0-9]{64}$/);
  }
});

test("the eight changed chart levels and META's new bearish state are transcribed exactly", () => {
  assert.deepEqual(Object.fromEntries(rows.filter(r => r.target !== r.previousTarget).map(r => [r.asset, r.target])), {
    link: 15.073, sui: 1.27540, avax: 11.3733, qnt: 235.60, intc: 105.80, meta: 757.70, gold: 4454.4, silver: 66.090,
  });
  assert.equal(latest("meta").targetState, "bear");
  assert.equal(latest("meta").lastFlip, "2026-10-22");
  assert.equal(latest("meta").state, "bear");
  assert.ok(latest("meta").errorPct < -8);
});

test("every current historical check replays with the production engine and its own dated fixture", () => {
  for (const row of rows) for (const check of row.current.checks) {
    const candles = (read(check.fixture).candles as Candle[]).filter(c => c.complete && day(c.time)! <= check.through);
    assert.equal(day(candles.at(-1)!.time), check.through);
    const signal = calculateIndicators(candles, "1d", { ...options(row), indicatorIds: ["kk_supertrend"], kkSupertrendAtrLength: row.preset.atrLength, kkSupertrendFactor: row.preset.factor })[0];
    assert.equal(signal.values.supertrend, check.value, `${row.asset} ${check.date}`);
    assert.equal(signal.state, check.state, `${row.asset} ${check.date}`);
    assert.equal(day(signal.lastFlip), check.lastFlip, `${row.asset} ${check.date}`);
    assert.equal(signal.confirmation!.count, check.confirmationCount, `${row.asset} ${check.date}`);
    assert.equal(signal.confirmation!.required, 5);
  }
});

test("the October 24 count comparison includes open crypto, not a nonexistent Saturday stock candle", () => {
  for (const [asset, printed, app] of [["btc", 1, 3], ["eth", 1, 1], ["doge", 3, 3], ["op", 2, 2], ["hype", 1, 1], ["ray", 2, 2], ["sndk", 1, 1], ["amd", 2, 2]] as const) {
    assert.equal(latest(asset).chartPendingCount, printed, asset);
    assert.equal(latest(asset).asCapturedCount, app, asset);
  }
  for (const asset of ["sndk", "amd"]) assert.equal(latest(asset).asCapturedCount, latest(asset).confirmationCount);
  const observations = read(`${root}/observations.json`).charts;
  for (const row of rows.filter(r => r.assetClass === "crypto")) {
    const candles = read(row.fixture).candles as Candle[];
    const signal = calculateIndicators(candles, "1d", { ...options(row), indicatorIds: ["kk_supertrend"] })[0];
    const quote = observations.find((c: { asset: string }) => c.asset === row.asset).chartClose;
    assert.equal(openCandleConfirmationCount(signal, { price: quote, time: Date.UTC(2026, 9, 24, 9, 15) }), latest(row.asset).asCapturedCount, row.asset);
  }
});

test("level-only fit counts do not conceal state, pending or historical flip-date mismatches", () => {
  const today = rows.filter(r => { const c = latest(r.asset); return c.state === c.targetState && Math.abs(c.errorPct) < 1; });
  assert.equal(today.length, 22);
  assert.equal(rows.filter(r => r.current.levelFits).length, 20);
  assert.deepEqual(rows.filter(r => latest(r.asset).state !== r.targetState).map(r => r.asset), ["bonk", "tsla", "bot"]);
  const intc = rows.find(r => r.asset === "intc")!.hypotheses.find(p => p.atrLength === 70 && p.factor === 4)!;
  assert.ok(!intc.levelFits && intc.checks.at(-1)!.errorPct > 4.6);
  for (const asset of ["qnt", "meta", "link", "sui", "avax", "zec"]) {
    const row = rows.find(r => r.asset === asset)!;
    assert.equal(row.candidates.length, 0, asset);
  }
  for (const row of rows) for (const fit of row.candidates) assert.ok(fit.levelFits && fit.checks.every(c => c.state === c.targetState && Math.abs(c.errorPct) < 1), row.asset);
  for (const row of rows) for (const fit of row.fineConsistent) assert.ok(fit.levelFits && fit.allPendingMatch && fit.allFlipDatesMatch, row.asset);
});

test("research retains all approved daily and weekly presets; partial candles remain non-repainting", () => {
  for (const row of rows) {
    assert.deepEqual(row.preset, kkSupertrendPreset("1d", options(row)), row.asset);
    assert.deepEqual(row.preset, KK_OCTOBER19_EVIDENCE.find(r => r.asset === row.asset)!.preset, row.asset);
    const candles = read(row.fixture).candles as Candle[];
    const opts = { ...options(row), indicatorIds: ["kk_supertrend"] };
    const signal = calculateIndicators(candles, "1d", opts)[0];
    const last = candles.at(-1)!;
    const partial = { time: Date.UTC(2026, 9, 24), open: last.close, high: last.close * 10, low: last.close / 10, close: last.close * 5, volume: 0, complete: false };
    const withPartial = calculateIndicators([...candles, partial], "1d", opts)[0];
    assert.deepEqual(withPartial.values, signal.values, row.asset);
    assert.deepEqual(withPartial.confirmation, signal.confirmation, row.asset);
    assert.equal(withPartial.lastFlip, signal.lastFlip, row.asset);
  }
  assert.deepEqual(kkSupertrendPreset("1w", { asset: "btc" }), { atrLength: 10, factor: 3 });
  assert.deepEqual(kkSupertrendPreset("1w", { asset: "sol" }), { atrLength: 10, factor: 2 });
  assert.deepEqual(kkSupertrendPreset("1w", { market: "equity", stock: "tsla" }), { atrLength: 15, factor: 2 });
});

test("diagnostic backtests use equity annualization and monotonic 5/15/30-bps costs", () => {
  for (const row of rows) for (const result of row.backtests) {
    assert.equal(result.periodsPerYear, row.assetClass === "crypto" ? 365 : 252, row.asset);
    assert.deepEqual(result.costs.map(c => c.costBps), [5, 15, 30]);
    assert.ok(result.costs[0].totalReturn >= result.costs[1].totalReturn && result.costs[1].totalReturn >= result.costs[2].totalReturn, row.asset);
    if (["hype", "bot", "spcx", "strc"].includes(row.asset)) assert.equal(result.rolling.length, 0, row.asset);
  }
});
