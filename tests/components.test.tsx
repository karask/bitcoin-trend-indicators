import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ChartExplorer from "../app/ChartExplorer";
import CalibrationPanel from "../app/CalibrationPanel";
import ResearchPanel from "../app/ResearchPanel";
import SignalReadiness from "../app/SignalReadiness";
import SyncStatus from "../app/SyncStatus";
import MobileMatrix from "../app/MobileMatrix";
import AssetOverview from "../app/overview/AssetOverview";
import { OVERVIEW_ASSETS } from "../lib/asset-overview";
import { ASSETS } from "../lib/markets";
import { onRequestGet as dashboardHandler } from "../functions/api/v1/dashboard";
import { calculateIndicators, type Candle } from "../lib/regimes";
import { buildResearch } from "../lib/research";
import RegimeDashboard from "../app/RegimeDashboard";
import StockDashboard from "../app/stocks/StockDashboard";
import CommodityDashboard from "../app/commodities/CommodityDashboard";

const candles: Candle[] = Array.from({ length: 300 }, (_, index) => ({ time: Date.UTC(2020, 0, 6) + index * 7 * 86_400_000, open: 100 + index, high: 110 + index, low: 95 + index, close: 102 + index, volume: 10, complete: true }));
const signals = calculateIndicators(candles, "1w", { asset: "sui" });
const selected = signals.find(item => item.id === "kk_supertrend")!;

test("chart exploration exposes range, log scale, pan, fullscreen and keyboard affordances", () => {
  const html = renderToStaticMarkup(<ChartExplorer candles={candles} selected={{ ...selected, flips: [] }} denomination="USD" timeframe="1w" theme="light" />);
  for (const text of ["6M", "1Y", "3Y", "All", "Zoom in", "Zoom out", "Log scale", "Drag to pan", "Fullscreen", "Previous flip", "Next flip", "Pan through historical candles", "120 of 300 candles"]) assert.ok(html.includes(text), text);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Use left and right arrow keys/);
});

test("readiness has honest copy, not a neutral badge or invented test returns", () => {
  const html = renderToStaticMarkup(<SignalReadiness readiness={{ ready: false, availableCandles: 171, requiredCandles: 200, validStates: 0 }} lastFlip={null} timeframe="1w" market="crypto" />);
  assert.match(html, /Insufficient history/);
  assert.match(html, /171 \/ 200 weeks/);
  assert.match(html, /Not a neutral signal/);
});

test("calibration notebook exposes versioned evidence and uncalibrated equity labeling", () => {
  const sui = renderToStaticMarkup(<CalibrationPanel asset="sui" timeframe="1w" values={selected.values} />);
  assert.match(sui, /Screenshot-calibrated weekly preset/);
  assert.match(sui, /sui-weekly-supertrend\.png/);
  assert.match(sui, /Reference check passes/);
  assert.match(sui, /1\.0413/);
  assert.match(sui, /market-cap rule/);
  assert.match(sui, /Open calibration notebook/);
  assert.doesNotMatch(sui, /<details[^>]*\bopen=/);
  const stock = renderToStaticMarkup(<CalibrationPanel timeframe="1w" values={{ atrLength: 10, factor: 3 }} />);
  assert.match(stock, /Uncalibrated equity preset/);
  assert.match(stock, /identical to standard SuperTrend 10\/3/);
  assert.doesNotMatch(stock, /Reference check passes/);
  assert.doesNotMatch(stock, /<details[^>]*\bopen=/);
  const hype = renderToStaticMarkup(<CalibrationPanel asset="hype" timeframe="1w" values={{ atrLength: 15, factor: 2 }} />);
  assert.match(hype, /Screenshot-calibrated weekly preset/);
  assert.match(hype, /KuCoin USDT/);
  assert.match(hype, /shorter history/);
  const calibratedStock = renderToStaticMarkup(<CalibrationPanel stock="tsla" timeframe="1w" values={{ atrLength: 15, factor: 2 }} />);
  assert.match(calibratedStock, /Screenshot-calibrated weekly preset/);
  assert.match(calibratedStock, /383\.88/);
  assert.doesNotMatch(calibratedStock, /<details[^>]*\bopen=/);
  const spcx = renderToStaticMarkup(<CalibrationPanel stock="spcx" timeframe="1d" values={{ atrLength: 10, factor: 3 }} />);
  assert.match(spcx, /Ignored reference/);
  assert.doesNotMatch(spcx, /Archived reference check passes/);
});

