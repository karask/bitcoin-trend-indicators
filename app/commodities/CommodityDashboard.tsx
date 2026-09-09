"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Static Pages output publishes independent HTML shells without route RSC payloads. */

import { useEffect, useMemo, useState } from "react";
import { chartColorCss, type Theme } from "../RegimeChart";
import ChartExplorer from "../ChartExplorer";
import CalibrationPanel from "../CalibrationPanel";
import { calibrationStatus } from "../../lib/kk-calibration";
import ResearchPanel from "../ResearchPanel";
import SignalReadiness from "../SignalReadiness";
import SyncStatus from "../SyncStatus";
import LabNavigation from "../LabNavigation";
import MobileMatrix from "../MobileMatrix";
import { useSavedView } from "../useSavedView";
import { formatPrice, quoteAge } from "../../lib/display";
import { buildResearch } from "../../lib/research";
import { loadCommodityHistory, requestJson, historyIsCurrent, type SyncStatus as SyncState } from "../../lib/history-client";
import { resolveInitialTheme } from "../../lib/chart-interaction";
import {
  INDICATOR_SPECS,
  calculateIndicators,
  familyAgreement,
  familyRows as getFamilyRows,
  type Candle,
  type IndicatorRole,
  type RegimeState,
  type SignalSnapshot,
  type Timeframe,
} from "../../lib/regimes";
import { aggregateCommodityWeeks, commodityConfirmationClock, COMMODITIES, COMMODITY_CAVEAT, type CommodityDefinition, type CommodityHistoryResponse, type CommodityId, type CommodityQuote } from "../../lib/commodities";
import { AccountControls, authenticatedFetch } from "../AuthClient";

type CommodityHistory = {
  response: CommodityHistoryResponse;
  commodity: CommodityDefinition;
  daily: Candle[];
  weekly: Candle[];
  retrievedAt: string;
  provider: CommodityHistoryResponse["provider"];
  providerUrl: CommodityHistoryResponse["providerUrl"];
  exchange: CommodityHistoryResponse["exchange"];
  adjustmentBasis: string;
  quality: CommodityHistoryResponse["quality"];
};

type ApiRecord = Record<string, unknown>;

const ROLE_OPTIONS: Array<{ id: IndicatorRole; label: string }> = [
  { id: "regime", label: "Regime" },
  { id: "confirmation", label: "Confirmation" },
  { id: "exit", label: "Exit" },
  { id: "valuation", label: "Valuation" },
];
const COMMODITY_OPTIONS = { market: "commodity" as const };

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

function normalizeHistory(body: unknown, requested: CommodityDefinition): CommodityHistory {
  const payload = body as CommodityHistoryResponse;
  const daily = asCandles(payload.candles);
  const retrievedAt = asString(payload.retrievedAt, new Date().toISOString());
  const weekly = aggregateCommodityWeeks(daily, Date.parse(retrievedAt));
  if (!daily.length || !weekly.length) throw new Error("Stored Yahoo Finance history did not include usable daily and weekly candles.");
  if (payload.commodity?.symbol !== requested.symbol) throw new Error("Commodity history returned a different symbol than requested.");
  return {
    response: payload,
    commodity: payload.commodity,
    daily,
    weekly,
    retrievedAt,
    provider: payload.provider,
    providerUrl: payload.providerUrl,
    exchange: payload.exchange,
    adjustmentBasis: "Provider continuous futures · roll adjustment unverified",
    quality: payload.quality,
  };
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
  const value = state ?? "unavailable";
  return <span className={`state-badge ${value} ${compact ? "compact" : ""}`}><i />{label ?? titleState(state)}</span>;
}

function nextCondition(signal: SignalSnapshot) {
  if (signal.readiness?.ready === false) return "Insufficient history";
  if (signal.thresholdKind === "conditional") return "Conditional";
  if (signal.state === "bull" && signal.bearTrigger != null) return `Below ${formatPrice(signal.bearTrigger)}`;
  if (signal.state === "bear" && signal.bullTrigger != null) return `Above ${formatPrice(signal.bullTrigger)}`;
  if (signal.bullTrigger != null && signal.bearTrigger != null && signal.bullTrigger !== signal.bearTrigger) return `${formatPrice(signal.bearTrigger)}–${formatPrice(signal.bullTrigger)}`;
  if (signal.bullTrigger != null) return formatPrice(signal.bullTrigger);
  return signal.thresholdKind === "provisional" ? "Provisional" : "Conditional";
}

