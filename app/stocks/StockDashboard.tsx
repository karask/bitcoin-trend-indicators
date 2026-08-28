"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Static Pages output publishes independent HTML shells without route RSC payloads. */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import RegimeChart, { chartColorCss, type Theme } from "../RegimeChart";
import { resolveInitialTheme } from "../../lib/chart-interaction";
import {
  INDICATOR_SPECS,
  backtest,
  buyAndHold,
  calculateIndicators,
  familyAgreement,
  type BacktestSummary,
  type Candle,
  type IndicatorRole,
  type RegimeState,
  type SignalSnapshot,
  type Timeframe,
} from "../../lib/regimes";
import { aggregateStockWeeks, STOCKS, STOCK_DATA_ATTRIBUTION, type StockDefinition, type StockHistoryResponse, type StockId } from "../../lib/stocks";

type StockHistory = {
  stock: StockDefinition;
  daily: Candle[];
  weekly: Candle[];
  retrievedAt: string;
  provider: StockHistoryResponse["provider"];
  providerUrl: StockHistoryResponse["providerUrl"];
  exchange: StockHistoryResponse["exchange"];
  adjustmentBasis: string;
  quality: StockHistoryResponse["quality"];
};

type ApiRecord = Record<string, unknown>;

const TOKEN_KEY = "stock-regime-tiingo-token";
const ROLE_OPTIONS: Array<{ id: IndicatorRole; label: string }> = [
  { id: "regime", label: "Regime" },
  { id: "confirmation", label: "Confirmation" },
  { id: "exit", label: "Exit" },
  { id: "valuation", label: "Valuation" },
];
const REGIME_FAMILIES = ["smoothing/order", "ATR/trailing stop", "breakout", "momentum", "cloud/projected support"];
const EQUITY_OPTIONS = { market: "equity" as const, kkSupertrendFactor: 3 };

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : {};
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asCandles(value: unknown): Candle[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap(row => {
    const item = asRecord(row);
    const candle: Candle = {
      time: Number(item.time),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume) || 0,
      complete: item.complete !== false,
    };
    return [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) ? [candle] : [];
  }).sort((a, b) => a.time - b.time);
}

function normalizeHistory(body: unknown, requested: StockDefinition): StockHistory {
  const payload = body as StockHistoryResponse;
  const daily = asCandles(payload.candles);
  const retrievedAt = asString(payload.retrievedAt, new Date().toISOString());
  const weekly = aggregateStockWeeks(daily, Date.parse(retrievedAt));
  if (!daily.length || !weekly.length) throw new Error("Tiingo history did not include usable daily and weekly candles.");
  if (payload.stock?.symbol !== requested.symbol) throw new Error("Stock history returned a different symbol than requested.");
  return {
    stock: payload.stock,
    daily,
    weekly,
    retrievedAt,
    provider: payload.provider,
    providerUrl: payload.providerUrl,
    exchange: payload.exchange,
    adjustmentBasis: payload.adjustment === "split-and-dividend-adjusted" ? "Split- and dividend-adjusted OHLCV" : "Adjusted OHLCV",
    quality: payload.quality,
  };
}

function formatPrice(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 0 : 2 }).format(value);
}