test("research renders matched dates, benchmark, costs, curves, ledger and full windows", () => {
  const research = buildResearch(candles, signals, selected.id, "1w");
  const html = renderToStaticMarkup(<ResearchPanel research={research} selectedName={selected.shortName} />);
  for (const text of ["COMMON DATES", "15 bps", "5 / 15 / 30", "BUY-AND-HOLD", "Growth and drawdown", "Execution ledger", "ROLLING FOUR-YEAR", "overlap"]) assert.ok(html.includes(text), text);
  assert.match(html, /data-label="CAGR"/);
  assert.match(html, /<details/);
  const unavailable = buildResearch(candles.slice(0, 5), calculateIndicators(candles.slice(0, 5), "1w"), "ichimoku", "1w");
  const empty = renderToStaticMarkup(<ResearchPanel research={unavailable} selectedName="Ichimoku" />);
  assert.match(empty, /No allocation backtest/);
  assert.doesNotMatch(empty, /Execution ledger/);
});

test("both labs keep distinct controls with accessible timeframes and non-polling update actions", () => {
  const crypto = renderToStaticMarkup(<RegimeDashboard />);
  assert.match(crypto, /Market source/);
  assert.match(crypto, /Check for updates/);
  assert.match(crypto, /CURRENT BTC QUOTE/);
  assert.doesNotMatch(crypto, /LIVE BTC SPOT/);
  assert.match(crypto, /aria-pressed="true"/);
  assert.doesNotMatch(crypto, /KK watchlist|Pin current market|Check watchlist/);
  assert.match(crypto, /href="\/overview\/"/);
  for (const asset of ASSETS) assert.ok(crypto.includes(`value="${asset.id}"`), asset.id);
  const stock = renderToStaticMarkup(<StockDashboard />);
  assert.match(stock, /Yahoo Finance/);
  assert.match(stock, /Check for updates/);
  assert.match(stock, /Stocks/);
  assert.doesNotMatch(stock, /Market source|Tiingo|Binance|Kraken|CONFIRMATION CLOCK · UTC/);
  assert.doesNotMatch(stock, /KK watchlist|Pin current market|Check watchlist/);
  assert.match(stock, /href="\/overview\/"/);
});

