import assert from "node:assert/strict";
import test from "node:test";
import { formatPrice, quoteAge } from "../lib/display.ts";
import { chartWindow, priceDomain } from "../lib/chart-interaction.ts";
import { backtest, backtestDetail, calculateIndicators, familyAgreement, familyRows, type Candle, type SignalSnapshot } from "../lib/regimes.ts";
import { buildResearch, researchWindow } from "../lib/research.ts";
import { resolveView, viewUrl } from "../lib/view-preferences.ts";
import { normalizePins, cryptoWatchSummary } from "../lib/watchlist.ts";
import { historyIsCurrent, loadCryptoHistory, requestJson, syncMarket, syncMessage } from "../lib/history-client.ts";
import { signalTiming } from "../lib/signal-timing.ts";
import { KK_REFERENCES, calibrationStatus, evaluateReference } from "../lib/kk-calibration.ts";
import { buildDashboardPayload } from "../lib/dashboard-calculation.ts";
import type { MarketDataset } from "../lib/market-data.ts";

const DAY = 86_400_000;
const history = (count: number, step = DAY): Candle[] => Array.from({ length: count }, (_, index) => {
  const price = 100 * 1.001 ** index;
  return { time: Date.UTC(2020, 0, 6) + index * step, open: price, high: price * 1.01, low: price * .99, close: price, volume: 1, complete: true };
});
function model(candles: Candle[], start: number, id = "test"): SignalSnapshot {
  return { ...calculateIndicators(candles, "1d", { indicatorIds: ["supertrend"] })[0], id, shortName: id, states: candles.map((_, index) => index >= start ? "bull" : null) };
}
function dataset(candles: Candle[], timeframe: "1d" | "1w"): MarketDataset {
  return { asset: "sui", assetLabel: "Sui", source: "coinbase", sourceLabel: "Coinbase", market: "SUI/USD", denomination: "USD", timeframe, candles, retrievedAt: "2026-09-06T20:00:00Z", checksum: "fixed-fixture", stale: false, demo: false, storage: "d1", warning: null, provisional: null, quality: { gaps: 0, duplicates: 0, malformed: 0 } };
}

test("price formatting preserves screenshot precision and a common unit across surfaces", () => {
  assert.equal(formatPrice(.097006), "$0.097006");
  assert.equal(formatPrice(1.0413), "$1.0413");
  assert.equal(formatPrice(350.93), "$350.93");
  assert.equal(formatPrice(110_123.45), "$110,123.45");
  assert.equal(formatPrice(.097006, "USDT"), "0.097006 USDT");
  assert.equal(formatPrice(null), "—");
  assert.equal(formatPrice(NaN), "—");
  assert.equal(quoteAge("2026-09-06T19:00:00Z", Date.parse("2026-09-06T20:03:00Z")), "fetched 1h 3m ago");
});

test("price padding is proportional for DOGE, flat prices, and logarithmic axes", () => {
  const doge = priceDomain([.08, .10]);
  assert.ok(doge.minimum > .07 && doge.maximum < .11);
  const flat = priceDomain([.001, .001, NaN]);
  assert.ok(flat.maximum > flat.minimum && flat.maximum < .002);
  const log = priceDomain([1, 100, -10, 0], "log");
  assert.ok(log.minimum < 0 && log.maximum > Math.log(100));
  assert.deepEqual(priceDomain([], "linear"), { minimum: 0, maximum: 1 });
  assert.deepEqual(chartWindow(100, 20), { start: 80, end: 100 });
  assert.deepEqual(chartWindow(100, 20, -100), { start: 0, end: 20 });
  assert.deepEqual(chartWindow(100, 500, 12), { start: 0, end: 100 });
});

test("not-ready indicators are explicitly unavailable and have no zero-return backtest", () => {
  const candles = history(25, 7 * DAY), signals = calculateIndicators(candles, "1w", { asset: "sui" });
  for (const id of ["long_sma", "ichimoku", "ma_200w"]) {
    const signal = signals.find(item => item.id === id)!;
    assert.equal(signal.readiness?.ready, false, id);
    assert.equal(signal.readiness?.availableCandles, 25);
    assert.deepEqual(backtest(candles, [signal], "1w"), []);
  }
  assert.equal(signals.find(item => item.id === "ma_200w")!.readiness?.requiredCandles, 200);
  const noCloud = familyRows(signals).find(row => row.family === "cloud/projected support")!;
  assert.equal(noCloud.state, null);
  assert.equal(noCloud.members, 0);
  assert.equal(familyAgreement([]).neutral, 0);
  assert.equal(familyAgreement([]).unavailable, 5);
  assert.equal(calculateIndicators(history(199), "1d").find(item => item.id === "mayer")!.readiness?.ready, false);
  assert.equal(calculateIndicators(history(200), "1d").find(item => item.id === "mayer")!.readiness?.ready, true);
});