function chartView(signal: SignalSnapshot, candles: Candle[]) {
  const start = 0;
  const visibleCandles = candles;
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

function LoadingView() {
  return <div className="loading-grid" aria-label="Loading commodity research"><div className="loading-block chart-load" /><div className="loading-block side-load" /><div className="loading-block table-load" /></div>;
}

export default function CommodityDashboard() {
  const { view, setView, ready: viewReady } = useSavedView("commodity");
  const commodityId = view.asset as CommodityId, timeframe = view.timeframe, indicator = view.indicator;
  const role = INDICATOR_SPECS.find(item => item.id === indicator)?.role ?? "regime";
  const setIndicator = (next: string) => setView(current => ({ ...current, indicator: next }));
  const [theme, setTheme] = useState<Theme>("light");
  const [loadedHistory, setHistory] = useState<CommodityHistory | null>(null);
  const history = loadedHistory?.commodity.id === commodityId ? loadedHistory : null;
  const [syncState, setSyncState] = useState<SyncState>("checking");
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedQuote, setQuote] = useState<CommodityQuote | null>(null);
  const quote = loadedQuote?.commodity.id === commodityId ? loadedQuote : null;
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [clock, setClock] = useState(0);

  const activeCommodity = COMMODITIES.find(item => item.id === commodityId) ?? COMMODITIES[0];

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
    const frame = window.requestAnimationFrame(() => setClock(Date.now()));
    const clockTimer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(clockTimer); };
  }, []);

  useEffect(() => {
    if (!viewReady) return;
    const controller = new AbortController();
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null); setSyncState("checking"); setCacheMessage(null);
      const result = await loadCommodityHistory(activeCommodity.symbol, authenticatedFetch, controller.signal, cached => {
        if (!cancelled) { setHistory(normalizeHistory(cached, activeCommodity)); setCacheMessage("Loaded from this browser's private candle cache; checking for newer data."); }
      });
      if (cancelled) return;
      setHistory(normalizeHistory(result.history, activeCommodity)); setLoading(false); setSyncState(result.status);
      setCacheMessage(!result.cacheSaved ? "History loaded, but the browser cache could not be saved." : result.rebased ? "Full history refreshed after a provider correction or incomplete local cache." : "New sessions and recent corrections checked; older history stays local.");
    };
    void load().catch(reason => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : "Commodity history is unavailable.");
      setSyncState("failed"); setLoading(false);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [activeCommodity, viewReady, refreshKey]);

  useEffect(() => {
    if (!viewReady) return;
    const controller = new AbortController();
    let cancelled = false;
    requestJson<CommodityQuote>(authenticatedFetch, `/api/v1/commodities/quote?symbol=${activeCommodity.symbol}`, { signal: controller.signal }, 12_000)
      .then(body => { if (!cancelled) { setQuote(body); setQuoteError(null); } })
      .catch(reason => { if (!cancelled) setQuoteError(reason instanceof Error ? reason.message : "Current quote is unavailable."); });
    return () => { cancelled = true; controller.abort(); };
  }, [activeCommodity, refreshKey, viewReady]);

  const calculation = useMemo(() => {
    if (!history) return null;
    const dailySignals = calculateIndicators(history.daily, "1d", { ...COMMODITY_OPTIONS, commodity: history.commodity.id });
    const weeklySignals = calculateIndicators(history.weekly, "1w", { ...COMMODITY_OPTIONS, commodity: history.commodity.id });
    const signals = timeframe === "1d" ? dailySignals : weeklySignals;
    const counterpart = timeframe === "1d" ? weeklySignals : dailySignals;
    const candles = timeframe === "1d" ? history.daily : history.weekly;
    const selected = signals.find(item => item.id === indicator) ?? signals.find(item => item.id === "support_band") ?? signals[0];
    const research = buildResearch(candles, signals, selected.id, timeframe, { market: "commodity" });
    return { dailySignals, weeklySignals, signals, counterpart, research, familyAgreement: familyAgreement(signals), historyCandleCount: candles.length, ...chartView(selected, candles) };
  }, [history, indicator, timeframe]);

  const options = INDICATOR_SPECS.filter(item => item.supportedTimeframes.includes(timeframe));
  const matrixRows = calculation?.signals.filter(item => item.role === role) ?? [];
  const current = calculation?.candles.at(-1);
  const prior = calculation?.candles.at(-2);
  const change = current && prior ? current.close / prior.close - 1 : null;
  const familyRows = useMemo(() => getFamilyRows(calculation?.signals ?? []), [calculation]);
  const marketClock = commodityConfirmationClock(timeframe, clock);

  const chooseCommodity = (next: CommodityId) => {
    if (next === commodityId) return;
    setView(current => ({ ...current, asset: next }));
    setCacheMessage(null); setError(null); setQuoteError(null); setLoading(true); setSyncState("checking");
  };
  const refreshHistory = () => { setLoading(true); setError(null); setSyncState("checking"); setRefreshKey(value => value + 1); };
  const chooseTimeframe = (next: Timeframe) => {
    const currentSpec = INDICATOR_SPECS.find(item => item.id === indicator);
    const replacement = currentSpec?.supportedTimeframes.includes(next) ? currentSpec : INDICATOR_SPECS.find(item => item.role === role && item.supportedTimeframes.includes(next));
    setView(current => ({ ...current, timeframe: next, indicator: replacement?.id ?? "support_band" }));
  };
  const chooseRole = (next: IndicatorRole) => {
    const replacement = INDICATOR_SPECS.find(item => item.role === next && item.supportedTimeframes.includes(timeframe));
    if (replacement) setIndicator(replacement.id);
  };
  const isCurrent = history ? historyIsCurrent("commodity", history.daily.at(-1)?.time, history.weekly.at(-1)?.time, clock) : false;
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("crypto-regime-theme", next);
    setTheme(next);
  };

  const triggerLabels = calculation?.selected.role === "exit" ? ["SHORT EXIT ABOVE", "LONG EXIT BELOW"] : calculation?.selected.role === "confirmation" ? ["POSITIVE ABOVE", "NEGATIVE BELOW"] : ["BULLISH ABOVE", "BEARISH BELOW"];
  const triggerCard = (label: string, value: number | null, variant: string) => <div className={`trigger ${variant}`}><span>{label}</span><strong>{value == null ? "Conditional" : formatPrice(value)}</strong><small>{calculation?.selected.thresholdKind} · completed {timeframe === "1d" ? "session" : "week"}</small></div>;

  return <main className="app-shell stock-shell commodity-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark stock-mark">{activeCommodity.symbol}</div><div><p className="eyebrow">COMMODITY REGIME LAB · {activeCommodity.label.toUpperCase()}</p><h1>Gold and silver, on completed bars.</h1></div></div><div className="header-actions"><LabNavigation current="commodities" />{history && <div className={`freshness ${isCurrent ? "" : "stale"}`}><span />{isCurrent ? "Confirmed" : "Snapshot behind"} · {formatDate(history.daily.at(-1)?.time)}</div>}<AccountControls /><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><b>{theme === "dark" ? "Light" : "Dark"}</b></button></div></header>

    <>
      <div className="proxy-note"><strong>Futures, not spot</strong>{COMMODITY_CAVEAT} Validated history starts January 2019; older inconsistent and missing provider bars are excluded.</div>
      {error && <div className="data-banner danger"><strong>Commodity data unavailable</strong><span>{error}</span><button type="button" onClick={refreshHistory}>Retry</button></div>}
      <section className="command-row" aria-label="Commodity research controls"><div className="control-group asset-control"><label htmlFor="commodity">Commodity</label><select id="commodity" value={commodityId} onChange={event => chooseCommodity(event.target.value as CommodityId)}>{COMMODITIES.map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.label}</option>)}</select></div><div className="control-group stock-provider"><span className="control-label">Data provider</span><div className="provider-value">Yahoo Finance · {activeCommodity.exchange}</div></div><div className="control-group grow"><label htmlFor="commodity-indicator">Indicator</label><select id="commodity-indicator" value={indicator} onChange={event => { setIndicator(event.target.value); }}>{options.map(item => <option key={item.id} value={item.id}>{item.displayName}{item.id === "kk_supertrend" ? ` · ${calibrationStatus(undefined, timeframe, undefined, commodityId)}` : ""}</option>)}</select></div><div className="segmented" aria-label="Timeframe"><button type="button" aria-pressed={timeframe === "1d"} className={timeframe === "1d" ? "active" : ""} onClick={() => chooseTimeframe("1d")}>1D</button><button type="button" aria-pressed={timeframe === "1w"} className={timeframe === "1w" ? "active" : ""} onClick={() => chooseTimeframe("1w")}>1W</button></div></section>
      <section className="close-countdown market-status-strip commodity-status-strip" aria-live="polite" aria-label={`${marketClock.title}: ${marketClock.remaining} remaining`}><div className="confirmation-status"><p className="eyebrow">CONFIRMATION CLOCK · {activeCommodity.exchange}</p><strong>{marketClock.title}</strong><span>{marketClock.boundary}</span></div><div className="countdown-value"><b>{marketClock.remaining}</b><small>remaining</small></div><div className="snapshot-status"><span>DATA SNAPSHOT · YAHOO FINANCE</span><b>{history ? formatDate(history.retrievedAt, true) : "—"}</b><small title={cacheMessage ?? undefined}>{history ? `completed through ${formatDate(history.daily.at(-1)?.time)}` : "loading stored history…"}</small></div><div className="spot-price"><span>CURRENT {activeCommodity.symbol} FUTURES QUOTE · USD / OZ</span><b>{quote ? formatPrice(quote.price) : "—"}</b><small>{quote ? `${quoteError ? "quote update failed · " : ""}${quote.contractLabel} · as of ${formatDate(quote.quoteTime, true)} · ${quoteAge(quote.retrievedAt, clock)}` : quoteError ? "quote unavailable" : "fetching current price…"}</small></div></section>

      <SyncStatus status={syncState} isCurrent={isCurrent} hasHistory={Boolean(history)} onRefresh={refreshHistory} cacheMessage={cacheMessage} />
      {loading && !history ? <LoadingView /> : calculation && history && <>
        <section className={`hero-grid ${loading ? "is-refreshing" : ""}`}><article className="chart-card"><div className="chart-heading"><div><p className="eyebrow">LAST CONFIRMED {timeframe === "1d" ? "DAILY" : "WEEKLY"} FUTURES CLOSE · USD / TROY OUNCE · {history.commodity.exchange} · YAHOO FINANCE</p><div className="price-line"><strong>{formatPrice(current?.close)}</strong><span className={change != null && change < 0 ? "negative" : ""}>{formatPct(change, true)}</span></div></div><StateBadge state={calculation.selected.readiness?.ready === false ? null : calculation.selected.state} label={calculation.selected.readiness?.ready === false ? "Not ready" : roleStateLabel(calculation.selected.role, calculation.selected.id, calculation.selected.state)} /></div><div className="chart-frame"><ChartExplorer key={`${commodityId}:${timeframe}`} candles={calculation.candles} selected={calculation.selected} denomination="USD" timeframe={timeframe} theme={theme} />{loading && <div className="chart-refresh">Refreshing stored candles…</div>}</div><div className="chart-legend">{calculation.selected.overlays.filter(line => line.showInLegend !== false).map(line => <span key={line.name}><i style={{ background: chartColorCss(line.color) }} />{line.legendLabel ?? line.name}</span>)}{calculation.selected.ribbons.filter(ribbon => ribbon.showInLegend !== false).flatMap(ribbon => (Object.entries(ribbon.palette) as Array<[RegimeState, string]>).map(([state, color]) => <span key={`${ribbon.id}-${state}`}><i className="range-swatch" style={{ background: chartColorCss(color) }} />{titleState(state)} range</span>))}<span><i className="flip-dot" />Confirmed flip</span><span className="method-note">Signals effective next available bar open</span></div></article>
          <aside className="signal-panel"><p className="eyebrow">CURRENT EVIDENCE</p><h2>{calculation.selected.shortName}</h2><div className="current-state-row"><StateBadge state={calculation.selected.readiness?.ready === false ? null : calculation.selected.state} label={calculation.selected.readiness?.ready === false ? "Not ready" : roleStateLabel(calculation.selected.role, calculation.selected.id, calculation.selected.state)} /><span>{calculation.selected.readiness?.ready === false ? "Insufficient history" : "Completed candles only"}</span></div><SignalReadiness readiness={calculation.selected.readiness} lastFlip={calculation.selected.lastFlip} timeframe={timeframe} market="commodity" />{calculation.selected.readiness?.ready !== false && calculation.selected.role !== "valuation" && (calculation.selected.bullTrigger != null || calculation.selected.bearTrigger != null) && <>{triggerCard(triggerLabels[0], calculation.selected.bullTrigger, "bull-trigger")}{triggerCard(triggerLabels[1], calculation.selected.bearTrigger, "bear-trigger")}</>}<div className="method-card"><span>RULE</span><p>{calculation.selected.explanation}</p><b>{calculation.selected.triggerLabel}</b></div>{calculation.selected.id === "kk_supertrend" && <div className="proxy-note"><strong>{calibrationStatus(undefined, timeframe, undefined, commodityId)}</strong>ATR {calculation.selected.values.atrLength} with factor {calculation.selected.values.factor}. Weekly presets approximately match the supplied screenshots on our Yahoo candles. TradingView back-adjustment and contract rolls can cause differences. Daily remains uncalibrated 10/3.</div>}{calculation.selected.id === "mayer" && <div className="proxy-note"><strong>Price-ratio interpretation</strong>Shown as the price-to-200-day-average ratio, not as an intrinsic valuation measure.</div>}<p className="disclaimer">Research view only. No live orders or individualized allocation advice.</p></aside></section>

        {calculation.selected.id === "kk_supertrend" && <CalibrationPanel key={commodityId + timeframe} commodity={commodityId} timeframe={timeframe} values={calculation.selected.values} />}
        <section className="guidance-card" aria-label={`${calculation.selected.displayName} interpretation guide`}><div className="guidance-heading"><div><p className="eyebrow">HOW TO INTERPRET IT</p><h2>{calculation.selected.guidance.summary}</h2></div>{calculation.selected.sourceUrl && <a href={calculation.selected.sourceUrl} target="_blank" rel="noreferrer">Published method ↗</a>}</div><div className="guidance-grid">{[calculation.selected.guidance.positive, calculation.selected.guidance.neutral, calculation.selected.guidance.negative].map((item, index) => <article className={["positive", "neutral", "negative"][index]} key={item.label}><span>{item.label}</span><p>{item.rule}</p></article>)}</div><div className="guidance-notes"><p><strong>Why this rule exists</strong>{calculation.selected.guidance.rationale}</p><ul>{calculation.selected.guidance.caveats.map(caveat => <li key={caveat}>{caveat}</li>)}</ul></div></section>

        <section className="family-strip" aria-label="Regime family agreement"><div><p className="eyebrow">FAMILY AGREEMENT</p><h2>Correlated models get one family voice</h2></div><div className="family-summary"><b className="bull-text">{calculation.familyAgreement.bull} bull</b><b className="neutral-text">{calculation.familyAgreement.neutral} neutral</b><b className="bear-text">{calculation.familyAgreement.bear} bear</b>{calculation.familyAgreement.unavailable > 0 && <b>{calculation.familyAgreement.unavailable} unavailable</b>}</div><div className="family-chips">{familyRows.map(row => <span key={row.family} className={row.state ?? "unavailable"}><i />{row.family}<small>{row.members ? `${row.members} ready model${row.members === 1 ? "" : "s"}` : "No ready models"}</small></span>)}</div></section>

        <section className="matrix-card"><div className="section-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>Current commodity state matrix</h2></div><div className="category-tabs" role="tablist">{ROLE_OPTIONS.map(item => <button type="button" role="tab" aria-selected={role === item.id} className={role === item.id ? "active" : ""} key={item.id} onClick={() => chooseRole(item.id)}>{item.label}</button>)}</div></div><div className="matrix-table"><div className="matrix-header"><span>Model</span><span>Family</span><span>Daily</span><span>Weekly</span><span>Signal candle</span><span>Next condition</span></div>{matrixRows.map(item => { const other = calculation.counterpart.find(candidate => candidate.id === item.id); const ownState = item.readiness?.ready === false ? null : item.state, otherState = other?.readiness?.ready === false ? null : other?.state; const dailyState = timeframe === "1d" ? ownState : otherState; const weeklyState = timeframe === "1w" ? ownState : otherState; return <button type="button" className={`matrix-row ${indicator === item.id ? "selected" : ""}`} key={item.id} onClick={() => setIndicator(item.id)}><span><strong>{item.shortName}</strong><small>{item.thresholdKind}</small></span><span>{item.family}</span><StateBadge state={dailyState} label={roleStateLabel(item.role, item.id, dailyState)} compact /><StateBadge state={weeklyState} label={roleStateLabel(item.role, item.id, weeklyState)} compact /><span>{formatDate(item.lastFlip)}</span><b data-label="Next condition">{nextCondition(item)}</b></button>; })}{!matrixRows.length && <p className="empty-state">No {role} model supports this timeframe.</p>}</div><MobileMatrix rows={matrixRows.map(item => { const other = calculation.counterpart.find(candidate => candidate.id === item.id); const ownState = item.readiness?.ready === false ? null : item.state, otherState = other?.readiness?.ready === false ? null : other?.state; return { ...item, nextCondition: nextCondition(item), dailyState: timeframe === "1d" ? ownState : otherState, weeklyState: timeframe === "1w" ? ownState : otherState }; })} selectedId={indicator} onSelect={setIndicator} /><p className="matrix-footnote">Daily bars use a conservative next-day UTC completion cutoff, not an exchange settlement timestamp. Monday-based weeks retain available holiday bars and reject missing baseline publication dates.</p></section>

        <div className="proxy-note"><strong>Futures research limitation</strong>Unlevered continuous-price simulation, not tradable futures P&amp;L. Next-bar-open execution and 5/15/30-bps sensitivity exclude contract rolls, margin, leverage and financing. Buy-and-hold is a price-series benchmark. Daily annualization assumes 252 bars; weekly uses 52.</div>
        <ResearchPanel research={calculation.research} selectedName={calculation.selected.shortName} />
        <section className="research-grid">
          <article className="research-card wide"><p className="eyebrow">DATA PROVENANCE</p><h2>{history.provider.label} · {history.exchange}</h2><dl><div><dt>Calculation history</dt><dd>{calculation.historyCandleCount.toLocaleString()} futures bars</dd></div><div><dt>Chart history</dt><dd>{calculation.candles.length.toLocaleString()} bars · adjustable viewport</dd></div><div><dt>Series begins</dt><dd>{formatDate((timeframe === "1d" ? history.daily : history.weekly)[0]?.time)}</dd></div><div><dt>Adjustment basis</dt><dd>{history.adjustmentBasis}</dd></div><div><dt>Quality</dt><dd>{Object.values(history.quality).every(value => value === 0) ? "Passed" : "Review"}</dd></div><div><dt>Storage</dt><dd>Shared Cloudflare D1 snapshot · private browser cache</dd></div></dl><p>Data sourced by Yahoo Finance via <a href={history.providerUrl} target="_blank" rel="noreferrer">Yahoo Finance</a>. The service stores validated completed-session candles in D1 and keeps a browser copy for fast rendering. Yahoo Finance access is unofficial and intended here for personal research.</p></article></section>
        <footer><p>Commodity Regime Lab separates price regimes, confirmation, exits, and price-ratio context. Weekly KK uses approximate screenshot fits; daily keeps the 10/3 baseline. Futures are not spot metal.</p><nav><a href="/">Crypto Regime Lab</a><a href="https://finance.yahoo.com/" target="_blank" rel="noreferrer">Yahoo Finance</a></nav></footer>
      </>}
    </>
  </main>;
}
