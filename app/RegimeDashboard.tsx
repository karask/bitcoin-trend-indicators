"use client";

import { useEffect, useMemo, useState } from "react";
import { chartColorCss, type Theme } from "./RegimeChart";
import ChartExplorer from "./ChartExplorer";
import ResearchPanel from "./ResearchPanel";
import CalibrationPanel from "./CalibrationPanel";
import SignalReadiness from "./SignalReadiness";
import SyncStatus from "./SyncStatus";
import LabNavigation from "./LabNavigation";
import MobileMatrix from "./MobileMatrix";
import { useSavedView } from "./useSavedView";
import { formatPrice, quoteAge } from "../lib/display";
import { historyIsCurrent, loadCryptoHistory, requestJson, type SyncStatus as SyncState } from "../lib/history-client";
import { confirmationClock } from "../lib/confirmation-clock";
import { resolveInitialTheme } from "../lib/chart-interaction";
import { buildDashboardPayload, type DashboardPayload } from "../lib/dashboard-calculation";
import type { CryptoHistory } from "../lib/crypto-cache";
import { marketDefinition, resolveSourceForAsset, sourcesForAsset, type AssetId, type SourceId } from "../lib/markets";
import { INDICATOR_SPECS, familyRows as getFamilyRows, SUPER_GUPPY_R12_DEFAULTS, type SuperGuppyConfig, type SuperGuppySource, type IndicatorGuidance as Guidance } from "../lib/regimes";
import { AccountControls, authenticatedFetch } from "./AuthClient";

type State = "bull" | "bear" | "neutral";
type Role = "regime" | "confirmation" | "exit" | "valuation";
type Timeframe = "1d" | "1w";
type Payload = DashboardPayload;
type SpotQuote = { asset: AssetId; source: string; quoteSource?: string; sourceLabel: string; market: string; denomination: string; fallback?: boolean; price: number; retrievedAt: string };