function formatPct(value: number | null | undefined, signed = false) {
  return value == null || !Number.isFinite(value) ? "—" : `${signed && value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatDate(value: number | string | null | undefined, includeTime = false) {
  if (value == null) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}), timeZone: includeTime ? "America/New_York" : "UTC" }).format(date);
}

function titleState(state: RegimeState | null | undefined) {
  return state === "bull" ? "Bullish" : state === "bear" ? "Bearish" : state === "neutral" ? "Neutral" : "Unavailable";
}

function roleStateLabel(role: IndicatorRole, id: string, state: RegimeState | null | undefined) {
  if (!state) return undefined;
  if (role === "confirmation") return state === "bull" ? "Positive" : state === "bear" ? "Negative" : "No confirmation";
  if (role === "exit") return state === "bull" ? "Stop intact" : state === "bear" ? "Exit condition" : "N/A";
  if (role === "valuation") return id === "mayer" ? "Context" : state === "bull" ? "Above baseline" : state === "bear" ? "Below baseline" : "Context";
  return undefined;
}

function StateBadge({ state, compact = false, label }: { state: RegimeState | null | undefined; compact?: boolean; label?: string }) {
  const value = state ?? "neutral";
  return <span className={`state-badge ${value} ${compact ? "compact" : ""}`}><i />{label ?? titleState(state)}</span>;
}

function nextCondition(signal: SignalSnapshot) {
  if (signal.thresholdKind === "conditional") return "Conditional";
  if (signal.state === "bull" && signal.bearTrigger != null) return `Below ${formatPrice(signal.bearTrigger)}`;
  if (signal.state === "bear" && signal.bullTrigger != null) return `Above ${formatPrice(signal.bullTrigger)}`;
  if (signal.bullTrigger != null && signal.bearTrigger != null && signal.bullTrigger !== signal.bearTrigger) return `${formatPrice(signal.bearTrigger)}–${formatPrice(signal.bullTrigger)}`;
  if (signal.bullTrigger != null) return formatPrice(signal.bullTrigger);
  return signal.thresholdKind === "provisional" ? "Provisional" : "Conditional";
}

function chartView(signal: SignalSnapshot, candles: Candle[], timeframe: Timeframe) {
  const visibleCount = timeframe === "1d" ? 180 : 120;
  const start = Math.max(0, candles.length - visibleCount);
  const visibleCandles = candles.slice(start);
  const visibleTimes = new Set(visibleCandles.map(candle => candle.time));
  const flips: Array<{ time: number; from: RegimeState; to: RegimeState; close: number }> = [];
  let prior: RegimeState | null = null;
  signal.states.forEach((state, index) => {
    if (!state) return;
    if (prior && state !== prior && visibleTimes.has(candles[index].time)) flips.push({ time: candles[index].time, from: prior, to: state, close: candles[index].close });
    prior = state;
  });
  return {
    candles: visibleCandles,
    selected: {
      ...signal,
      states: signal.states.slice(start),
      overlays: signal.overlays.map(line => ({ ...line, points: line.points.filter(point => visibleTimes.has(point.time)) })),
      ribbons: signal.ribbons.map(ribbon => ({ ...ribbon, points: ribbon.points.filter(point => visibleTimes.has(point.time)) })),
      events: signal.events.filter(event => visibleTimes.has(event.time)),
      barColors: signal.barColors.filter(point => visibleTimes.has(point.time)),
      flips: signal.id === "super_guppy" ? [] : flips,
    },
  };
}

function rollingFourYear(candles: Candle[], signal: SignalSnapshot, timeframe: Timeframe) {
  if (signal.role !== "regime") return [];
  const periodsPerYear = timeframe === "1d" ? 252 : 52;
  const windowSize = periodsPerYear * 4;
  const rows: Array<{ start: number; end: number; result: BacktestSummary }> = [];
  for (let start = 0; start + windowSize <= candles.length; start += periodsPerYear) {
    const end = start + windowSize;
    const result = backtest(candles.slice(start, end), [{ ...signal, states: signal.states.slice(start, end) }], timeframe, 15, { periodsPerYear })[0];
    if (result) rows.push({ start: candles[start].time, end: candles[end - 1].time, result });
  }
  return rows;
}

function LoadingView() {
  return <div className="loading-grid" aria-label="Loading stock research"><div className="loading-block chart-load" /><div className="loading-block side-load" /><div className="loading-block table-load" /></div>;
}

export default function StockDashboard() {
  const [stockId, setStockId] = useState<StockId>("tsla");
  const [timeframe, setTimeframe] = useState<Timeframe>("1w");
  const [indicator, setIndicator] = useState("support_band");
  const [role, setRole] = useState<IndicatorRole>("regime");
  const [theme, setTheme] = useState<Theme>("light");
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeStock = STOCKS.find(item => item.id === stockId) ?? STOCKS[0];

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const saved = window.localStorage.getItem("crypto-regime-theme");
    const initial = resolveInitialTheme(saved, media.matches);
    root.dataset.theme = initial;
    const frame = window.requestAnimationFrame(() => setTheme(initial));
    const followSystem = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem("crypto-regime-theme")) return;
      const next: Theme = event.matches ? "dark" : "light";
      root.dataset.theme = next;
      setTheme(next);
    };
    media.addEventListener("change", followSystem);
    return () => { window.cancelAnimationFrame(frame); media.removeEventListener("change", followSystem); };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    const frame = window.requestAnimationFrame(() => { if (saved) setLoading(true); setToken(saved); setTokenReady(true); });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`/api/v1/stocks/history?symbol=${activeStock.symbol}`, {
      headers: { Authorization: `Token ${token}` },
      cache: "no-store",
      signal: controller.signal,
    }).then(async response => {
      const body = await response.json() as ApiRecord;
      if (!response.ok) throw new Error(asString(body.error, response.status === 401 ? "Tiingo rejected this API token." : `Stock history returned HTTP ${response.status}.`));
      return normalizeHistory(body, activeStock);
    }).then(result => {
      setHistory(result);
      setLoading(false);
    }).catch(reason => {
      if (reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Stock history is unavailable.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [activeStock, refreshKey, token]);

  const calculation = useMemo(() => {
    if (!history) return null;
    const dailySignals = calculateIndicators(history.daily, "1d", EQUITY_OPTIONS);
    const weeklySignals = calculateIndicators(history.weekly, "1w", EQUITY_OPTIONS);
    const signals = timeframe === "1d" ? dailySignals : weeklySignals;
    const counterpart = timeframe === "1d" ? weeklySignals : dailySignals;
    const candles = timeframe === "1d" ? history.daily : history.weekly;
    const selected = signals.find(item => item.id === indicator) ?? signals.find(item => item.id === "support_band") ?? signals[0];
    const annualization = { periodsPerYear: timeframe === "1d" ? 252 : 52 };
    const backtests = backtest(candles, signals, timeframe, 15, annualization);
    const sensitivity = [5, 15, 30].map(costBps => ({ costBps, result: backtest(candles, signals, timeframe, costBps, annualization).find(row => row.indicatorId === selected.id) ?? null }));
    const benchmark = buyAndHold(candles, timeframe, 15, annualization);
    const rolling = rollingFourYear(candles, selected, timeframe);
    const sortedRollingCagr = rolling.map(row => row.result.cagr).sort((a, b) => a - b);
    const rollingSummary = rolling.length ? {
      medianCagr: sortedRollingCagr[Math.floor(sortedRollingCagr.length / 2)],
      positiveWindows: rolling.filter(row => row.result.totalReturn > 0).length,
      worstDrawdown: Math.min(...rolling.map(row => row.result.maxDrawdown)),
    } : null;
    return { dailySignals, weeklySignals, signals, counterpart, backtests, sensitivity, benchmark, rolling, rollingSummary, familyAgreement: familyAgreement(signals), historyCandleCount: candles.length, ...chartView(selected, candles, timeframe) };
  }, [history, indicator, timeframe]);

  const options = INDICATOR_SPECS.filter(item => item.supportedTimeframes.includes(timeframe));
  const visibleBacktests = useMemo(() => {
    if (!calculation) return [];
    const ranked = calculation.backtests.slice(0, 8);
    const selected = calculation.backtests.find(row => row.indicatorId === calculation.selected.id);
    return selected && !ranked.some(row => row.indicatorId === selected.indicatorId) ? [...ranked, selected] : ranked;
  }, [calculation]);
  const matrixRows = calculation?.signals.filter(item => item.role === role) ?? [];
  const current = calculation?.candles.at(-1);
  const prior = calculation?.candles.at(-2);
  const change = current && prior ? current.close / prior.close - 1 : null;
  const familyRows = useMemo(() => REGIME_FAMILIES.map(family => {
    const members = calculation?.signals.filter(item => item.role === "regime" && item.family === family) ?? [];
    const state: RegimeState = members.length && members.every(item => item.state === "bull") ? "bull" : members.length && members.every(item => item.state === "bear") ? "bear" : "neutral";
    return { family, members: members.length, state };
  }), [calculation]);

  const saveToken = (event: FormEvent) => {
    event.preventDefault();
    const value = tokenInput.trim();
    if (!value) return;
    window.sessionStorage.setItem(TOKEN_KEY, value);
    setHistory(null);
    setError(null);
    setLoading(true);
    setToken(value);
    setTokenInput("");
  };
  const forgetToken = () => {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenInput("");
    setHistory(null);
    setError(null);
  };
  const chooseStock = (next: StockId) => {
    setStockId(next);
    setHistory(null);
    setError(null);
    setLoading(true);
  };
  const refreshHistory = () => { setLoading(true); setError(null); setRefreshKey(value => value + 1); };
  const chooseTimeframe = (next: Timeframe) => {
    const currentSpec = INDICATOR_SPECS.find(item => item.id === indicator);
    const replacement = currentSpec?.supportedTimeframes.includes(next) ? currentSpec : INDICATOR_SPECS.find(item => item.role === role && item.supportedTimeframes.includes(next));
    setTimeframe(next);
    if (replacement) setIndicator(replacement.id);
  };
  const chooseRole = (next: IndicatorRole) => {
    setRole(next);
    const replacement = INDICATOR_SPECS.find(item => item.role === next && item.supportedTimeframes.includes(timeframe));
    if (replacement) setIndicator(replacement.id);
  };
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("crypto-regime-theme", next);
    setTheme(next);
  };

  const triggerLabels = calculation?.selected.role === "exit" ? ["SHORT EXIT ABOVE", "LONG EXIT BELOW"] : calculation?.selected.role === "confirmation" ? ["POSITIVE ABOVE", "NEGATIVE BELOW"] : ["BULLISH ABOVE", "BEARISH BELOW"];
  const triggerCard = (label: string, value: number | null, variant: string) => <div className={`trigger ${variant}`}><span>{label}</span><strong>{value == null ? "Conditional" : formatPrice(value)}</strong><small>{calculation?.selected.thresholdKind} · completed {timeframe === "1d" ? "session" : "week"}</small></div>;

  return <main className="app-shell stock-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark stock-mark">{activeStock.symbol}</div><div><p className="eyebrow">STOCK REGIME LAB · {activeStock.label.toUpperCase()}</p><h1>Equity trends, on completed sessions.</h1></div></div><div className="header-actions"><nav className="lab-nav" aria-label="Research labs"><a href="/">Crypto</a><a href="/stocks" aria-current="page">Stocks</a></nav>{history && <div className="freshness"><span />Confirmed · {formatDate(history.daily.at(-1)?.time)}</div>}<button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><b>{theme === "dark" ? "Light" : "Dark"}</b></button></div></header>

    {!token && <section className="token-gate" aria-labelledby="tiingo-token-title"><div><p className="eyebrow">PRIVATE DATA ACCESS</p><h2 id="tiingo-token-title">Connect your free Tiingo API token</h2><p>The token is sent only to the stock-history endpoint and kept in this browser tab&apos;s session storage. It is never placed in a URL, shared cache, or public dataset.</p><a href="https://www.tiingo.com/account/api/token" target="_blank" rel="noreferrer">Open Tiingo token page ↗</a></div><form onSubmit={saveToken}><label htmlFor="tiingo-token">Tiingo API token</label><div><input id="tiingo-token" type="password" value={tokenInput} onChange={event => setTokenInput(event.target.value)} autoComplete="off" spellCheck={false} placeholder={tokenReady ? "Paste a fresh token" : "Checking this browser session…"} aria-describedby="token-safety" /><button type="submit" disabled={!tokenInput.trim()}>Load stock history</button></div><small id="token-safety">Use a freshly rotated token if one was ever pasted into chat, email, or another shared location.</small></form></section>}

    {token && <>
      {error && <div className="data-banner danger"><strong>Stock data unavailable</strong><span>{error}</span><button type="button" onClick={refreshHistory}>Retry</button></div>}
      <section className="command-row" aria-label="Stock research controls"><div className="control-group asset-control"><label htmlFor="stock">Stock</label><select id="stock" value={stockId} onChange={event => chooseStock(event.target.value as StockId)}>{STOCKS.map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.label}</option>)}</select></div><div className="control-group stock-provider"><span className="control-label">Data provider</span><div className="provider-value">Tiingo · NASDAQ</div></div><div className="control-group grow"><label htmlFor="stock-indicator">Indicator</label><select id="stock-indicator" value={indicator} onChange={event => { setIndicator(event.target.value); const nextRole = INDICATOR_SPECS.find(item => item.id === event.target.value)?.role; if (nextRole) setRole(nextRole); }}>{options.map(item => <option key={item.id} value={item.id}>{item.displayName}{item.id === "kk_supertrend" ? " · uncalibrated equity preset" : ""}</option>)}</select></div><div className="segmented" aria-label="Timeframe"><button type="button" className={timeframe === "1d" ? "active" : ""} onClick={() => chooseTimeframe("1d")}>1D</button><button type="button" className={timeframe === "1w" ? "active" : ""} onClick={() => chooseTimeframe("1w")}>1W</button></div></section>
      <section className="stock-session-strip"><div><p className="eyebrow">LATEST COMPLETED NASDAQ SESSION</p><strong>{history ? formatDate(history.daily.at(-1)?.time) : "Loading adjusted history…"}</strong><span>{history ? `${history.stock.symbol} · ${history.adjustmentBasis}` : "Daily and Monday-based weekly bars"}</span></div><div><span>Retrieved</span><b>{history ? formatDate(history.retrievedAt, true) : "—"}</b><small>America/New_York</small></div><div className="stock-session-actions"><button type="button" onClick={refreshHistory} disabled={loading}>↻ {loading ? "Refreshing…" : "Refresh data"}</button><button type="button" className="forget-token" onClick={forgetToken}>Forget token</button></div></section>

      {loading && !history ? <LoadingView /> : calculation && history && <>
        <section className={`hero-grid ${loading ? "is-refreshing" : ""}`}><article className="chart-card"><div className="chart-heading"><div><p className="eyebrow">LAST CONFIRMED {timeframe === "1d" ? "DAILY" : "WEEKLY"} ADJUSTED CLOSE · {history.stock.exchange} · TIINGO</p><div className="price-line"><strong>{formatPrice(current?.close)}</strong><span className={change != null && change < 0 ? "negative" : ""}>{formatPct(change, true)}</span></div></div><StateBadge state={calculation.selected.state} label={roleStateLabel(calculation.selected.role, calculation.selected.id, calculation.selected.state)} /></div><div className="chart-frame"><RegimeChart candles={calculation.candles} selected={calculation.selected} denomination="USD" timeframe={timeframe} theme={theme} />{loading && <div className="chart-refresh">Refreshing adjusted candles…</div>}</div><div className="chart-legend">{calculation.selected.overlays.filter(line => line.showInLegend !== false).map(line => <span key={line.name}><i style={{ background: chartColorCss(line.color) }} />{line.legendLabel ?? line.name}</span>)}{calculation.selected.ribbons.filter(ribbon => ribbon.showInLegend !== false).flatMap(ribbon => (Object.entries(ribbon.palette) as Array<[RegimeState, string]>).map(([state, color]) => <span key={`${ribbon.id}-${state}`}><i className="range-swatch" style={{ background: chartColorCss(color) }} />{titleState(state)} range</span>))}<span><i className="flip-dot" />Confirmed flip</span><span className="method-note">Signals effective next session open</span></div></article>
          <aside className="signal-panel"><p className="eyebrow">CURRENT EVIDENCE</p><h2>{calculation.selected.shortName}</h2><div className="current-state-row"><StateBadge state={calculation.selected.state} label={roleStateLabel(calculation.selected.role, calculation.selected.id, calculation.selected.state)} /><span>since {formatDate(calculation.selected.lastFlip)}</span></div>{calculation.selected.role !== "valuation" && (calculation.selected.bullTrigger != null || calculation.selected.bearTrigger != null) && <>{triggerCard(triggerLabels[0], calculation.selected.bullTrigger, "bull-trigger")}{triggerCard(triggerLabels[1], calculation.selected.bearTrigger, "bear-trigger")}</>}<div className="method-card"><span>RULE</span><p>{calculation.selected.explanation}</p><b>{calculation.selected.triggerLabel}</b></div>{calculation.selected.id === "kk_supertrend" && <div className="proxy-note"><strong>Uncalibrated equity preset</strong>ATR 10 with factor 3 is used for stocks. This is identical to standard SuperTrend 10/3 and is not calibrated from the crypto screenshots.</div>}{calculation.selected.id === "mayer" && <div className="proxy-note"><strong>Equity interpretation</strong>Shown as the price-to-200-day-average ratio, not as an intrinsic valuation measure.</div>}<p className="disclaimer">Research view only. No live orders or individualized allocation advice.</p></aside></section>

        <section className="guidance-card" aria-label={`${calculation.selected.displayName} interpretation guide`}><div className="guidance-heading"><div><p className="eyebrow">HOW TO INTERPRET IT</p><h2>{calculation.selected.guidance.summary}</h2></div>{calculation.selected.sourceUrl && <a href={calculation.selected.sourceUrl} target="_blank" rel="noreferrer">Published method ↗</a>}</div><div className="guidance-grid">{[calculation.selected.guidance.positive, calculation.selected.guidance.neutral, calculation.selected.guidance.negative].map((item, index) => <article className={["positive", "neutral", "negative"][index]} key={item.label}><span>{item.label}</span><p>{item.rule}</p></article>)}</div><div className="guidance-notes"><p><strong>Why this rule exists</strong>{calculation.selected.guidance.rationale}</p><ul>{calculation.selected.guidance.caveats.map(caveat => <li key={caveat}>{caveat}</li>)}</ul></div></section>

        <section className="family-strip" aria-label="Regime family agreement"><div><p className="eyebrow">FAMILY AGREEMENT</p><h2>Correlated models get one family voice</h2></div><div className="family-summary"><b className="bull-text">{calculation.familyAgreement.bull} bull</b><b className="neutral-text">{calculation.familyAgreement.neutral} neutral</b><b className="bear-text">{calculation.familyAgreement.bear} bear</b></div><div className="family-chips">{familyRows.map(row => <span key={row.family} className={row.state}><i />{row.family}<small>{row.members} model{row.members === 1 ? "" : "s"}</small></span>)}</div></section>

        <section className="matrix-card"><div className="section-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>Current stock state matrix</h2></div><div className="category-tabs" role="tablist">{ROLE_OPTIONS.map(item => <button type="button" role="tab" aria-selected={role === item.id} className={role === item.id ? "active" : ""} key={item.id} onClick={() => chooseRole(item.id)}>{item.label}</button>)}</div></div><div className="matrix-table"><div className="matrix-header"><span>Model</span><span>Family</span><span>Daily</span><span>Weekly</span><span>Last flip</span><span>Next condition</span></div>{matrixRows.map(item => { const other = calculation.counterpart.find(candidate => candidate.id === item.id); const dailyState = timeframe === "1d" ? item.state : other?.state; const weeklyState = timeframe === "1w" ? item.state : other?.state; return <button type="button" className={`matrix-row ${indicator === item.id ? "selected" : ""}`} key={item.id} onClick={() => setIndicator(item.id)}><span><strong>{item.shortName}</strong><small>{item.thresholdKind}</small></span><span>{item.family}</span><StateBadge state={dailyState} label={roleStateLabel(item.role, item.id, dailyState)} compact /><StateBadge state={weeklyState} label={roleStateLabel(item.role, item.id, weeklyState)} compact /><span>{formatDate(item.lastFlip)}</span><b>{nextCondition(item)}</b></button>; })}{!matrixRows.length && <p className="empty-state">No {role} model supports this timeframe.</p>}</div><p className="matrix-footnote">Daily bars are completed XNAS sessions. Weekly bars use the actual sessions in each Monday-based trading week; missing expected sessions are rejected rather than filled.</p></section>

        <section className="research-grid"><article className="research-card wide"><div className="section-heading"><div><p className="eyebrow">NEXT-SESSION-OPEN BACKTEST</p><h2>Fixed presets, equity annualization</h2></div><span className="assumption-pill">252 daily · 52 weekly</span></div><div className="backtest-table"><div className="backtest-head"><span>Model</span><span>CAGR</span><span>Max DD</span><span>Calmar</span><span>Exposure</span><span>Flips</span></div>{visibleBacktests.map(row => <div className="backtest-row" key={row.indicatorId}><strong>{row.displayName}</strong><span>{formatPct(row.cagr)}</span><span className="negative">{formatPct(row.maxDrawdown)}</span><b>{row.calmar?.toFixed(2) ?? "—"}</b><span>{formatPct(row.exposure)}</span><span>{row.flips}</span></div>)}</div></article>
          <article className="research-card"><p className="eyebrow">COST SENSITIVITY · {calculation.selected.shortName.toUpperCase()}</p><h2>5 / 15 / 30 bps turnover</h2><dl>{calculation.sensitivity.map(row => <div key={row.costBps}><dt>{row.costBps} bps</dt><dd>{row.result ? `${formatPct(row.result.cagr)} CAGR · ${row.result.calmar?.toFixed(2) ?? "—"} Calmar` : "N/A"}</dd></div>)}</dl><p>Signals execute at the next completed session&apos;s open. Bull is 100%, neutral 50%, and bear 0% exposure.</p></article>
          <article className="research-card"><p className="eyebrow">BUY-AND-HOLD COMPARISON · 15 BPS</p><h2>{activeStock.symbol} benchmark</h2><dl><div><dt>Buy-and-hold CAGR</dt><dd>{formatPct(calculation.benchmark?.cagr)}</dd></div><div><dt>Buy-and-hold max DD</dt><dd>{formatPct(calculation.benchmark?.maxDrawdown)}</dd></div><div><dt>{calculation.selected.shortName} CAGR</dt><dd>{formatPct(calculation.backtests.find(row => row.indicatorId === calculation.selected.id)?.cagr)}</dd></div><div><dt>{calculation.selected.shortName} max DD</dt><dd>{formatPct(calculation.backtests.find(row => row.indicatorId === calculation.selected.id)?.maxDrawdown)}</dd></div></dl><p>Comparison uses adjusted prices and the same next-open measurement window.</p></article>
          <article className="research-card wide"><div className="section-heading"><div><p className="eyebrow">ROLLING FOUR-YEAR RESEARCH · 15 BPS</p><h2>{calculation.selected.shortName} across annual start windows</h2></div><span className="assumption-pill">{timeframe === "1d" ? "1,008 sessions · 252 step" : "208 weeks · 52 step"}</span></div>{calculation.rollingSummary ? <><dl className="rolling-summary"><div><dt>Median window CAGR</dt><dd>{formatPct(calculation.rollingSummary.medianCagr)}</dd></div><div><dt>Positive windows</dt><dd>{calculation.rollingSummary.positiveWindows} / {calculation.rolling.length}</dd></div><div><dt>Worst window drawdown</dt><dd>{formatPct(calculation.rollingSummary.worstDrawdown)}</dd></div></dl><div className="rolling-table"><div className="rolling-head"><span>Window</span><span>CAGR</span><span>Max DD</span><span>Calmar</span></div>{calculation.rolling.slice(-6).map(row => <div className="rolling-row" key={row.start}><strong>{formatDate(row.start)} – {formatDate(row.end)}</strong><span>{formatPct(row.result.cagr)}</span><span className="negative">{formatPct(row.result.maxDrawdown)}</span><b>{row.result.calmar?.toFixed(2) ?? "—"}</b></div>)}</div></> : <p className="empty-state">Rolling four-year results apply to regime models once enough history is available.</p>}</article>
          <article className="research-card wide"><p className="eyebrow">DATA PROVENANCE</p><h2>{history.provider.label} · {history.exchange}</h2><dl><div><dt>Calculation history</dt><dd>{calculation.historyCandleCount.toLocaleString()} adjusted bars</dd></div><div><dt>Visible chart</dt><dd>Last {calculation.candles.length.toLocaleString()} bars</dd></div><div><dt>Series begins</dt><dd>{formatDate((timeframe === "1d" ? history.daily : history.weekly)[0]?.time)}</dd></div><div><dt>Adjustment basis</dt><dd>{history.adjustmentBasis}</dd></div><div><dt>Quality</dt><dd>{Object.values(history.quality).every(value => value === 0) ? "Passed" : "Review"}</dd></div><div><dt>Storage</dt><dd>Browser memory only</dd></div></dl><p>{STOCK_DATA_ATTRIBUTION} via <a href={history.providerUrl} target="_blank" rel="noreferrer">Tiingo EOD</a>. Stock candles are not written to D1, SQLite, DuckDB, the service worker, or a shared application cache.</p></article></section>
        <footer><p>Stock Regime Lab separates price regimes, confirmation, exits, and price-ratio context. Presets are not optimized against {activeStock.label} history.</p><nav><a href="/">Crypto Regime Lab</a><a href="https://www.tiingo.com/documentation/end-of-day" target="_blank" rel="noreferrer">Tiingo EOD documentation</a></nav></footer>
      </>}
    </>}
  </main>;
}
