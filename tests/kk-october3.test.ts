import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KK_OCTOBER5_EVIDENCE } from "../lib/kk-october5-evidence.ts";
import { KK_OCTOBER3_EVIDENCE } from "../lib/kk-october3-evidence.ts";
import { calculateIndicators, KK_SUPERTREND_PRESETS, KK_SUPERTREND_STOCK_PRESETS, type Candle, type IndicatorCalculationOptions } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";
import { calibrationStatus, KK_CALIBRATION_VERSION } from "../lib/kk-calibration.ts";
import { kkCalibrationWarning } from "../lib/kk-reliability.ts";

const observations = JSON.parse(readFileSync(new URL("../research/kk-2026-10-03/observations.json", import.meta.url), "utf8"));
const cutoff = Date.UTC(2026, 9, 3);

test("October 4 review retains October 3 capture and completed October 2 reference dates", () => {
  assert.equal(KK_CALIBRATION_VERSION, "2026-10-08");
  assert.equal(observations.captureDate, "2026-10-03");
  assert.equal(KK_OCTOBER3_EVIDENCE.length, 37);
  assert.equal(new Set(KK_OCTOBER3_EVIDENCE.map(r => r.asset)).size, 37);
  assert.equal(KK_OCTOBER3_EVIDENCE.filter(r => r.assetClass === "crypto").length, 20);
  assert.equal(KK_OCTOBER3_EVIDENCE.filter(r => r.assetClass === "stock").length, 17);
  assert.equal(KK_OCTOBER3_EVIDENCE.filter(r => JSON.stringify(r.previous) !== JSON.stringify(r.preset)).length, 15);
  assert.deepEqual(KK_OCTOBER3_EVIDENCE.filter(r => r.state !== r.targetState).map(r => r.asset), ["nvda", "bot"]);
  for (const row of KK_OCTOBER3_EVIDENCE) {
    assert.equal(row.reviewedAt, "2026-10-04");
    assert.equal(row.captureDate, "2026-10-03");
    assert.equal(row.through, "2026-10-02");
    assert.equal(row.timeframe, "1d");
    assert.equal(row.latestThrough, row.assetClass === "crypto" ? "2026-10-03" : "2026-10-02");
    const family = row.assetClass === "crypto" ? ["10/3", "15/2", "15/3", "15/4", "15/5", "50/4"] : ["10/3", "15/3", "15/4", "30/2", "30/4", "50/6"];
    assert.ok(family.includes(`${row.preset.atrLength}/${row.preset.factor}`));
    assert.equal(row.imageSha256, observations.charts.find((r: { asset: string }) => r.asset === row.asset).imageSha256);
  }
  const link = KK_OCTOBER3_EVIDENCE.find(r => r.asset === "link")!;
  assert.equal(link.status, "skipped");
  assert.equal(link.target, null);
  assert.equal(link.errorPct, null);
  assert.deepEqual(link.previous, link.preset);
  const nvda = KK_OCTOBER3_EVIDENCE.find(r => r.asset === "nvda")!;
  assert.equal(nvda.status, "unresolved");
  assert.equal(nvda.screenshotPendingDirection, "bull");
  assert.equal(nvda.screenshotPendingCount, null);
  assert.equal(KK_OCTOBER3_EVIDENCE.find(r => r.asset === "bonk")!.target, .0000022517);
});

