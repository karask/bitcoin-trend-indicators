"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Static Pages output publishes independent HTML shells without route RSC payloads. */

import { useEffect, useMemo, useState } from "react";
import RegimeChart, { chartColorCss, type Theme } from "./RegimeChart";
import { confirmationClock } from "../lib/confirmation-clock";
import { resolveInitialTheme } from "../lib/chart-interaction";
import { buildDashboardPayload } from "../lib/dashboard-calculation";
import type { MarketDataset } from "../lib/market-data";
import { marketDefinition, resolveSourceForAsset, type AssetId, type SourceId } from "../lib/markets";
import { SUPER_GUPPY_R12_DEFAULTS, type SuperGuppyConfig, type SuperGuppySource } from "../lib/regimes";
import { AccountControls, authenticatedFetch } from "./AuthClient";

type State = "bull" | "bear" | "neutral";
type Role = "regime" | "confirmation" | "exit" | "valuation";
type Timeframe = "1d" | "1w";
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type SpotQuote = { asset: AssetId; source: string; quoteSource?: string; sourceLabel: string; market: string; denomination: string; fallback?: boolean; price: number; retrievedAt: string };
type Guidance = {
  summary: string;
  positive: { label: string; rule: string };
  neutral: { label: string; rule: string };
  negative: { label: string; rule: string };
  rationale: string;
  caveats: string[];
};
type MatrixItem = {
  id: string; displayName: string; shortName: string; role: Role; family: string; state: State; lastFlip: number | null;
  dailyState?: State | null; weeklyState?: State | null; dailyLastFlip?: number | null; weeklyLastFlip?: number | null;
  thresholdKind: "fixed" | "provisional" | "conditional"; nextCondition: string; bullTrigger: number | null; bearTrigger: number | null;
  triggerLabel: string; explanation: string; guidance: Guidance; values: Record<string, number | null>; disclaimer?: string; sourceUrl?: string;
};
type Payload = {
  generatedAt: string;
  registry: Array<{ id: string; displayName: string; role: Role; family: string; supportedTimeframes: Timeframe[]; description: string; guidance: Guidance; disclaimer?: string }>;
  assets: Array<{ id: AssetId; label: string; symbol: string; defaultSource: string }>;
  sources: Array<{ id: string; label: string; market: string }>;
  dataset: { asset: AssetId; assetLabel: string; source: string; sourceLabel: string; market: string; denomination: string; timeframe: Timeframe; retrievedAt: string; checksum: string; stale: boolean; demo: boolean; storage: "provider" | "sqlite" | "d1" | "demo"; warning: string | null; quality: { gaps: number; duplicates: number; malformed: number }; firstCandle: number | null; lastCandle: number | null; candleCount: number; chartCandleCount: number };
  candles: Candle[];
  selected: MatrixItem & {
    states: Array<State | null>;
    overlays: Array<{ name: string; legendLabel?: string; color: string; dashed?: boolean; width?: number; pointStyle?: "line" | "circles"; showInLegend?: boolean; points: Array<{ time: number; value: number; color?: string }> }>;
    ribbons: Array<{ id: string; name: string; palette: Record<State, string>; fillOpacity: number; showInLegend?: boolean; points: Array<{ time: number; upper: number; lower: number; state: State }> }>;
    events: Array<{ time: number; kind: "swing" | "trend_break"; direction: "bull" | "bear"; label: string; price: number; color: string; confirmedAt: number; effectiveAt: number | null }>;
    barColors: Array<{ time: number; color: string }>;
    flips: Array<{ time: number; from: State; to: State; close: number }>;
  };
  matrix: MatrixItem[];
  supporting: MatrixItem[];
  familyAgreement: { bull: number; bear: number; neutral: number };
  backtests: Array<{ indicatorId: string; displayName: string; totalReturn: number; cagr: number; maxDrawdown: number; calmar: number | null; volatility: number; exposure: number; turnover: number; flips: number }>;
  research: { assumptions: { execution: string; exposure: string; costBps: number; sensitivityBps: number[] }; ranking: string };
};
type BrowserCalculationResponse = { calculation: "browser"; daily: MarketDataset; weekly: MarketDataset; sources?: Payload["sources"] };