const ROLES: Array<{ id: Role; label: string }> = [
  { id: "regime", label: "Regime" }, { id: "confirmation", label: "Confirmation" }, { id: "exit", label: "Exit" }, { id: "valuation", label: "Valuation" },
];
const ASSET_OPTIONS: Payload["assets"] = [
  { id: "btc", label: "Bitcoin", symbol: "BTC", defaultSource: "bitstamp" },
  { id: "eth", label: "Ethereum", symbol: "ETH", defaultSource: "bitstamp" },
  { id: "sol", label: "Solana", symbol: "SOL", defaultSource: "coinbase" },
  { id: "doge", label: "Dogecoin", symbol: "DOGE", defaultSource: "coinbase" },
  { id: "link", label: "Chainlink", symbol: "LINK", defaultSource: "coinbase" },
  { id: "xmr", label: "Monero", symbol: "XMR", defaultSource: "kraken" },
  { id: "sui", label: "Sui", symbol: "SUI", defaultSource: "coinbase" },
];
const freshGuppyDefaults = (): SuperGuppyConfig => ({ ...SUPER_GUPPY_R12_DEFAULTS, fastLengths: [...SUPER_GUPPY_R12_DEFAULTS.fastLengths], slowLengths: [...SUPER_GUPPY_R12_DEFAULTS.slowLengths] });
const GUPPY_SOURCES: Array<{ value: SuperGuppySource; label: string }> = [
  { value: "close", label: "Close" }, { value: "open", label: "Open" }, { value: "high", label: "High" }, { value: "low", label: "Low" }, { value: "hl2", label: "HL2" }, { value: "hlc3", label: "HLC3" }, { value: "ohlc4", label: "OHLC4" },
];
const formatDate = (value: number | null | undefined, short = false) => value == null ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", ...(short ? {} : { year: "numeric" }), timeZone: "UTC" }).format(value);
const formatSnapshot = (value: string | null | undefined, timeZone = "UTC") => !value || !Number.isFinite(Date.parse(value)) ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(value));
const confirmedCloseDate = (value: number | null | undefined, timeframe: Timeframe) => value == null ? value : value + (timeframe === "1w" ? 6 * 86_400_000 : 0);
const formatPct = (value: number | null | undefined, signed = false) => value == null || !Number.isFinite(value) ? "—" : `${signed && value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const titleState = (state: string) => state === "bull" ? "Bullish" : state === "bear" ? "Bearish" : state === "neutral" ? "Neutral" : "Unavailable";
const roleStateLabel = (role: Role, id: string, state: State | null | undefined) => {
  if (!state) return undefined;
  if (role === "confirmation") return state === "bull" ? "Positive" : state === "bear" ? "Negative" : "No confirmation";
  if (role === "exit") return state === "bull" ? "Stop intact" : state === "bear" ? "Exit condition" : "N/A";
  if (role === "valuation") return id === "mayer" ? "Context" : state === "bull" ? "Above baseline" : state === "bear" ? "Below baseline" : "Context";
  return undefined;
};

function StateBadge({ state, compact = false, label }: { state: State | null | undefined; compact?: boolean; label?: string }) {
  const value = state ?? "unavailable";
  return <span className={`state-badge ${value} ${compact ? "compact" : ""}`}><i />{label ?? (state ? titleState(state) : "Not ready")}</span>;
}
function LoadingView() { return <div className="loading-grid" aria-label="Loading market research"><div className="loading-block chart-load" /><div className="loading-block side-load" /><div className="loading-block table-load" /></div>; }

export default function RegimeDashboard() {
  const { view, setView, ready: viewReady } = useSavedView("crypto");
  const asset = view.asset as AssetId, source = view.source as SourceId, timeframe = view.timeframe, indicator = view.indicator;
  const role = INDICATOR_SPECS.find(item => item.id === indicator)?.role ?? "regime";
  const setSource = (next: SourceId) => setView(current => ({ ...current, source: next }));
  const setIndicator = (next: string) => setView(current => ({ ...current, indicator: next }));
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("checking");
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [marketHistory, setMarketHistory] = useState<CryptoHistory | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [spot, setSpot] = useState<SpotQuote | null>(null), [spotError, setSpotError] = useState<string | null>(null);
  const [guppyConfig, setGuppyConfig] = useState<SuperGuppyConfig>(freshGuppyDefaults);
  const [fastLengthsText, setFastLengthsText] = useState(SUPER_GUPPY_R12_DEFAULTS.fastLengths.join(",")), [slowLengthsText, setSlowLengthsText] = useState(SUPER_GUPPY_R12_DEFAULTS.slowLengths.join(","));
  // Keep the server render and first browser render identical. The real clock is
  // installed immediately after hydration, then advances once per minute.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const root = document.documentElement, media = window.matchMedia("(prefers-color-scheme: dark)");
    const saved = window.localStorage.getItem("crypto-regime-theme");
    const initial = resolveInitialTheme(saved, media.matches); root.dataset.theme = initial;
    const frame = window.requestAnimationFrame(() => setTheme(initial));
    const followSystem = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem("crypto-regime-theme")) return;
      const next: Theme = event.matches ? "dark" : "light"; root.dataset.theme = next; setTheme(next);
    };
    media.addEventListener("change", followSystem); return () => { window.cancelAnimationFrame(frame); media.removeEventListener("change", followSystem); };
  }, []);
  useEffect(() => { const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event); }; window.addEventListener("beforeinstallprompt", capture); return () => window.removeEventListener("beforeinstallprompt", capture); }, []);
  useEffect(() => { const frame = window.requestAnimationFrame(() => setClock(Date.now())); const timer = window.setInterval(() => setClock(Date.now()), 60_000); return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); }; }, []);
  useEffect(() => {
    if (!viewReady) return;
    const controller = new AbortController();
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null); setSyncState("checking"); setCacheMessage(null);
      const result = await loadCryptoHistory(asset, source, authenticatedFetch, controller.signal, cached => {
        if (!cancelled) { setMarketHistory(cached); setCacheMessage("Loaded from this browser's candle cache; checking for newer data."); }
      });
      if (cancelled) return;
      setMarketHistory(result.history); setSyncState(result.status); setLoading(false);
      setCacheMessage(result.cacheSaved ? "New candles and recent corrections checked; older history stays local." : "History loaded, but the browser cache could not be saved.");
    };
    void load().catch(reason => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : "Market history is unavailable");
      setSyncState("failed"); setLoading(false);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [asset, source, refreshKey, viewReady]);
  useEffect(() => {
    if (!viewReady) return;
    const controller = new AbortController();
    let cancelled = false;
    requestJson<SpotQuote>(authenticatedFetch, `/api/v1/spot?asset=${asset}&source=${source}`, { signal: controller.signal }, 12_000)
      .then(payload => { if (!cancelled) { setSpot(payload); setSpotError(null); } })
      .catch(reason => { if (!cancelled) setSpotError(reason.message); });
    return () => { cancelled = true; controller.abort(); };
  }, [asset, source, refreshKey, viewReady]);

  const data = useMemo(() => marketHistory?.daily.asset === asset && marketHistory.daily.source === source
    ? { ...buildDashboardPayload(asset, source, timeframe, indicator, marketHistory.daily, marketHistory.weekly, { superGuppy: guppyConfig }), sources: marketHistory.sources ?? sourcesForAsset(asset) }
    : null, [asset, source, timeframe, indicator, marketHistory, guppyConfig]);

  const options = useMemo(() => INDICATOR_SPECS.filter(item => item.supportedTimeframes.includes(timeframe)), [timeframe]);
  const items = role === "regime" ? data?.matrix ?? [] : (data?.supporting ?? []).filter(item => item.role === role).map(item => ({ ...item, dailyState: timeframe === "1d" ? item.state : null, weeklyState: timeframe === "1w" ? item.state : null }));
  const current = data?.candles.at(-1), prior = data?.candles.at(-2), change = current && prior ? current.close / prior.close - 1 : null;
  const familyRows = useMemo(() => data ? getFamilyRows(data.matrix) : [], [data]);
  const closeClock = confirmationClock(timeframe, clock);
  const activeSpot = spot?.asset === asset && spot.source === source ? spot : null;
  const denomination = data?.dataset.asset === asset ? data.dataset.denomination : activeSpot?.denomination ?? "USD";
  const activeAsset = (data?.assets ?? ASSET_OPTIONS).find(item => item.id === asset) ?? ASSET_OPTIONS[0];
  const activeMarket = marketDefinition(asset, source);
  const confirmedThrough = confirmedCloseDate(data?.dataset.lastCandle, timeframe);
  const beginRefresh = () => { setLoading(true); setError(null); setSyncState("checking"); };
  const refreshHistory = () => { beginRefresh(); setRefreshKey(value => value + 1); };
  const chooseRole = (next: Role) => { const nextIndicator = INDICATOR_SPECS.find(item => item.role === next && item.supportedTimeframes.includes(timeframe)); if (nextIndicator) setIndicator(nextIndicator.id); };
  const chooseTimeframe = (next: Timeframe) => {
    const spec = INDICATOR_SPECS.find(item => item.id === indicator);
    const replacement = spec?.supportedTimeframes.includes(next) ? spec : INDICATOR_SPECS.find(item => item.role === role && item.supportedTimeframes.includes(next));
    setView(current => ({ ...current, timeframe: next, indicator: replacement?.id ?? "support_band" }));
  };
  const chooseAsset = (next: AssetId) => { if (next === asset) return; beginRefresh(); setView(current => ({ ...current, asset: next, source: resolveSourceForAsset(next, source) })); setSpot(null); };
  const isCurrent = data ? historyIsCurrent("crypto", marketHistory?.daily.candles.at(-1)?.time, marketHistory?.weekly.candles.at(-1)?.time, clock) : false;
  const updateGuppy = <K extends keyof SuperGuppyConfig>(key: K, value: SuperGuppyConfig[K]) => setGuppyConfig(currentConfig => ({ ...currentConfig, [key]: value }));
  const applyGuppyLengths = (group: "fast" | "slow") => {
    const text = group === "fast" ? fastLengthsText : slowLengthsText, expected = group === "fast" ? 11 : 16;
    const parsed = text.split(",").map(value => Number(value.trim()));
    if (parsed.length === expected && parsed.every(value => Number.isInteger(value) && value > 0 && value <= 1000)) updateGuppy(group === "fast" ? "fastLengths" : "slowLengths", parsed);
    else if (group === "fast") setFastLengthsText(guppyConfig.fastLengths.join(","));
    else setSlowLengthsText(guppyConfig.slowLengths.join(","));
  };
  const resetGuppy = () => { const defaults = freshGuppyDefaults(); setGuppyConfig(defaults); setFastLengthsText(defaults.fastLengths.join(",")); setSlowLengthsText(defaults.slowLengths.join(",")); };
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; window.localStorage.setItem("crypto-regime-theme", next); setTheme(next);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-runtime-theme]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; meta.dataset.runtimeTheme = "true"; document.head.append(meta); }
    meta.content = next === "dark" ? "#101714" : "#f2f1eb";
  };
  const triggerCard = (label: string, value: number | null, variant: string) => <div className={`trigger ${variant}`}><span>{label}</span><strong>{value == null ? "Conditional" : formatPrice(value, denomination)}</strong><small>{data?.selected.thresholdKind} · as of {formatDate(confirmedThrough, true)} UTC</small></div>;
  const triggerLabels = data?.selected.role === "exit" ? ["SHORT EXIT ABOVE", "LONG EXIT BELOW"] : data?.selected.role === "confirmation" ? ["POSITIVE ABOVE", "NEGATIVE BELOW"] : ["BULLISH ABOVE", "BEARISH BELOW"];

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark">{activeAsset.symbol}</div><div><p className="eyebrow">CRYPTO REGIME LAB · {activeAsset.label.toUpperCase()}</p><h1>Trend regimes, without the black box.</h1></div></div><div className="header-actions"><LabNavigation current="crypto" />{installPrompt && <button className="install-button" onClick={() => { (installPrompt as Event & { prompt: () => void }).prompt(); setInstallPrompt(null); }}>Install app</button>}<div className={`freshness ${data && !isCurrent ? "stale" : ""}`}><span />{data ? `${!isCurrent ? "Snapshot behind" : "Confirmed through"} · ${formatDate(confirmedThrough)}` : "Loading exchange data"}</div><AccountControls /><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><b>{theme === "dark" ? "Light" : "Dark"}</b></button></div></header>
    {data?.dataset.warning && <div className={`data-banner ${data.dataset.demo ? "danger" : "warning"}`}><strong>{data.dataset.demo ? "Demonstration data — no confirmed signal" : "Source quality warning"}</strong><span>{data.dataset.warning}</span></div>}
    {error && <div className="data-banner danger"><strong>Research API unavailable</strong><span>{error}</span><button onClick={refreshHistory}>Retry</button></div>}
    <section className="command-row" aria-label="Research controls"><div className="control-group asset-control"><label htmlFor="asset">Asset</label><select id="asset" value={asset} onChange={event => chooseAsset(event.target.value as AssetId)}>{(data?.assets ?? ASSET_OPTIONS).map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.label}</option>)}</select></div><div className="control-group"><label htmlFor="market">Market source</label><select id="market" value={source} onChange={event => { if (event.target.value !== source) { beginRefresh(); setSource(event.target.value as SourceId); } }}>{(data?.dataset.asset === asset ? data.sources : []).length ? data!.sources.map(item => <option key={item.id} value={item.id}>{item.label} · {item.market}</option>) : <option value={source}>{activeMarket.label} · {activeMarket.market}</option>}</select></div><div className="control-group grow"><label htmlFor="indicator">Indicator</label><select id="indicator" value={indicator} onChange={event => { setIndicator(event.target.value); }}>{options.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div><div className="segmented" aria-label="Timeframe"><button type="button" aria-pressed={timeframe === "1d"} className={timeframe === "1d" ? "active" : ""} onClick={() => chooseTimeframe("1d")}>1D</button><button type="button" aria-pressed={timeframe === "1w"} className={timeframe === "1w" ? "active" : ""} onClick={() => chooseTimeframe("1w")}>1W</button></div></section>
    {indicator === "super_guppy" && <details className="indicator-settings" open><summary><span><b>Super Guppy R1.2 settings</b><small>Published defaults are loaded; every R1.2 input relevant to daily/weekly candles is available.</small></span><button type="button" onClick={event => { event.preventDefault(); resetGuppy(); }}>Reset defaults</button></summary><div className="settings-grid"><label><span>Source</span><select value={guppyConfig.source} onChange={event => updateGuppy("source", event.target.value as SuperGuppySource)}>{GUPPY_SOURCES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label><span>Repeat lookback</span><input type="number" min="0" max="100" value={guppyConfig.lookback} onChange={event => updateGuppy("lookback", Number(event.target.value))} /></label><label><span>Anchor (minutes)</span><select value={guppyConfig.anchorMinutes} onChange={event => updateGuppy("anchorMinutes", Number(event.target.value))}><option value="0">Current timeframe</option><option value="1440">1440 · Daily anchor</option></select><small>R1.2 anchor affects intraday charts only; both choices are equivalent here.</small></label><label className="length-input"><span>11 Trader EMA lengths</span><input value={fastLengthsText} onChange={event => setFastLengthsText(event.target.value)} onBlur={() => applyGuppyLengths("fast")} aria-label="Eleven comma-separated Trader EMA lengths" /></label><label className="length-input"><span>16 Investor EMA lengths</span><input value={slowLengthsText} onChange={event => setSlowLengthsText(event.target.value)} onBlur={() => applyGuppyLengths("slow")} aria-label="Sixteen comma-separated Investor EMA lengths" /></label></div><div className="setting-toggles"><label><input type="checkbox" checked={guppyConfig.showSwing} onChange={event => updateGuppy("showSwing", event.target.checked)} /><span>Swing arrows</span></label><label><input type="checkbox" checked={guppyConfig.showBreak} onChange={event => updateGuppy("showBreak", event.target.checked)} /><span>Trend Break arrows</span></label><label><input type="checkbox" checked={guppyConfig.requireConfluence} onChange={event => updateGuppy("requireConfluence", event.target.checked)} /><span>Require group confluence</span></label><label><input type="checkbox" checked={guppyConfig.candleChangeRetriggers} onChange={event => updateGuppy("candleChangeRetriggers", event.target.checked)} /><span>Candle-change Swing retriggers</span></label><label><input type="checkbox" checked={guppyConfig.showAverages} onChange={event => updateGuppy("showAverages", event.target.checked)} /><span>Show group averages</span></label><label><input type="checkbox" checked={guppyConfig.showEma200} onChange={event => updateGuppy("showEma200", event.target.checked)} /><span>Show EMA 200</span></label><label><input type="checkbox" checked={guppyConfig.ema200Filter} onChange={event => updateGuppy("ema200Filter", event.target.checked)} /><span>Use EMA 200 filter</span></label><label><input type="checkbox" checked={guppyConfig.colorBars} onChange={event => updateGuppy("colorBars", event.target.checked)} /><span>Color candles by Trader group</span></label></div></details>}
    <section className="close-countdown market-status-strip" aria-live="polite" aria-label={`${closeClock.title}: ${closeClock.remaining} remaining`}><div className="confirmation-status"><p className="eyebrow">CONFIRMATION CLOCK · UTC</p><strong>{closeClock.title}</strong><span>{closeClock.boundary}</span></div><div className="countdown-value"><b>{closeClock.remaining}</b><small>remaining</small></div><div className="snapshot-status"><span>DATA SNAPSHOT · {(data?.dataset.sourceLabel ?? source).toUpperCase()}</span><b>{formatSnapshot(data?.dataset.retrievedAt)}</b><small>{data?.dataset.lastCandle ? `confirmed through ${formatDate(confirmedThrough)}` : "loading completed candles…"}</small></div><div className="spot-price"><span>CURRENT {activeAsset.symbol} QUOTE · {(activeSpot?.sourceLabel ?? data?.dataset.sourceLabel ?? source).toUpperCase()}</span><b>{activeSpot ? formatPrice(activeSpot.price, activeSpot.denomination) : "—"}</b><small>{activeSpot ? `${spotError ? "quote update failed · " : ""}${activeSpot.fallback ? "fallback quote · " : ""}${quoteAge(activeSpot.retrievedAt, clock)} · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(activeSpot.retrievedAt))} UTC` : spotError ? "quote unavailable" : "fetching current price…"}</small></div></section>
    <SyncStatus status={syncState} isCurrent={isCurrent} hasHistory={Boolean(data)} onRefresh={refreshHistory} cacheMessage={cacheMessage} />
    {loading && !data ? <LoadingView /> : data && <>
      <section className={`hero-grid ${loading ? "is-refreshing" : ""}`}><article className="chart-card"><div className="chart-heading"><div><p className="eyebrow">LAST CONFIRMED {timeframe === "1d" ? "DAILY" : "WEEKLY"} CLOSE · {data.dataset.market} · {data.dataset.sourceLabel.toUpperCase()}</p><div className="price-line"><strong>{formatPrice(current?.close, data.dataset.denomination)}</strong><span className={change != null && change < 0 ? "negative" : ""}>{formatPct(change, true)}</span></div></div><StateBadge state={data.selected.state} label={roleStateLabel(data.selected.role, data.selected.id, data.selected.state)} /></div><div className="chart-frame"><ChartExplorer key={`${asset}:${source}:${timeframe}`} candles={data.candles} selected={data.selected} denomination={data.dataset.denomination} timeframe={timeframe} theme={theme} />{loading && <div className="chart-refresh">Refreshing completed candles…</div>}</div><div className="chart-legend">{data.selected.overlays.filter(line => line.showInLegend !== false).map(line => <span key={line.name}><i style={{ background: chartColorCss(line.color) }} />{line.legendLabel ?? line.name}</span>)}{data.selected.ribbons.filter(ribbon => ribbon.showInLegend !== false).flatMap(ribbon => (Object.entries(ribbon.palette) as Array<[State, string]>).map(([state, color]) => <span key={`${ribbon.id}-${state}`}><i className="range-swatch" style={{ background: chartColorCss(color) }} />{titleState(state)} range</span>))}{data.selected.id === "super_guppy" ? <><span><i style={{ background: "linear-gradient(90deg,var(--chart-guppy-lime) 0 50%,var(--chart-guppy-red) 50%)" }} />Swing arrows</span><span><i style={{ background: "linear-gradient(90deg,var(--chart-guppy-aqua) 0 50%,var(--chart-guppy-blue) 50%)" }} />Trend Break arrows</span></> : <span><i className="flip-dot" />Confirmed flip</span>}<span className="method-note">States effective next open</span></div></article>
        <aside className="signal-panel"><p className="eyebrow">CURRENT EVIDENCE</p><h2>{data.selected.shortName}</h2><div className="current-state-row"><StateBadge state={data.selected.state} label={roleStateLabel(data.selected.role, data.selected.id, data.selected.state)} /><span>{data.selected.readiness?.ready === false ? "Insufficient history" : "Completed candles only"}</span></div><SignalReadiness readiness={data.selected.readiness} lastFlip={data.selected.lastFlip} timeframe={timeframe} market="crypto" />{data.selected.readiness?.ready !== false && data.selected.role !== "valuation" && (data.selected.bullTrigger != null || data.selected.bearTrigger != null) && <>{triggerCard(triggerLabels[0], data.selected.bullTrigger, "bull-trigger")}{triggerCard(triggerLabels[1], data.selected.bearTrigger, "bear-trigger")}</>}<div className="method-card"><span>RULE</span><p>{data.selected.explanation}</p><b>{data.selected.triggerLabel}</b></div>{data.selected.disclaimer && <div className="proxy-note"><strong>Implementation note</strong>{data.selected.disclaimer}</div>}<p className="disclaimer">Research view only. No live orders or individualized allocation advice.</p></aside></section>
      {data.selected.id === "kk_supertrend" && <CalibrationPanel key={asset + timeframe} asset={asset} timeframe={timeframe} values={data.selected.values} />}
      <section className="guidance-card" aria-label={`${data.selected.displayName} interpretation guide`}><div className="guidance-heading"><div><p className="eyebrow">HOW TO INTERPRET IT</p><h2>{data.selected.guidance.summary}</h2></div>{data.selected.sourceUrl && <a href={data.selected.sourceUrl} target="_blank" rel="noreferrer">Published method ↗</a>}</div><div className="guidance-grid">{([data.selected.guidance.positive, data.selected.guidance.neutral, data.selected.guidance.negative] as Guidance["positive"][]).map((item, index) => <article className={["positive", "neutral", "negative"][index]} key={item.label}><span>{item.label}</span><p>{item.rule}</p></article>)}</div><div className="guidance-notes"><p><strong>Why this rule exists</strong>{data.selected.guidance.rationale}</p><ul>{data.selected.guidance.caveats.map(caveat => <li key={caveat}>{caveat}</li>)}</ul></div></section>
      <section className="family-strip" aria-label="Regime family agreement"><div><p className="eyebrow">FAMILY AGREEMENT</p><h2>Correlated models get one family voice</h2></div><div className="family-summary"><b className="bull-text">{data.familyAgreement.bull} bull</b><b className="neutral-text">{data.familyAgreement.neutral} neutral</b><b className="bear-text">{data.familyAgreement.bear} bear</b>{data.familyAgreement.unavailable > 0 && <b>{data.familyAgreement.unavailable} unavailable</b>}</div><div className="family-chips">{familyRows.map(row => <span key={row.family} className={row.state ?? "unavailable"}><i />{row.family}<small>{row.members ? `${row.members} ready model${row.members === 1 ? "" : "s"}` : "No ready models"}</small></span>)}</div></section>
      <section className="matrix-card"><div className="section-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>Current state matrix</h2></div><div className="category-tabs" role="tablist">{ROLES.map(item => <button role="tab" aria-selected={role === item.id} className={role === item.id ? "active" : ""} key={item.id} onClick={() => chooseRole(item.id)}>{item.label}</button>)}</div></div><div className="matrix-table"><div className="matrix-header"><span>Model</span><span>Family</span><span>Daily</span><span>Weekly</span><span>Signal candle</span><span>Next condition</span></div>{items.map(item => { const dailyState = item.dailyState, weeklyState = item.weeklyState; return <button className={`matrix-row ${indicator === item.id ? "selected" : ""}`} key={item.id} onClick={() => setIndicator(item.id)}><span><strong>{item.shortName}</strong><small>{item.thresholdKind}</small></span><span data-label="Family">{item.family}</span><StateBadge state={dailyState} label={roleStateLabel(item.role, item.id, dailyState)} compact /><StateBadge state={weeklyState} label={roleStateLabel(item.role, item.id, weeklyState)} compact /><span>{formatDate(item.lastFlip)}</span><b data-label="Next condition">{item.nextCondition}</b></button>; })}{!items.length && <p className="empty-state">No {role} model supports this timeframe.</p>}</div><MobileMatrix rows={items} selectedId={indicator} onSelect={setIndicator} /><p className="matrix-footnote">Fixed thresholds are known from prior completed candles. Provisional levels can move with unfinished OHLC. Conditional models cannot be reduced to one guaranteed price.</p></section>
      <ResearchPanel research={data.comparison} selectedName={data.selected.shortName} denomination={denomination} />
      <section className="research-grid">
        <article className="research-card wide"><p className="eyebrow">DATA PROVENANCE</p><h2>{data.dataset.sourceLabel} · {data.dataset.market}</h2><dl><div><dt>Calculation history</dt><dd>{data.dataset.candleCount.toLocaleString()} bars</dd></div><div><dt>Chart history</dt><dd>{data.dataset.chartCandleCount.toLocaleString()} bars · adjustable viewport</dd></div><div><dt>Series begins</dt><dd>{formatDate(data.dataset.firstCandle)}</dd></div><div><dt>Storage</dt><dd>{data.dataset.storage === "sqlite" ? "Local SQLite cache" : data.dataset.storage === "d1" ? "Cloudflare D1" : data.dataset.storage === "provider" ? "Fresh provider import" : "Demo only"}</dd></div><div><dt>SHA-256</dt><dd className="checksum">{data.dataset.checksum.slice(0, 12)}…</dd></div><div><dt>Quality</dt><dd>{Object.values(data.dataset.quality).every(value => value === 0) ? "Passed" : "Review"}</dd></div></dl><p>Venues are never spliced and missing prices are never forward-filled.</p></article></section>
      <footer><p>Crypto Regime Lab separates price regimes, confirmation, exits, and valuation. It does not optimize presets against {data.dataset.assetLabel} history.</p><nav><a href="/api/v1/registry">Registry JSON</a><a href={`/api/v1/series?asset=${asset}&source=${source}&timeframe=${timeframe}`}>Series JSON</a><a href={`/api/v1/health?asset=${asset}`}>Source health</a></nav></footer>
    </>}
  </main>;
}