test("commodity lab is distinct, clearly labelled futures, with accessible controls and shared status UI", () => {
  const html = renderToStaticMarkup(<CommodityDashboard />);
  for (const text of ["Gold futures", "Silver futures", "GC=F", "SI=F", "Futures, not spot", "USD per troy ounce", "Approximate weekly screenshot fit", "Check for updates", "CONFIRMATION CLOCK", "DATA SNAPSHOT", "FUTURES QUOTE", "not exchange settlement"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /NASDAQ|XNAS|Tiingo|Market source|Binance|Kraken|ADJUSTED CLOSE/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /href="\/commodities\/" aria-current="page"/);
});

test("metals and Bitmine notebooks disclose approximate fits and keep daily calibration separate", () => {
  for (const commodity of ["gold", "silver"] as const) {
    const weekly = renderToStaticMarkup(<CalibrationPanel commodity={commodity} timeframe="1w" values={{ atrLength: 10, factor: 2 }} />);
    assert.match(weekly, /Approximate feed-specific fit/);
    assert.ok(weekly.includes(`${commodity}.jpeg`));
    assert.match(weekly, /back-adjusted/);
    assert.doesNotMatch(weekly, /<details[^>]*\bopen=/);
    const daily = renderToStaticMarkup(<CalibrationPanel commodity={commodity} timeframe="1d" values={{ atrLength: 10, factor: 3 }} />);
    assert.match(daily, /Uncalibrated futures preset/);
    assert.match(daily, /does not validate this daily preset/);
  }
  const bmnr = renderToStaticMarkup(<CalibrationPanel stock="bmnr" timeframe="1w" values={{ atrLength: 29, factor: 1 }} />);
  assert.match(bmnr, /bitmine.jpeg/);
  assert.match(bmnr, /four-year tests are unavailable/);
  assert.doesNotMatch(bmnr, /<details[^>]*\bopen=/);
});

test("overview shows all assets crypto first, one global indicator selector and no pinning", () => {
  const html = renderToStaticMarkup(<AssetOverview />);
  assert.ok(html.indexOf('id="overview-crypto"') < html.indexOf('id="overview-stock"'));
  assert.ok(html.indexOf('id="overview-stock"') < html.indexOf('id="overview-commodity"'));
  for (const asset of OVERVIEW_ASSETS) assert.ok(html.includes(`<strong>${asset.symbol}</strong>`), asset.symbol);
  assert.equal((html.match(/<select/g) ?? []).length, 1);
  assert.match(html, /Indicator for all assets/);
  assert.match(html, /Check all assets/);
  assert.match(html, /No automatic polling/);
  assert.match(html, /Changing the indicator does not fetch data/);
  assert.match(html, /value="mayer"/);
  assert.match(html, /value="ma_200w"/);
  assert.doesNotMatch(html, /Pin current market|KK watchlist/);
});

test("mobile model rows expand and sync failures remain visible", () => {
  const mobile = renderToStaticMarkup(<MobileMatrix rows={[{ ...selected, dailyState: null, weeklyState: "bull", nextCondition: "Below $1.00" }]} selectedId={selected.id} onSelect={() => {}} />);
  assert.match(mobile, /<details/);
  assert.match(mobile, /View KK Supertrend chart/);
  const failed = renderToStaticMarkup(<SyncStatus status="failed" isCurrent={true} hasHistory={true} onRefresh={() => {}} />);
  assert.match(failed, /Update failed/);
  assert.doesNotMatch(failed, /Up to date/);
});

test("HYPE dashboard serves validated short weekly history without lowering other assets' gates", async () => {
  const source = "kraken", asset = "hype";
  const db = { prepare(sql: string) { return { bind(...args: unknown[]) { return {
    async first() { const weekly = args[2] === "1w"; return { market: "HYPE/USD", retrieved_at: "2026-09-08T10:00:00Z", checksum: "fixture", warning: null, first_candle: Date.UTC(2026, 1, 2), last_candle: Date.UTC(2026, 7, 31), candle_count: weekly ? 31 : 223 }; },
    async all() {
      if (sql.startsWith("SELECT source")) { assert.deepEqual(args, [asset, 200, 26]); return { results: [{ source }], success: true }; }
      const weekly = args[2] === "1w";
      return { results: Array.from({ length: weekly ? 31 : 223 }, (_, i) => ({ time: Date.UTC(2026, 1, 2) + i * 86_400_000 * (weekly ? 7 : 1), open: 20, high: 22, low: 19, close: 21, volume: 10, complete: 1 })), success: true };
    },
  }; } }; } };
  const response = await dashboardHandler({ request: new Request("https://test.invalid/api/v1/dashboard?asset=hype&source=kraken"), env: { REGIME_DB: db as never }, next: async () => new Response(), waitUntil() {} });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.daily.asset, "hype");
  assert.equal(body.daily.candles.length, 223);
  assert.equal(body.weekly.candles.length, 31);
  assert.equal(body.weekly.demo, false);
  assert.deepEqual(body.sources.map((item: { id: string }) => item.id), ["kraken"]);
});