const ROLES: Array<{ id: Role; label: string }> = [
  { id: "regime", label: "Regime" }, { id: "confirmation", label: "Confirmation" }, { id: "exit", label: "Exit" }, { id: "valuation", label: "Valuation" },
];
const ASSET_OPTIONS: Payload["assets"] = [
  { id: "btc", label: "Bitcoin", symbol: "BTC", defaultSource: "bitstamp" },
  { id: "eth", label: "Ethereum", symbol: "ETH", defaultSource: "bitstamp" },
  { id: "sol", label: "Solana", symbol: "SOL", defaultSource: "coinbase" },
  { id: "doge", label: "Dogecoin", symbol: "DOGE", defaultSource: "coinbase" },
  { id: "link", label: "Chainlink", symbol: "LINK", defaultSource: "coinbase" },
];
const freshGuppyDefaults = (): SuperGuppyConfig => ({ ...SUPER_GUPPY_R12_DEFAULTS, fastLengths: [...SUPER_GUPPY_R12_DEFAULTS.fastLengths], slowLengths: [...SUPER_GUPPY_R12_DEFAULTS.slowLengths] });
const GUPPY_SOURCES: Array<{ value: SuperGuppySource; label: string }> = [
  { value: "close", label: "Close" }, { value: "open", label: "Open" }, { value: "high", label: "High" }, { value: "low", label: "Low" }, { value: "hl2", label: "HL2" }, { value: "hlc3", label: "HLC3" }, { value: "ohlc4", label: "OHLC4" },
];
const formatPrice = (value: number | null | undefined, denomination = "USD") => {
  if (value == null || !Number.isFinite(value)) return "—";
  const maximumFractionDigits = value >= 1_000 ? 0 : value >= 10 ? 2 : 4;
  return denomination === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits }).format(value)
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value)} USDT`;
};
const formatDate = (value: number | null | undefined, short = false) => value == null ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", ...(short ? {} : { year: "numeric" }), timeZone: "UTC" }).format(value);
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
  const value = state ?? "neutral";
  return <span className={`state-badge ${value} ${compact ? "compact" : ""}`}><i />{label ?? (state ? titleState(state) : "N/A")}</span>;
}
function LoadingView() { return <div className="loading-grid" aria-label="Loading market research"><div className="loading-block chart-load" /><div className="loading-block side-load" /><div className="loading-block table-load" /></div>; }

export default function RegimeDashboard() {
  const [asset, setAsset] = useState<AssetId>("btc"), [source, setSource] = useState<SourceId>("bitstamp"), [timeframe, setTimeframe] = useState<Timeframe>("1w"), [indicator, setIndicator] = useState("support_band"), [role, setRole] = useState<Role>("regime");
  const [theme, setTheme] = useState<Theme>("light");
  const [data, setData] = useState<Payload | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [spot, setSpot] = useState<SpotQuote | null>(null), [spotError, setSpotError] = useState<string | null>(null);
  const [guppyConfig, setGuppyConfig] = useState<SuperGuppyConfig>(freshGuppyDefaults);
  const [fastLengthsText, setFastLengthsText] = useState(SUPER_GUPPY_R12_DEFAULTS.fastLengths.join(",")), [slowLengthsText, setSlowLengthsText] = useState(SUPER_GUPPY_R12_DEFAULTS.slowLengths.join(","));
  // Keep the server render and first browser render identical. The real clock is
  // installed immediately after hydration, then advances once per minute.
  const [clock, setClock] = useState(0), [refreshTick, setRefreshTick] = useState(0);
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
  useEffect(() => { const timer = window.setInterval(() => setRefreshTick(value => value + 1), 5 * 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const guppyQuery = indicator === "super_guppy" ? `&guppy=${encodeURIComponent(JSON.stringify(guppyConfig))}` : "";
    authenticatedFetch(`/api/v1/dashboard?asset=${asset}&source=${source}&timeframe=${timeframe}&indicator=${indicator}${guppyQuery}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json() as (Payload | BrowserCalculationResponse) & { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Research API returned ${response.status}`);
      const payload = "calculation" in result && result.calculation === "browser"
        ? { ...buildDashboardPayload(asset, source, timeframe, indicator, result.daily, result.weekly, { superGuppy: guppyConfig }), ...(result.sources ? { sources: result.sources } : {}) } as Payload
        : result as Payload;
      if (!Array.isArray(payload.candles) || !payload.dataset) throw new Error("Research API returned an incomplete dashboard payload");
      return payload;
    }).then((payload: Payload) => { setData(payload); setError(null); setLoading(false); }).catch(reason => { if (reason.name !== "AbortError") { setError(reason.message); setLoading(false); } });
    return () => controller.abort();
  }, [asset, source, timeframe, indicator, refreshTick, guppyConfig]);
  useEffect(() => {
    const controller = new AbortController();
    authenticatedFetch(`/api/v1/spot?asset=${asset}&source=${source}&request=${Date.now()}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const payload = await response.json() as SpotQuote & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Spot API returned ${response.status}`);
      return payload;
    }).then(payload => { setSpot(payload); setSpotError(null); }).catch(reason => { if (reason.name !== "AbortError") { setSpot(null); setSpotError(reason.message); } });
    return () => controller.abort();
  }, [asset, source, refreshTick]);

  const options = useMemo(() => data?.registry.filter(item => item.supportedTimeframes.includes(timeframe)) ?? [], [data, timeframe]);
  const items = role === "regime" ? data?.matrix ?? [] : (data?.supporting ?? []).filter(item => item.role === role);
  const current = data?.candles.at(-1), prior = data?.candles.at(-2), change = current && prior ? current.close / prior.close - 1 : null;
  const familyRows = useMemo(() => { if (!data) return []; const families = ["smoothing/order", "ATR/trailing stop", "breakout", "momentum", "cloud/projected support"]; return families.map(family => { const members = data.matrix.filter(item => item.family === family); const state: State = members.length && members.every(item => item.state === "bull") ? "bull" : members.length && members.every(item => item.state === "bear") ? "bear" : "neutral"; return { family, state, members: members.length }; }); }, [data]);
  const closeClock = confirmationClock(timeframe, clock);
  const activeSpot = spot?.asset === asset && spot.source === source ? spot : null;
  const denomination = data?.dataset.asset === asset ? data.dataset.denomination : activeSpot?.denomination ?? "USD";
  const activeAsset = (data?.assets ?? ASSET_OPTIONS).find(item => item.id === asset) ?? ASSET_OPTIONS[0];
  const activeMarket = marketDefinition(asset, source);
  const confirmedThrough = confirmedCloseDate(data?.dataset.lastCandle, timeframe);
  const visibleBacktests = data ? (() => {
    const topRanked = data.backtests.slice(0, 8);
    const selected = data.backtests.find(row => row.indicatorId === data.selected.id);
    return selected && !topRanked.some(row => row.indicatorId === selected.indicatorId) ? [...topRanked, selected] : topRanked;
  })() : [];
  const beginRefresh = () => { setLoading(true); setError(null); };
  const chooseRole = (next: Role) => { beginRefresh(); setRole(next); const nextIndicator = data?.registry.find(item => item.role === next && item.supportedTimeframes.includes(timeframe)); if (nextIndicator) setIndicator(nextIndicator.id); };
  const chooseTimeframe = (next: Timeframe) => { beginRefresh(); const currentSpec = data?.registry.find(item => item.id === indicator); const nextIndicator = currentSpec?.supportedTimeframes.includes(next) ? currentSpec : data?.registry.find(item => item.role === role && item.supportedTimeframes.includes(next)); setTimeframe(next); if (nextIndicator) setIndicator(nextIndicator.id); };
  const chooseAsset = (next: AssetId) => { beginRefresh(); setAsset(next); setSource(resolveSourceForAsset(next, source)); setSpot(null); };
  const updateGuppy = <K extends keyof SuperGuppyConfig>(key: K, value: SuperGuppyConfig[K]) => { beginRefresh(); setGuppyConfig(currentConfig => ({ ...currentConfig, [key]: value })); };
  const applyGuppyLengths = (group: "fast" | "slow") => {
    const text = group === "fast" ? fastLengthsText : slowLengthsText, expected = group === "fast" ? 11 : 16;
    const parsed = text.split(",").map(value => Number(value.trim()));
    if (parsed.length === expected && parsed.every(value => Number.isInteger(value) && value > 0 && value <= 1000)) updateGuppy(group === "fast" ? "fastLengths" : "slowLengths", parsed);
    else if (group === "fast") setFastLengthsText(guppyConfig.fastLengths.join(","));
    else setSlowLengthsText(guppyConfig.slowLengths.join(","));
  };
  const resetGuppy = () => { const defaults = freshGuppyDefaults(); beginRefresh(); setGuppyConfig(defaults); setFastLengthsText(defaults.fastLengths.join(",")); setSlowLengthsText(defaults.slowLengths.join(",")); };
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; window.localStorage.setItem("crypto-regime-theme", next); setTheme(next);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-runtime-theme]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; meta.dataset.runtimeTheme = "true"; document.head.append(meta); }
    meta.content = next === "dark" ? "#101714" : "#f2f1eb";
  };
  const triggerCard = (label: string, value: number | null, variant: string) => <div className={`trigger ${variant}`}><span>{label}</span><strong>{value == null ? "Conditional" : formatPrice(value, denomination)}</strong><small>{data?.selected.thresholdKind} · as of {formatDate(confirmedThrough, true)} UTC</small></div>;
  const triggerLabels = data?.selected.role === "exit" ? ["SHORT EXIT ABOVE", "LONG EXIT BELOW"] : data?.selected.role === "confirmation" ? ["POSITIVE ABOVE", "NEGATIVE BELOW"] : ["BULLISH ABOVE", "BEARISH BELOW"];

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark">{activeAsset.symbol}</div><div><p className="eyebrow">CRYPTO REGIME LAB · {activeAsset.label.toUpperCase()}</p><h1>Trend regimes, without the black box.</h1></div></div><div className="header-actions"><nav className="lab-nav" aria-label="Research labs"><a href="/" aria-current="page">Crypto</a><a href="/stocks">Stocks</a></nav>{installPrompt && <button className="install-button" onClick={() => { (installPrompt as Event & { prompt: () => void }).prompt(); setInstallPrompt(null); }}>Install app</button>}<div className={`freshness ${data?.dataset.stale ? "stale" : ""}`}><span />{data ? `${data.dataset.stale ? "Stale" : "Confirmed through"} · ${formatDate(confirmedThrough)}` : "Loading exchange data"}</div><AccountControls /><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><b>{theme === "dark" ? "Light" : "Dark"}</b></button></div></header>
    {data?.dataset.warning && <div className={`data-banner ${data.dataset.demo ? "danger" : "warning"}`}><strong>{data.dataset.demo ? "Demonstration data — no confirmed signal" : "Source quality warning"}</strong><span>{data.dataset.warning}</span></div>}
    {error && <div className="data-banner danger"><strong>Research API unavailable</strong><span>{error}</span><button onClick={() => window.location.reload()}>Retry</button></div>}
    <section className="command-row" aria-label="Research controls"><div className="control-group asset-control"><label htmlFor="asset">Asset</label><select id="asset" value={asset} onChange={event => chooseAsset(event.target.value as AssetId)}>{(data?.assets ?? ASSET_OPTIONS).map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.label}</option>)}</select></div><div className="control-group"><label htmlFor="market">Market source</label><select id="market" value={source} onChange={event => { beginRefresh(); setSource(event.target.value as SourceId); }}>{(data?.dataset.asset === asset ? data.sources : []).length ? data!.sources.map(item => <option key={item.id} value={item.id}>{item.label} · {item.market}</option>) : <option value={source}>{activeMarket.label} · {activeMarket.market}</option>}</select></div><div className="control-group grow"><label htmlFor="indicator">Indicator</label><select id="indicator" value={indicator} onChange={event => { beginRefresh(); setIndicator(event.target.value); const selectedRole = data?.registry.find(item => item.id === event.target.value)?.role; if (selectedRole) setRole(selectedRole); }}>{options.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div><div className="segmented" aria-label="Timeframe"><button className={timeframe === "1d" ? "active" : ""} onClick={() => chooseTimeframe("1d")}>1D</button><button className={timeframe === "1w" ? "active" : ""} onClick={() => chooseTimeframe("1w")}>1W</button></div></section>
    {indicator === "super_guppy" && <details className="indicator-settings" open><summary><span><b>Super Guppy R1.2 settings</b><small>Published defaults are loaded; every R1.2 input relevant to daily/weekly candles is available.</small></span><button type="button" onClick={event => { event.preventDefault(); resetGuppy(); }}>Reset defaults</button></summary><div className="settings-grid"><label><span>Source</span><select value={guppyConfig.source} onChange={event => updateGuppy("source", event.target.value as SuperGuppySource)}>{GUPPY_SOURCES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label><span>Repeat lookback</span><input type="number" min="0" max="100" value={guppyConfig.lookback} onChange={event => updateGuppy("lookback", Number(event.target.value))} /></label><label><span>Anchor (minutes)</span><select value={guppyConfig.anchorMinutes} onChange={event => updateGuppy("anchorMinutes", Number(event.target.value))}><option value="0">Current timeframe</option><option value="1440">1440 · Daily anchor</option></select><small>R1.2 anchor affects intraday charts only; both choices are equivalent here.</small></label><label className="length-input"><span>11 Trader EMA lengths</span><input value={fastLengthsText} onChange={event => setFastLengthsText(event.target.value)} onBlur={() => applyGuppyLengths("fast")} aria-label="Eleven comma-separated Trader EMA lengths" /></label><label className="length-input"><span>16 Investor EMA lengths</span><input value={slowLengthsText} onChange={event => setSlowLengthsText(event.target.value)} onBlur={() => applyGuppyLengths("slow")} aria-label="Sixteen comma-separated Investor EMA lengths" /></label></div><div className="setting-toggles"><label><input type="checkbox" checked={guppyConfig.showSwing} onChange={event => updateGuppy("showSwing", event.target.checked)} /><span>Swing arrows</span></label><label><input type="checkbox" checked={guppyConfig.showBreak} onChange={event => updateGuppy("showBreak", event.target.checked)} /><span>Trend Break arrows</span></label><label><input type="checkbox" checked={guppyConfig.requireConfluence} onChange={event => updateGuppy("requireConfluence", event.target.checked)} /><span>Require group confluence</span></label><label><input type="checkbox" checked={guppyConfig.candleChangeRetriggers} onChange={event => updateGuppy("candleChangeRetriggers", event.target.checked)} /><span>Candle-change Swing retriggers</span></label><label><input type="checkbox" checked={guppyConfig.showAverages} onChange={event => updateGuppy("showAverages", event.target.checked)} /><span>Show group averages</span></label><label><input type="checkbox" checked={guppyConfig.showEma200} onChange={event => updateGuppy("showEma200", event.target.checked)} /><span>Show EMA 200</span></label><label><input type="checkbox" checked={guppyConfig.ema200Filter} onChange={event => updateGuppy("ema200Filter", event.target.checked)} /><span>Use EMA 200 filter</span></label><label><input type="checkbox" checked={guppyConfig.colorBars} onChange={event => updateGuppy("colorBars", event.target.checked)} /><span>Color candles by Trader group</span></label></div></details>}
    <section className="close-countdown" aria-live="polite" aria-label={`${closeClock.title}: ${closeClock.remaining} remaining`}><div><p className="eyebrow">CONFIRMATION CLOCK · UTC</p><strong>{closeClock.title}</strong><span>{closeClock.boundary}</span></div><div className="countdown-value"><b>{closeClock.remaining}</b><small>remaining</small></div><div className="spot-price"><span>LIVE {activeAsset.symbol} SPOT · {(activeSpot?.sourceLabel ?? data?.dataset.sourceLabel ?? source).toUpperCase()}</span><b>{activeSpot ? formatPrice(activeSpot.price, activeSpot.denomination) : "—"}</b><small>{activeSpot ? `${activeSpot.fallback ? "fallback quote · " : ""}fetched ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(activeSpot.retrievedAt))} UTC` : spotError ? "quote unavailable" : "fetching current price…"}</small></div><p>The live quote is informational and refreshes on page load. The open {timeframe === "1d" ? "day" : "week"} is provisional; confirmed indicators update only after its close.</p></section>
    {loading && !data ? <LoadingView /> : data && <>
      <section className={`hero-grid ${loading ? "is-refreshing" : ""}`}><article className="chart-card"><div className="chart-heading"><div><p className="eyebrow">LAST CONFIRMED {timeframe === "1d" ? "DAILY" : "WEEKLY"} CLOSE · {data.dataset.market} · {data.dataset.sourceLabel.toUpperCase()}</p><div className="price-line"><strong>{formatPrice(current?.close, data.dataset.denomination)}</strong><span className={change != null && change < 0 ? "negative" : ""}>{formatPct(change, true)}</span></div></div><StateBadge state={data.selected.state} label={roleStateLabel(data.selected.role, data.selected.id, data.selected.state)} /></div><div className="chart-frame"><RegimeChart candles={data.candles} selected={data.selected} denomination={data.dataset.denomination} timeframe={timeframe} theme={theme} />{loading && <div className="chart-refresh">Refreshing completed candles…</div>}</div><div className="chart-legend">{data.selected.overlays.filter(line => line.showInLegend !== false).map(line => <span key={line.name}><i style={{ background: chartColorCss(line.color) }} />{line.legendLabel ?? line.name}</span>)}{data.selected.ribbons.filter(ribbon => ribbon.showInLegend !== false).flatMap(ribbon => (Object.entries(ribbon.palette) as Array<[State, string]>).map(([state, color]) => <span key={`${ribbon.id}-${state}`}><i className="range-swatch" style={{ background: chartColorCss(color) }} />{titleState(state)} range</span>))}{data.selected.id === "super_guppy" ? <><span><i style={{ background: "linear-gradient(90deg,var(--chart-guppy-lime) 0 50%,var(--chart-guppy-red) 50%)" }} />Swing arrows</span><span><i style={{ background: "linear-gradient(90deg,var(--chart-guppy-aqua) 0 50%,var(--chart-guppy-blue) 50%)" }} />Trend Break arrows</span></> : <span><i className="flip-dot" />Confirmed flip</span>}<span className="method-note">States effective next open</span></div></article>
        <aside className="signal-panel"><p className="eyebrow">CURRENT EVIDENCE</p><h2>{data.selected.shortName}</h2><div className="current-state-row"><StateBadge state={data.selected.state} label={roleStateLabel(data.selected.role, data.selected.id, data.selected.state)} /><span>since {formatDate(data.selected.lastFlip)}</span></div>{data.selected.role !== "valuation" && (data.selected.bullTrigger != null || data.selected.bearTrigger != null) && <>{triggerCard(triggerLabels[0], data.selected.bullTrigger, "bull-trigger")}{triggerCard(triggerLabels[1], data.selected.bearTrigger, "bear-trigger")}</>}<div className="method-card"><span>RULE</span><p>{data.selected.explanation}</p><b>{data.selected.triggerLabel}</b></div>{data.selected.disclaimer && <div className="proxy-note"><strong>Implementation note</strong>{data.selected.disclaimer}</div>}<p className="disclaimer">Research view only. No live orders or individualized allocation advice.</p></aside></section>
      <section className="guidance-card" aria-label={`${data.selected.displayName} interpretation guide`}><div className="guidance-heading"><div><p className="eyebrow">HOW TO INTERPRET IT</p><h2>{data.selected.guidance.summary}</h2></div>{data.selected.sourceUrl && <a href={data.selected.sourceUrl} target="_blank" rel="noreferrer">Published method ↗</a>}</div><div className="guidance-grid">{([data.selected.guidance.positive, data.selected.guidance.neutral, data.selected.guidance.negative] as Guidance["positive"][]).map((item, index) => <article className={["positive", "neutral", "negative"][index]} key={item.label}><span>{item.label}</span><p>{item.rule}</p></article>)}</div><div className="guidance-notes"><p><strong>Why this rule exists</strong>{data.selected.guidance.rationale}</p><ul>{data.selected.guidance.caveats.map(caveat => <li key={caveat}>{caveat}</li>)}</ul></div></section>
      <section className="family-strip" aria-label="Regime family agreement"><div><p className="eyebrow">FAMILY AGREEMENT</p><h2>Correlated models get one family voice</h2></div><div className="family-summary"><b className="bull-text">{data.familyAgreement.bull} bull</b><b className="neutral-text">{data.familyAgreement.neutral} neutral</b><b className="bear-text">{data.familyAgreement.bear} bear</b></div><div className="family-chips">{familyRows.map(row => <span key={row.family} className={row.state}><i />{row.family}<small>{row.members} model{row.members === 1 ? "" : "s"}</small></span>)}</div></section>
      <section className="matrix-card"><div className="section-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>Current state matrix</h2></div><div className="category-tabs" role="tablist">{ROLES.map(item => <button role="tab" aria-selected={role === item.id} className={role === item.id ? "active" : ""} key={item.id} onClick={() => chooseRole(item.id)}>{item.label}</button>)}</div></div><div className="matrix-table"><div className="matrix-header"><span>Model</span><span>Family</span><span>Daily</span><span>Weekly</span><span>Last flip</span><span>Next condition</span></div>{items.map(item => { const dailyState = item.dailyState ?? (timeframe === "1d" ? item.state : null), weeklyState = item.weeklyState ?? (timeframe === "1w" ? item.state : null); return <button className={`matrix-row ${indicator === item.id ? "selected" : ""}`} key={item.id} onClick={() => { beginRefresh(); setIndicator(item.id); }}><span><strong>{item.shortName}</strong><small>{item.thresholdKind}</small></span><span>{item.family}</span><StateBadge state={dailyState} label={roleStateLabel(item.role, item.id, dailyState)} compact /><StateBadge state={weeklyState} label={roleStateLabel(item.role, item.id, weeklyState)} compact /><span>{formatDate(timeframe === "1d" ? item.dailyLastFlip ?? item.lastFlip : item.weeklyLastFlip ?? item.lastFlip)}</span><b>{item.nextCondition}</b></button>; })}{!items.length && <p className="empty-state">No {role} model supports this timeframe.</p>}</div><p className="matrix-footnote">Fixed thresholds are known from prior completed candles. Provisional levels can move with unfinished OHLC. Conditional models cannot be reduced to one guaranteed price.</p></section>
      <section className="research-grid"><article className="research-card wide"><div className="section-heading"><div><p className="eyebrow">NEXT-OPEN BACKTEST</p><h2>Fixed presets, honest execution</h2></div><span className="assumption-pill">15 bps turnover</span></div><div className="backtest-table"><div className="backtest-head"><span>Model</span><span>CAGR</span><span>Max DD</span><span>Calmar</span><span>Exposure</span><span>Flips</span></div>{visibleBacktests.map(row => <div className="backtest-row" key={row.indicatorId}><strong>{row.displayName}</strong><span>{formatPct(row.cagr)}</span><span className="negative">{formatPct(row.maxDrawdown)}</span><b>{row.calmar?.toFixed(2) ?? "—"}</b><span>{formatPct(row.exposure)}</span><span>{row.flips}</span></div>)}</div></article>
        <article className="research-card wide"><p className="eyebrow">DATA PROVENANCE</p><h2>{data.dataset.sourceLabel} · {data.dataset.market}</h2><dl><div><dt>Calculation history</dt><dd>{data.dataset.candleCount.toLocaleString()} bars</dd></div><div><dt>Visible chart</dt><dd>Last {data.dataset.chartCandleCount} bars</dd></div><div><dt>Series begins</dt><dd>{formatDate(data.dataset.firstCandle)}</dd></div><div><dt>Storage</dt><dd>{data.dataset.storage === "sqlite" ? "Local SQLite cache" : data.dataset.storage === "d1" ? "Cloudflare D1" : data.dataset.storage === "provider" ? "Fresh provider import" : "Demo only"}</dd></div><div><dt>SHA-256</dt><dd className="checksum">{data.dataset.checksum.slice(0, 12)}…</dd></div><div><dt>Quality</dt><dd>{Object.values(data.dataset.quality).every(value => value === 0) ? "Passed" : "Review"}</dd></div></dl><p>Venues are never spliced and missing prices are never forward-filled.</p></article></section>
      <footer><p>Crypto Regime Lab separates price regimes, confirmation, exits, and valuation. It does not optimize presets against {data.dataset.assetLabel} history.</p><nav><a href="/api/v1/registry">Registry JSON</a><a href={`/api/v1/series?asset=${asset}&source=${source}&timeframe=${timeframe}`}>Series JSON</a><a href={`/api/v1/health?asset=${asset}`}>Source health</a></nav></footer>
    </>}
  </main>;
}
