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
import { calculateIndicators, type Candle } from "../lib/regimes";
import { buildResearch } from "../lib/research";
import RegimeDashboard from "../app/RegimeDashboard";
import StockDashboard from "../app/stocks/StockDashboard";

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
  const stock = renderToStaticMarkup(<StockDashboard />);
  assert.match(stock, /Yahoo Finance/);
  assert.match(stock, /Check for updates/);
  assert.match(stock, /Stocks/);
  assert.doesNotMatch(stock, /Market source|Tiingo|Binance|Kraken|CONFIRMATION CLOCK · UTC/);
  assert.doesNotMatch(stock, /KK watchlist|Pin current market|Check watchlist/);
  assert.match(stock, /href="\/overview\/"/);
});

test("overview shows all assets crypto first, one global indicator selector and no pinning", () => {
  const html = renderToStaticMarkup(<AssetOverview />);
  assert.ok(html.indexOf('id="overview-crypto"') < html.indexOf('id="overview-stock"'));
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
