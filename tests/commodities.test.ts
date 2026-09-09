import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { COMMODITIES, aggregateCommodityWeeks, commodityBarComplete, commodityConfirmationClock, commodityDefinition, expectedCommodityDates, isCommoditySymbol, latestRequiredCommodityDate, type CommodityHistoryResponse, type CommoditySymbol } from "../lib/commodities.ts";
import { commodityError, commodityJson, commoditySymbolFromRequest, fetchCommodityHistory, fetchCommodityQuote, normalizeCommodityHistory } from "../lib/yahoo-commodities.ts";
import { calculateIndicators, INDICATOR_SPECS, type Candle } from "../lib/regimes.ts";
import { buildResearch } from "../lib/research.ts";
import { mergeIncrementalCommodityHistory, commodityIncrementalStartDate } from "../lib/commodity-cache.ts";
import { localCommodityStore } from "../lib/commodity-store-local.ts";
import { loadCommodityHistory, historyIsCurrent } from "../lib/history-client.ts";
import { resolveView, viewUrl } from "../lib/view-preferences.ts";
import { summarizeOverview } from "../lib/asset-overview.ts";
import { ASSETS } from "../lib/markets.ts";
import { STOCKS } from "../lib/stocks.ts";

const now = Date.parse("2026-09-09T09:00:00Z"), DAY = 86_400_000;
const dates = expectedCommodityDates("2019-01-02", "2026-09-08");
function chart(symbol: CommoditySymbol, subset = dates) {
  const prices = subset.map(date => 150 + dates.indexOf(date) * .03 + 20 * Math.sin(dates.indexOf(date) / 19));
  return { meta: { symbol, currency: "USD", instrumentType: "FUTURE", shortName: `${symbol} Dec 26`, regularMarketPrice: 225, regularMarketTime: now / 1000 - 60 }, timestamp: subset.map(date => Date.parse(`${date}T05:00:00Z`) / 1000), indicators: { quote: [{ open: prices, high: prices.map(p => p + 3), low: prices.map(p => p - 3), close: prices.map(p => p + 1), volume: prices.map(() => 100) }] } };
}
const history = (symbol: CommoditySymbol = "GC=F") => normalizeCommodityHistory(chart(symbol), symbol, "2019-01-02", now);
const request = (symbol = "GC=F", start?: string) => new Request(`https://test.invalid/api/v1/commodities/history?${new URLSearchParams({ symbol, ...(start ? { startDate: start } : {}) })}`);

test("metals are separate whitelisted futures, never crypto assets or stocks", () => {
  assert.deepEqual(COMMODITIES.map(row => row.symbol), ["GC=F", "SI=F"]);
  for (const metal of COMMODITIES) {
    assert.equal(metal.unit, "troy ounce");
    assert.ok(!ASSETS.some(row => String(row.id) === metal.id));
    assert.ok(!STOCKS.some(row => String(row.id) === metal.id));
    assert.equal(commoditySymbolFromRequest(request(metal.symbol)), metal.symbol);
    assert.equal(viewUrl("commodity", resolveView("commodity", { asset: metal.id })), `/commodities/?asset=${metal.id}&timeframe=1w&indicator=support_band`);
  }
  assert.equal(isCommoditySymbol("XAUUSD"), false);
  assert.throws(() => commoditySymbolFromRequest(request("TSLA")), /Unsupported commodity/);
  assert.equal(resolveView("crypto", { asset: "gold" }).asset, "btc");
  assert.equal(resolveView("commodity", { asset: "tsla", source: "kraken" }).asset, "gold");
});

test("completed date keys, holiday placeholders, missing sessions and invalid OHLC are handled honestly", () => {
  const result = history();
  assert.equal(result.candles.length, dates.length);
  assert.ok(result.candles.every(row => row.time % DAY === 0 && row.complete));
  const raw = chart("GC=F", ["2026-09-04", "2026-09-07", "2026-09-08"]);
  for (const key of ["open", "high", "low", "close", "volume"] as const) (raw.indicators.quote[0][key] as (number | null)[])[1] = null;
  assert.equal(normalizeCommodityHistory(raw, "GC=F", "2026-09-04", now).candles.length, 2);
  const missing = chart("GC=F", ["2026-09-04"]);
  assert.throws(() => normalizeCommodityHistory(missing, "GC=F", "2026-09-04", now), /quality/);
  const malformed = chart("GC=F", ["2026-09-08"]);
  malformed.indicators.quote[0].high[0] = 1;
  assert.throws(() => normalizeCommodityHistory(malformed, "GC=F", "2026-09-08", now), /no completed futures history/);
  const partial = chart("GC=F", ["2026-09-08", "2026-09-09"]);
  assert.equal(normalizeCommodityHistory(partial, "GC=F", "2026-09-08", now).candles.length, 1);
  assert.equal(commodityBarComplete("2026-03-09", Date.parse("2026-03-09T23:59:59Z")), false);
  assert.equal(commodityBarComplete("2026-03-09", Date.parse("2026-03-10T00:00:00Z")), true);
  assert.equal(commodityBarComplete("2026-11-02", Date.parse("2026-11-03T00:00:00Z")), true);
});