test("dashboard sends complete chart history and preserves null counterpart readiness", () => {
  const daily = dataset(history(900), "1d"), weekly = dataset(history(171, 7 * DAY), "1w");
  const payload = buildDashboardPayload("sui", "coinbase", "1w", "ma_200w", daily, weekly);
  assert.equal(payload.candles.length, 171);
  assert.equal(payload.selected.states.length, 171);
  assert.equal(payload.selected.state, null);
  assert.equal(payload.selected.nextCondition, "Insufficient history");
  assert.ok(payload.comparison.backtests.every(row => row.start === payload.comparison.start && row.end === payload.comparison.end));
});

test("all ranked strategies and the benchmark share dates, samples and initial costs", () => {
  const candles = history(400), early = model(candles, 0, "early"), late = model(candles, 199, "late");
  const research = buildResearch(candles, [early, late], "early", "1d", { market: "equity" });
  assert.equal(research.start, candles[200].time);
  assert.equal(research.end, candles.at(-1)!.time);
  assert.equal(research.observations, 199);
  assert.equal(research.periodsPerYear, 252);
  assert.equal(research.detail!.summary.totalReturn, research.benchmark!.summary.totalReturn);
  assert.equal(research.detail!.summary.maxDrawdown, research.benchmark!.summary.maxDrawdown);
  assert.ok(research.backtests.every(row => row.observations === 199 && row.start === research.start && row.end === research.end));
  const entry = research.detail!.executions[0];
  assert.equal(entry.time, candles[200].time);
  assert.equal(entry.signalTime, candles[199].time);
  assert.equal(entry.previousExposure, 0);
  assert.equal(entry.cost, .0015);
  assert.ok(research.sensitivity[0].result!.totalReturn > research.sensitivity[1].result!.totalReturn);
  assert.ok(research.sensitivity[1].result!.totalReturn > research.sensitivity[2].result!.totalReturn);
});

test("execution ledger is next-open and never executes a last candle without a later return", () => {
  const candles = history(6), signal = model(candles, 0);
  signal.states = ["bear", "bull", "bull", "bear", "bull", "bear"];
  const detail = backtestDetail(candles, signal, "1d")!;
  assert.deepEqual(detail.executions.map(row => row.time), [candles[2].time, candles[4].time]);
  assert.deepEqual(detail.executions.map(row => row.exposure), [1, 0]);
  assert.equal(detail.curve.at(-1)!.time, candles[5].time);
  assert.equal(detail.curve.at(-1)!.equity - 1, detail.summary.totalReturn);
  const revised = [...candles]; revised[5] = { ...revised[5], close: 1, high: 10_000 };
  assert.deepEqual(backtestDetail(revised, signal, "1d"), detail);
});

test("four-year windows contain exact sample counts and charge entry from cash", () => {
  for (const [timeframe, periods, market] of [["1d", 252, "equity"], ["1d", 365, "crypto"], ["1w", 52, "crypto"]] as const) {
    const candles = history(periods * 5 + 30, timeframe === "1w" ? DAY * 7 : DAY);
    const signal = model(candles, 19);
    const result = buildResearch(candles, [signal], signal.id, timeframe, { market });
    assert.ok(result.rolling.length >= 2);
    for (const row of result.rolling) {
      assert.equal(row.result.observations, 4 * periods);
      assert.equal(row.result.totalReturn, row.benchmark.totalReturn);
      assert.equal(row.result.turnover, 1);
    }
  }
  const candles = history(171, DAY * 7), signal = model(candles, 14);
  assert.deepEqual(buildResearch(candles, [signal], signal.id, "1w").rolling, []);
});

test("a missing signal in the common research window is excluded, never spliced", () => {
  const candles = history(100), complete = model(candles, 0, "complete"), gap = model(candles, 0, "gap");
  gap.states[50] = null;
  assert.deepEqual(researchWindow(candles, [complete, gap])!.comparable.map(row => row.id), ["complete"]);
  assert.deepEqual(buildResearch(candles, [complete, gap], "gap", "1d").detail, null);
});

test("saved views validate URL input and preserve exchanges when supported", () => {
  const view = resolveView("crypto", { asset: "sol", source: "kraken", timeframe: "1w", indicator: "kk_supertrend" });
  assert.equal(view.source, "kraken");
  assert.deepEqual(resolveView("crypto", null, new URLSearchParams(viewUrl("crypto", view).split("?")[1])), view);
  assert.equal(resolveView("crypto", view, new URLSearchParams("asset=xmr&source=binance")).source, "kraken");
  assert.equal(resolveView("crypto", view, new URLSearchParams("indicator=mayer&timeframe=1w")).indicator, "support_band");
  const stock = resolveView("stock", { asset: "mu", source: "binance", indicator: "kk_supertrend", timeframe: "1d" });
  assert.equal(stock.source, "yahoo");
  assert.ok(!viewUrl("stock", stock).includes("binance"));
  assert.equal(resolveView("stock", { asset: "xmr", indicator: "<script>" }).asset, "tsla");
  assert.equal(resolveView("crypto", "bad storage").asset, "btc");
});