test("all 37 daily presets reproduce fixed evidence without repainting or changing other indicators", () => {
  for (const row of KK_OCTOBER3_EVIDENCE) {
    const raw = readFileSync(new URL(`../${row.fixture}`, import.meta.url), "utf8");
    assert.equal(createHash("sha256").update(raw).digest("hex"), row.fixtureSha256, row.asset);
    const fixture = JSON.parse(raw), all: Candle[] = fixture.candles;
    for (const [key, value] of Object.entries(fixture.quality)) {
      if (["gaps", "duplicates", "malformed", "missingSessions", "duplicateSessions"].includes(key)) assert.equal(value, 0, `${row.asset}: ${key}`);
    }
    const candles = all.filter(c => c.complete && c.time < cutoff);
    assert.equal(new Date(candles.at(-1)!.time).toISOString().slice(0, 10), row.through);
    const options: IndicatorCalculationOptions = row.assetClass === "crypto" ? { asset: row.asset as keyof typeof KK_SUPERTREND_PRESETS } : { market: "equity", stock: row.asset as keyof typeof KK_SUPERTREND_STOCK_PRESETS };
    const signals = calculateIndicators(candles, "1d", options);
    const kk = signals.find(s => s.id === "kk_supertrend")!;
    assert.deepEqual([kk.values.atrLength, kk.values.factor], [row.preset.atrLength, row.preset.factor], row.asset);
    assert.equal(kk.values.supertrend, row.value, row.asset);
    assert.equal(kk.state, row.state, row.asset);
    assert.deepEqual(kk.confirmation, row.confirmation, row.asset);
    assert.equal(kk.confirmation?.required, 5);
    const old = calculateIndicators(candles, "1d", { ...options, kkSupertrendAtrLength: row.previous.atrLength, kkSupertrendFactor: row.previous.factor });
    assert.deepEqual(signals.filter(s => s.id !== "kk_supertrend"), old.filter(s => s.id !== "kk_supertrend"), `${row.asset}: other indicators unchanged`);
    assert.equal(old.find(s => s.id === "kk_supertrend")!.values.supertrend, row.previousValue);
    const prefix = calculateIndicators(candles.slice(0, -1), "1d", { ...options, indicatorIds: ["kk_supertrend"] })[0];
    assert.deepEqual(prefix.states, kk.states.slice(0, -1));
    assert.deepEqual(prefix.overlays[0].points, kk.overlays[0].points.filter(p => p.time <= candles.at(-2)!.time));
    const partial = { ...candles.at(-1)!, time: cutoff, close: candles.at(-1)!.close * 5, complete: false };
    const withPartial = calculateIndicators([...candles, partial], "1d", { ...options, indicatorIds: ["kk_supertrend"] })[0];
    assert.equal(withPartial.states.at(-1), null, `${row.asset}: no provisional daily state`);
    assert.deepEqual({ ...withPartial, states: withPartial.states.slice(0, -1) }, kk, `${row.asset}: unfinished candle cannot change confirmed signal`);
    const latest = calculateIndicators(all.filter(c => c.complete && c.time < cutoff + 86_400_000), "1d", { ...options, indicatorIds: ["kk_supertrend"] })[0];
    assert.equal(latest.values.supertrend, row.latestValue);
    assert.equal(latest.state, row.latestState);
    if (row.asset !== "xmr") assert.equal(row.latestValue, row.value);
    const status = calibrationStatus(options.asset, "1d", options.stock);
    assert.match(status, /October 6/);
    assert.match(status, /October 5 chart/);
    const latestEvidence = KK_OCTOBER5_EVIDENCE.find(r => r.asset === row.asset)!;
    assert.match(kkCalibrationWarning(row.asset, "1d")!.label, latestEvidence.status === "unresolved" ? /Unreliable/ : /Low-confidence/);

    const research = buildResearch(candles, signals, "kk_supertrend", "1d", options);
    assert.equal(research.periodsPerYear, row.assetClass === "crypto" ? 365 : 252);
    assert.ok(research.detail && research.benchmark, row.asset);
    assert.equal(research.detail.summary.start, research.benchmark.summary.start);
    assert.equal(research.detail.summary.end, research.benchmark.summary.end);
    assert.deepEqual(research.sensitivity.map(s => s.costBps), [5, 15, 30]);
    const returns = research.sensitivity.map(s => s.result!.totalReturn);
    assert.ok(returns[0] >= returns[1] && returns[1] >= returns[2], row.asset);
    for (const execution of research.detail.executions) {
      const index = candles.findIndex(c => c.time === execution.time);
      assert.equal(execution.price, candles[index].open);
      assert.equal(execution.signalTime, candles[index - 1].time);
    }
    if (research.observations >= research.periodsPerYear * 4) assert.ok(research.rolling.length > 0, row.asset);
    else assert.equal(research.rolling.length, 0, row.asset);
  }
});