test("Monday weeks accept holidays and extra published bars, exclude incomplete weeks and never fill gaps", () => {
  const make = (keys: string[]): Candle[] => keys.map((date, i) => ({ time: Date.parse(`${date}T00:00:00Z`), open: 100+i, high: 110+i, low: 90+i, close: 101+i, volume: 1, complete: true }));
  const normal = make(["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
  assert.equal(aggregateCommodityWeeks(normal, now).length, 1);
  assert.equal(aggregateCommodityWeeks(normal.slice(1), now).length, 0);
  const short = make(["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"]);
  const cutoff = Date.parse("2026-09-12T00:00:00Z");
  assert.equal(aggregateCommodityWeeks(short, cutoff-1).length, 0);
  const week = aggregateCommodityWeeks(short, cutoff)[0];
  assert.equal(week.time, Date.parse("2026-09-07T00:00:00Z"));
  assert.equal(week.volume, 4);
  assert.equal(aggregateCommodityWeeks([...make(["2026-09-07"]), ...short], cutoff)[0].volume, 5);
  const clock = commodityConfirmationClock("1w", now);
  assert.equal(clock.target, cutoff);
  assert.match(clock.boundary, /not settlement/);
  assert.equal(latestRequiredCommodityDate(now), "2026-09-08");
});

test("Yahoo calls are scoped daily futures requests with no-store and sanitized failures", async () => {
  const calls: URL[] = [];
  const fetcher = (async (input, init) => {
    calls.push(new URL(String(input)));
    assert.equal(init?.cache, "no-store");
    return Response.json({ chart: { result: [chart("GC=F")] } });
  }) as typeof fetch;
  assert.equal((await fetchCommodityHistory("GC=F", fetcher, now)).commodity.id, "gold");
  assert.equal(calls[0].searchParams.get("interval"), "1d");
  assert.equal(calls[0].searchParams.get("range"), null);
  assert.equal(decodeURIComponent(calls[0].pathname).endsWith("GC=F"), true);
  const quote = await fetchCommodityQuote("GC=F", fetcher, now);
  assert.equal(quote.price, 225);
  assert.equal(quote.contractLabel, "GC=F Dec 26");
  for (const status of [401, 429, 500]) {
    let failure;
    try { await fetchCommodityHistory("GC=F", (async () => new Response("private upstream detail", { status })) as typeof fetch, now); } catch (error) { failure = error; }
    const response = commodityError(failure);
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.match(response.headers.get("Cache-Control")!, /private, no-store/);
    assert.doesNotMatch(await response.text(), /private upstream detail/);
  }
  await assert.rejects(fetchCommodityHistory("GC=F", (async () => Response.json({ chart: { result: [{ ...chart("GC=F"), meta: { symbol: "TSLA" } }] } })) as typeof fetch, now), /provenance/);
  assert.equal(commodityJson(history()).headers.get("Cache-Control"), "private, no-store");
});

test("all futures indicators, KK baseline, next-open research and costs retain honest semantics", () => {
  for (const metal of COMMODITIES) {
    const response = history(metal.symbol), weekly = aggregateCommodityWeeks(response.candles, now);
    for (const tf of ["1d", "1w"] as const) {
      const candles = tf === "1d" ? response.candles : weekly;
      const signals = calculateIndicators(candles, tf, { market: "commodity" });
      assert.deepEqual(signals.map(row => row.id), INDICATOR_SPECS.filter(row => row.supportedTimeframes.includes(tf)).map(row => row.id));
      const kk = signals.find(row => row.id === "kk_supertrend")!, standard = signals.find(row => row.id === "supertrend")!;
      assert.deepEqual(kk.states, standard.states);
      assert.equal(kk.values.supertrend, standard.values.supertrend);
      assert.deepEqual([kk.values.atrLength, kk.values.factor], [10,3]);
      const prefix = calculateIndicators(candles.slice(0,-5), tf, { market: "commodity", indicatorIds: ["kk_supertrend"] })[0];
      assert.deepEqual(prefix.states, kk.states.slice(0,-5));
      const research = buildResearch(candles, signals, "kk_supertrend", tf, { market: "commodity" });
      assert.equal(research.periodsPerYear, tf === "1d" ? 252 : 52);
      assert.ok(research.detail && research.benchmark);
      assert.equal(research.detail.summary.start, research.benchmark.summary.start);
      const returns = research.sensitivity.map(row => row.result!.totalReturn);
      assert.ok(returns[0] >= returns[1] && returns[1] >= returns[2]);
      for (const trade of research.detail.executions) {
        const index = candles.findIndex(row => row.time === trade.time);
        assert.equal(trade.price, candles[index].open);
        assert.equal(trade.signalTime, candles[index-1].time);
      }
      assert.ok(research.rolling.length);
      const overview = summarizeOverview({ lab: "commodity", history: response }, "kk_supertrend");
      assert.deepEqual(tf === "1d" ? overview.day : overview.week, calculateIndicators(candles, tf, { market: "commodity", commodity: metal.id, indicatorIds: ["kk_supertrend"] })[0]);
    }
  }
});

test("browser tails merge without dropping history and request a full read on revisions", async () => {
  const original = history(), start = commodityIncrementalStartDate("GC=F", original.candles);
  assert.ok(start > original.requestedStart);
  const tail: CommodityHistoryResponse = { ...original, requestedStart: start, candles: original.candles.filter(row => row.time >= Date.parse(start)) };
  assert.equal(mergeIncrementalCommodityHistory(original, tail).response!.candles.length, original.candles.length);
  const revised = { ...tail, candles: tail.candles.map((row,i) => ({ ...row, volume: row.volume + (i === 0 ? 1 : 0) })) };
  assert.equal(mergeIncrementalCommodityHistory(original, revised).requiresFullRefresh, true);
  assert.equal(mergeIncrementalCommodityHistory(original, history("SI=F")).requiresFullRefresh, true);
  assert.equal(historyIsCurrent("commodity", original.candles.at(-1)!.time, undefined, now), true);
  const requests: string[] = [];
  const fetcher = (async (input, init) => { requests.push(String(input)); if (String(input).endsWith("/sync")) { assert.equal(JSON.parse(String(init?.body)).market, "commodity"); return Response.json({ status: "current" }); } return Response.json(original); }) as typeof fetch;
  const result = await loadCommodityHistory("GC=F", fetcher, new AbortController().signal);
  assert.equal(result.history.commodity.id, "gold");
  assert.equal(requests.length, 2);
  assert.match(requests[1], /commodities\/history/);
});

test("D1-compatible persistence seeds once, reads without upstream calls, refreshes tails atomically", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../drizzle/0001_cloudflare_d1.sql", import.meta.url), "utf8"));
  const store = localCommodityStore(database);
  let calls = 0;
  const fetcher = (async input => { calls++; const url = new URL(String(input)); const start = new Date(Number(url.searchParams.get("period1")) * 1000).toISOString().slice(0,10); return Response.json({ chart: { result: [chart("GC=F", dates.filter(date => date >= start))] } }); }) as typeof fetch;
  await assert.rejects(store.refresh("GC=F", fetcher, now), /seeded/);
  assert.equal(calls, 0);
  assert.equal((await store.refresh("GC=F", fetcher, now, true)).status, "healthy");
  assert.equal(calls, 1);
  assert.equal((await store.read(request())).candles.length, dates.length);
  assert.equal((await store.refresh("GC=F", fetcher, now)).status, "current");
  assert.equal(calls, 1);
  assert.ok((await store.read(request("GC=F", "2026-09-01"))).candles.length < 10);
  await assert.rejects(store.read(request("SI=F")), /not available/);
  await assert.rejects(store.read(request("GC=F", "2000-01-01")), /start date/);
  const nextNow = Date.parse("2026-09-10T09:00:00Z");
  const nextFetcher = (async input => { calls++; const start = new Date(Number(new URL(String(input)).searchParams.get("period1")) * 1000).toISOString().slice(0,10); assert.ok(start > commodityDefinition("GC=F").historyStart); return Response.json({ chart: { result: [chart("GC=F", [...dates, "2026-09-09"].filter(date => date >= start))] } }); }) as typeof fetch;
  assert.equal((await store.refresh("GC=F", nextFetcher, nextNow)).status, "healthy");
  assert.equal(calls, 2);
  assert.equal((await store.read(request())).candles.length, dates.length+1);
  const before = await store.read(request());
  database.exec("CREATE TRIGGER reject_futures_update BEFORE UPDATE ON provider_snapshots WHEN NEW.asset='gold' BEGIN SELECT RAISE(ABORT,'fixture rollback'); END");
  const fullDates = [...dates, "2026-09-09", "2026-09-10"];
  const starts: string[] = [];
  const rebaseFetcher = (async input => {
    const start = new Date(Number(new URL(String(input)).searchParams.get("period1")) * 1000).toISOString().slice(0,10);
    starts.push(start);
    const raw = chart("GC=F", fullDates.filter(date => date >= start));
    raw.indicators.quote[0].volume = raw.indicators.quote[0].volume.map(value => value+1);
    return Response.json({ chart: { result: [raw] } });
  }) as typeof fetch;
  await assert.rejects(store.refresh("GC=F", rebaseFetcher, Date.parse("2026-09-11T09:00:00Z")), /fixture rollback/);
  assert.deepEqual(await store.read(request()), before, "Snapshot and all candle changes roll back together");
  assert.deepEqual(starts, [commodityIncrementalStartDate("GC=F", before.candles), "2019-01-02"]);
  database.exec("DROP TRIGGER reject_futures_update");
  assert.equal((await store.refresh("GC=F", rebaseFetcher, Date.parse("2026-09-11T09:00:00Z"))).rebased, true);
  assert.equal((await store.read(request())).candles.length, dates.length+2);
  assert.equal((await store.read(request())).candles[0].volume, 101);
  database.close();
});