test("watchlist pins are isolated by market and deduplicated, with truthful readiness", () => {
  assert.deepEqual(normalizePins("crypto", [{ asset: "sui", source: "coinbase" }, { asset: "sui", source: "coinbase" }, { asset: "tsla", source: "yahoo" }]), [{ asset: "sui", source: "coinbase" }]);
  assert.deepEqual(normalizePins("stock", [{ asset: "mu", source: "kraken" }, { asset: "doge" }]), [{ asset: "mu", source: "yahoo" }]);
  assert.deepEqual(normalizePins("crypto", []), []);
  const summary = cryptoWatchSummary({ daily: dataset(history(6), "1d"), weekly: dataset(history(2), "1w") }, "sui");
  assert.equal(summary.dailyState, null);
  assert.equal(summary.weeklyState, null);
  assert.equal(summary.level, null);
});

test("signal timestamps distinguish session closes from subsequent opens including holidays and DST", () => {
  const crypto = signalTiming(Date.UTC(2026, 7, 24), "1w", "crypto")!;
  assert.equal(crypto.confirmedAt, Date.UTC(2026, 7, 31));
  assert.equal(crypto.effectiveAt, Date.UTC(2026, 7, 31));
  const holiday = signalTiming(Date.UTC(2026, 7, 31), "1w", "equity")!;
  assert.equal(holiday.confirmedAt, Date.UTC(2026, 8, 4, 20));
  assert.equal(holiday.effectiveAt, Date.UTC(2026, 8, 8, 13, 30));
  const early = signalTiming(Date.UTC(2025, 6, 3), "1d", "equity")!;
  assert.equal(early.confirmedAt, Date.UTC(2025, 6, 3, 17));
  assert.equal(early.effectiveAt, Date.UTC(2025, 6, 7, 13, 30));
  const dst = signalTiming(Date.UTC(2026, 2, 6), "1d", "equity")!;
  assert.equal(dst.confirmedAt, Date.UTC(2026, 2, 6, 21));
  assert.equal(dst.effectiveAt, Date.UTC(2026, 2, 9, 13, 30));
});

test("every archived KK reference passes without changing any preset", () => {
  for (const reference of KK_REFERENCES) assert.equal(evaluateReference(reference).matched, true, reference.id);
  assert.match(calibrationStatus("sui", "1d"), /Uncalibrated/);
  assert.match(calibrationStatus("sol", "1d"), /Inherited/);
  assert.match(calibrationStatus(undefined, "1w"), /Uncalibrated equity/);
  assert.match(calibrationStatus("btc", "1w"), /not archived/);
});

test("freshness checks expected candles, not the retrieval timestamp", () => {
  const now = Date.UTC(2026, 8, 6, 21);
  assert.equal(historyIsCurrent("crypto", Date.UTC(2026, 8, 5), Date.UTC(2026, 7, 24), now), true);
  assert.equal(historyIsCurrent("crypto", Date.UTC(2026, 8, 4), Date.UTC(2026, 7, 24), now), false);
  assert.equal(historyIsCurrent("stock", Date.UTC(2026, 8, 4), undefined, now), true);
  assert.equal(historyIsCurrent("stock", Date.UTC(2026, 8, 3), undefined, now), false);
  assert.match(syncMessage("failed", true, true), /Update failed/);
  assert.match(syncMessage("cooldown", false, true), /behind/);
  assert.match(syncMessage("current", true, true), /Up to date/);
});

test("sync rejects failed HTTP-200 statuses but can still read the stored dataset", async () => {
  const daily = dataset(history(300), "1d"), weekly = dataset(history(100, DAY * 7), "1w");
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push(String(url)); assert.equal(init?.cache, "no-store");
    return Response.json(String(url).endsWith("/sync") ? { status: "failed" } : { daily, weekly });
  };
  const result = await loadCryptoHistory("sui", "coinbase", fetcher, new AbortController().signal);
  assert.equal(result.status, "failed");
  assert.equal(result.history.daily.candles.length, 300);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("asset=sui&source=coinbase"));
  assert.ok(calls.every(url => !/token|key|email/i.test(url)));
});

test("data request failures are sanitized, abortable and timeout-bounded", async () => {
  const secret = "secret upstream diagnostic";
  await assert.rejects(requestJson(async () => Response.json({ error: secret }, { status: 503 }), "/api/v1/dashboard"), error => error instanceof Error && !error.message.includes(secret));
  assert.equal(await syncMarket(async () => Response.json({ status: "healthy" }), {}, new AbortController().signal), "healthy");
  assert.equal(await syncMarket(async () => Response.json({ status: "unexpected" }), {}, new AbortController().signal), "failed");
  const waiting: typeof fetch = async (_, init) => new Promise((_resolve, reject) => { if (init?.signal?.aborted) reject(init.signal.reason); else init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }); });
  await assert.rejects(requestJson(waiting, "/api/v1/spot", {}, 5), /timed out/);
  const abort = new AbortController(); abort.abort(new Error("cancelled"));
  await assert.rejects(syncMarket(waiting, {}, abort.signal), /cancelled/);
});
