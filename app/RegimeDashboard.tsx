"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { confirmationClock } from "../lib/confirmation-clock";
import { buildDashboardPayload } from "../lib/dashboard-calculation";
import type { MarketDataset } from "../lib/market-data";

type State = "bull" | "bear" | "neutral";
type Role = "regime" | "confirmation" | "exit" | "valuation";
type Timeframe = "1d" | "1w";
type AssetId = "btc" | "eth" | "sol";
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type SpotQuote = { asset: AssetId; source: string; quoteSource?: string; sourceLabel: string; market: string; denomination: string; fallback?: boolean; price: number; retrievedAt: string };
type MatrixItem = {
  id: string; displayName: string; shortName: string; role: Role; family: string; state: State; lastFlip: number | null;
  dailyState?: State | null; weeklyState?: State | null; dailyLastFlip?: number | null; weeklyLastFlip?: number | null;
  thresholdKind: "fixed" | "provisional" | "conditional"; nextCondition: string; bullTrigger: number | null; bearTrigger: number | null;
  triggerLabel: string; explanation: string; values: Record<string, number | null>; disclaimer?: string;
};
type Payload = {
  generatedAt: string;
  registry: Array<{ id: string; displayName: string; role: Role; family: string; supportedTimeframes: Timeframe[]; description: string; disclaimer?: string }>;
  assets: Array<{ id: AssetId; label: string; symbol: string; defaultSource: string }>;
  sources: Array<{ id: string; label: string; market: string }>;
  dataset: { asset: AssetId; assetLabel: string; source: string; sourceLabel: string; market: string; denomination: string; timeframe: Timeframe; retrievedAt: string; checksum: string; stale: boolean; demo: boolean; storage: "provider" | "sqlite" | "d1" | "demo"; warning: string | null; quality: { gaps: number; duplicates: number; malformed: number }; firstCandle: number | null; lastCandle: number | null; candleCount: number; chartCandleCount: number };
  candles: Candle[];
  selected: MatrixItem & { states: Array<State | null>; overlays: Array<{ name: string; color: string; dashed?: boolean; points: Array<{ time: number; value: number }> }>; flips: Array<{ time: number; from: State; to: State; close: number }> };
  matrix: MatrixItem[];
  supporting: MatrixItem[];
  familyAgreement: { bull: number; bear: number; neutral: number };
  backtests: Array<{ indicatorId: string; displayName: string; totalReturn: number; cagr: number; maxDrawdown: number; calmar: number | null; volatility: number; exposure: number; turnover: number; flips: number }>;
  research: { faber10Month: { state: State | "unavailable"; close: number | null; sma10: number | null }; assumptions: { execution: string; exposure: string; costBps: number; sensitivityBps: number[] }; ranking: string };
};
type BrowserCalculationResponse = { calculation: "browser"; daily: MarketDataset; weekly: MarketDataset; sources?: Payload["sources"] };

const ROLES: Array<{ id: Role; label: string }> = [
  { id: "regime", label: "Regime" }, { id: "confirmation", label: "Confirmation" }, { id: "exit", label: "Exit" }, { id: "valuation", label: "Valuation" },
];
const ASSET_OPTIONS: Payload["assets"] = [
  { id: "btc", label: "Bitcoin", symbol: "BTC", defaultSource: "bitstamp" },
  { id: "eth", label: "Ethereum", symbol: "ETH", defaultSource: "bitstamp" },
  { id: "sol", label: "Solana", symbol: "SOL", defaultSource: "binance" },
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

function RegimeChart({ candles, selected, denomination }: { candles: Candle[]; selected: Payload["selected"]; denomination: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !candles.length) return;
    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.scale(ratio, ratio);
      const w = bounds.width, h = bounds.height, pad = { t: 18, r: 76, b: 32, l: 12 }, cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
      const values = candles.flatMap(c => [c.high, c.low]);
      for (const overlay of selected.overlays) for (const point of overlay.points) values.push(point.value);
      if (selected.bullTrigger != null) values.push(selected.bullTrigger); if (selected.bearTrigger != null) values.push(selected.bearTrigger);
      let min = Math.min(...values), max = Math.max(...values); const margin = Math.max(1, (max - min) * 0.09); min -= margin; max += margin;
      const x = (i: number) => pad.l + (i + 0.5) * cw / candles.length;
      const y = (v: number) => pad.t + (max - v) / (max - min) * ch;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#fffefa"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < candles.length; i++) {
        const state = selected.states[i]; ctx.fillStyle = state === "bull" ? "rgba(15,138,97,.035)" : state === "bear" ? "rgba(201,85,69,.035)" : "rgba(217,165,32,.025)";
        ctx.fillRect(pad.l + i * cw / candles.length, pad.t, cw / candles.length + 1, ch);
      }
      ctx.strokeStyle = "#e8ebe5"; ctx.lineWidth = 1; ctx.font = "10px ui-monospace, monospace"; ctx.fillStyle = "#83908a"; ctx.textAlign = "left";
      for (let i = 0; i <= 4; i++) { const yy = pad.t + i * ch / 4; ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke(); ctx.fillText(formatPrice(max - i * (max - min) / 4, denomination), w - pad.r + 8, yy + 3); }
      const candleWidth = Math.max(2, Math.min(8, cw / candles.length * 0.58));
      candles.forEach((candle, i) => { const up = candle.close >= candle.open; ctx.strokeStyle = up ? "#0f8a61" : "#c95545"; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(x(i), y(candle.high)); ctx.lineTo(x(i), y(candle.low)); ctx.stroke(); const top = y(Math.max(candle.open, candle.close)), bottom = y(Math.min(candle.open, candle.close)); ctx.fillRect(x(i) - candleWidth / 2, top, candleWidth, Math.max(1.5, bottom - top)); });
      for (const overlay of selected.overlays) {
        const byTime = new Map(overlay.points.map(point => [point.time, point.value])); ctx.strokeStyle = overlay.color; ctx.lineWidth = 1.7; ctx.setLineDash(overlay.dashed ? [5, 4] : []); ctx.beginPath(); let started = false;
        candles.forEach((candle, i) => { const value = byTime.get(candle.time); if (value == null) return; if (!started) { ctx.moveTo(x(i), y(value)); started = true; } else ctx.lineTo(x(i), y(value)); }); ctx.stroke(); ctx.setLineDash([]);
      }
      const drawTrigger = (value: number | null, color: string, label: string) => { if (value == null) return; const yy = y(value); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#fffefa"; ctx.fillRect(Math.max(pad.l, w - pad.r - 178), yy - 10, 178, 18); ctx.fillStyle = color; ctx.font = "700 9px ui-monospace, monospace"; ctx.textAlign = "right"; ctx.fillText(`${label} · ${formatPrice(value, denomination)}`, w - pad.r - 4, yy + 3); };
      if (selected.bullTrigger === selected.bearTrigger) drawTrigger(selected.bullTrigger, "#6d756f", selected.thresholdKind.toUpperCase()); else { drawTrigger(selected.bullTrigger, "#0f8a61", `BULL · ${selected.thresholdKind}`); drawTrigger(selected.bearTrigger, "#c95545", `BEAR · ${selected.thresholdKind}`); }
      const indexByTime = new Map(candles.map((candle, i) => [candle.time, i]));
      for (const flip of selected.flips) { const i = indexByTime.get(flip.time); if (i == null) continue; const yy = flip.to === "bull" ? y(candles[i].low) + 13 : y(candles[i].high) - 13; ctx.fillStyle = flip.to === "bull" ? "#0f8a61" : flip.to === "bear" ? "#c95545" : "#c99313"; ctx.beginPath(); if (flip.to === "bull") { ctx.moveTo(x(i), yy - 7); ctx.lineTo(x(i) - 5, yy); ctx.lineTo(x(i) + 5, yy); } else { ctx.moveTo(x(i), yy + 7); ctx.lineTo(x(i) - 5, yy); ctx.lineTo(x(i) + 5, yy); } ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = "#83908a"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
      [0, Math.floor((candles.length - 1) / 3), Math.floor(2 * (candles.length - 1) / 3), candles.length - 1].forEach(i => ctx.fillText(new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(candles[i].time), x(i), h - 9));
    };
    render(); const observer = new ResizeObserver(render); observer.observe(canvas); return () => observer.disconnect();
  }, [candles, selected, denomination]);
  return <canvas ref={ref} className="regime-canvas" role="img" aria-label={`${selected.displayName} candlestick chart with confirmed regime shading and flip markers`} />;
}

function StateBadge({ state, compact = false }: { state: State | null | undefined; compact?: boolean }) {
  const value = state ?? "neutral";
  return <span className={`state-badge ${value} ${compact ? "compact" : ""}`}><i />{state ? titleState(state) : "N/A"}</span>;
}
function LoadingView() { return <div className="loading-grid" aria-label="Loading market research"><div className="loading-block chart-load" /><div className="loading-block side-load" /><div className="loading-block table-load" /></div>; }

export default function RegimeDashboard() {
  const [asset, setAsset] = useState<AssetId>("btc"), [source, setSource] = useState("bitstamp"), [timeframe, setTimeframe] = useState<Timeframe>("1w"), [indicator, setIndicator] = useState("support_band"), [role, setRole] = useState<Role>("regime");
  const [data, setData] = useState<Payload | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [spot, setSpot] = useState<SpotQuote | null>(null), [spotError, setSpotError] = useState<string | null>(null);
  // Keep the server render and first browser render identical. The real clock is
  // installed immediately after hydration, then advances once per minute.
  const [clock, setClock] = useState(0), [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event); }; window.addEventListener("beforeinstallprompt", capture); return () => window.removeEventListener("beforeinstallprompt", capture); }, []);
  useEffect(() => { const frame = window.requestAnimationFrame(() => setClock(Date.now())); const timer = window.setInterval(() => setClock(Date.now()), 60_000); return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); }; }, []);
  useEffect(() => { const timer = window.setInterval(() => setRefreshTick(value => value + 1), 5 * 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/dashboard?asset=${asset}&source=${source}&timeframe=${timeframe}&indicator=${indicator}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json() as (Payload | BrowserCalculationResponse) & { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Research API returned ${response.status}`);
      const payload = "calculation" in result && result.calculation === "browser"
        ? { ...buildDashboardPayload(asset, source as "bitstamp" | "binance" | "kraken" | "coinbase", timeframe, indicator, result.daily, result.weekly), ...(result.sources ? { sources: result.sources } : {}) } as Payload
        : result as Payload;
      if (!Array.isArray(payload.candles) || !payload.dataset) throw new Error("Research API returned an incomplete dashboard payload");
      return payload;
    }).then((payload: Payload) => { setData(payload); setError(null); setLoading(false); }).catch(reason => { if (reason.name !== "AbortError") { setError(reason.message); setLoading(false); } });
    return () => controller.abort();
  }, [asset, source, timeframe, indicator, refreshTick]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spot?asset=${asset}&source=${source}&request=${Date.now()}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
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
  const confirmedThrough = confirmedCloseDate(data?.dataset.lastCandle, timeframe);
  const beginRefresh = () => { setLoading(true); setError(null); };
  const chooseRole = (next: Role) => { beginRefresh(); setRole(next); const nextIndicator = data?.registry.find(item => item.role === next && item.supportedTimeframes.includes(timeframe)); if (nextIndicator) setIndicator(nextIndicator.id); };
  const chooseTimeframe = (next: Timeframe) => { beginRefresh(); const currentSpec = data?.registry.find(item => item.id === indicator); const nextIndicator = currentSpec?.supportedTimeframes.includes(next) ? currentSpec : data?.registry.find(item => item.role === role && item.supportedTimeframes.includes(next)); setTimeframe(next); if (nextIndicator) setIndicator(nextIndicator.id); };
  const chooseAsset = (next: AssetId) => { beginRefresh(); setAsset(next); setSource(ASSET_OPTIONS.find(item => item.id === next)!.defaultSource); setSpot(null); };
  const triggerCard = (label: string, value: number | null, variant: string) => <div className={`trigger ${variant}`}><span>{label}</span><strong>{value == null ? "Conditional" : formatPrice(value, denomination)}</strong><small>{data?.selected.thresholdKind} · as of {formatDate(confirmedThrough, true)} UTC</small></div>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark">{activeAsset.symbol}</div><div><p className="eyebrow">CRYPTO REGIME LAB · {activeAsset.label.toUpperCase()}</p><h1>Trend regimes, without the black box.</h1></div></div><div className="header-actions">{installPrompt && <button className="install-button" onClick={() => { (installPrompt as Event & { prompt: () => void }).prompt(); setInstallPrompt(null); }}>Install app</button>}<div className={`freshness ${data?.dataset.stale ? "stale" : ""}`}><span />{data ? `${data.dataset.stale ? "Stale" : "Confirmed through"} · ${formatDate(confirmedThrough)}` : "Loading exchange data"}</div></div></header>
    {data?.dataset.warning && <div className={`data-banner ${data.dataset.demo ? "danger" : "warning"}`}><strong>{data.dataset.demo ? "Demonstration data — no confirmed signal" : "Source quality warning"}</strong><span>{data.dataset.warning}</span></div>}
    {error && <div className="data-banner danger"><strong>Research API unavailable</strong><span>{error}</span><button onClick={() => window.location.reload()}>Retry</button></div>}
    <section className="command-row" aria-label="Research controls"><div className="control-group asset-control"><label htmlFor="asset">Asset</label><select id="asset" value={asset} onChange={event => chooseAsset(event.target.value as AssetId)}>{(data?.assets ?? ASSET_OPTIONS).map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.label}</option>)}</select></div><div className="control-group"><label htmlFor="market">Market source</label><select id="market" value={source} onChange={event => { beginRefresh(); setSource(event.target.value); }}>{(data?.dataset.asset === asset ? data.sources : []).length ? data!.sources.map(item => <option key={item.id} value={item.id}>{item.label} · {item.market}</option>) : <option value={source}>{source === "binance" ? "Binance" : "Bitstamp"} · {activeAsset.symbol}/{source === "binance" ? "USDT" : "USD"}</option>}</select></div><div className="control-group grow"><label htmlFor="indicator">Indicator</label><select id="indicator" value={indicator} onChange={event => { beginRefresh(); setIndicator(event.target.value); const selectedRole = data?.registry.find(item => item.id === event.target.value)?.role; if (selectedRole) setRole(selectedRole); }}>{options.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div><div className="segmented" aria-label="Timeframe"><button className={timeframe === "1d" ? "active" : ""} onClick={() => chooseTimeframe("1d")}>1D</button><button className={timeframe === "1w" ? "active" : ""} onClick={() => chooseTimeframe("1w")}>1W</button></div></section>
    <section className="close-countdown" aria-live="polite" aria-label={`${closeClock.title}: ${closeClock.remaining} remaining`}><div><p className="eyebrow">CONFIRMATION CLOCK · UTC</p><strong>{closeClock.title}</strong><span>{closeClock.boundary}</span></div><div className="countdown-value"><b>{closeClock.remaining}</b><small>remaining</small></div><div className="spot-price"><span>LIVE {activeAsset.symbol} SPOT · {(activeSpot?.sourceLabel ?? data?.dataset.sourceLabel ?? source).toUpperCase()}</span><b>{activeSpot ? formatPrice(activeSpot.price, activeSpot.denomination) : "—"}</b><small>{activeSpot ? `${activeSpot.fallback ? "fallback quote · " : ""}fetched ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(activeSpot.retrievedAt))} UTC` : spotError ? "quote unavailable" : "fetching current price…"}</small></div><p>The live quote is informational and refreshes on page load. The open {timeframe === "1d" ? "day" : "week"} is provisional; confirmed indicators update only after its close.</p></section>
    {loading && !data ? <LoadingView /> : data && <>
      <section className={`hero-grid ${loading ? "is-refreshing" : ""}`}><article className="chart-card"><div className="chart-heading"><div><p className="eyebrow">LAST CONFIRMED {timeframe === "1d" ? "DAILY" : "WEEKLY"} CLOSE · {data.dataset.market} · {data.dataset.sourceLabel.toUpperCase()}</p><div className="price-line"><strong>{formatPrice(current?.close, data.dataset.denomination)}</strong><span className={change != null && change < 0 ? "negative" : ""}>{formatPct(change, true)}</span></div></div><StateBadge state={data.selected.state} /></div><div className="chart-frame"><RegimeChart candles={data.candles} selected={data.selected} denomination={data.dataset.denomination} />{loading && <div className="chart-refresh">Refreshing completed candles…</div>}</div><div className="chart-legend">{data.selected.overlays.map(line => <span key={line.name}><i style={{ background: line.color }} />{line.name}</span>)}<span><i className="flip-dot" />Confirmed flip</span><span className="method-note">States effective next open</span></div></article>
        <aside className="signal-panel"><p className="eyebrow">CURRENT EVIDENCE</p><h2>{data.selected.shortName}</h2><div className="current-state-row"><StateBadge state={data.selected.state} /><span>since {formatDate(data.selected.lastFlip)}</span></div>{triggerCard("BULLISH ABOVE", data.selected.bullTrigger, "bull-trigger")}{triggerCard("BEARISH BELOW", data.selected.bearTrigger, "bear-trigger")}<div className="method-card"><span>RULE</span><p>{data.selected.explanation}</p><b>{data.selected.triggerLabel}</b></div>{data.selected.disclaimer && <div className="proxy-note"><strong>Private-product disclaimer</strong>{data.selected.disclaimer}</div>}<p className="disclaimer">Research view only. No live orders, allocation advice, or claim that a transparent proxy reproduces a private indicator.</p></aside></section>
      <section className="family-strip" aria-label="Regime family agreement"><div><p className="eyebrow">FAMILY AGREEMENT</p><h2>Correlated models get one family voice</h2></div><div className="family-summary"><b className="bull-text">{data.familyAgreement.bull} bull</b><b className="neutral-text">{data.familyAgreement.neutral} neutral</b><b className="bear-text">{data.familyAgreement.bear} bear</b></div><div className="family-chips">{familyRows.map(row => <span key={row.family} className={row.state}><i />{row.family}<small>{row.members} model{row.members === 1 ? "" : "s"}</small></span>)}</div></section>
      <section className="matrix-card"><div className="section-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>Current state matrix</h2></div><div className="category-tabs" role="tablist">{ROLES.map(item => <button role="tab" aria-selected={role === item.id} className={role === item.id ? "active" : ""} key={item.id} onClick={() => chooseRole(item.id)}>{item.label}</button>)}</div></div><div className="matrix-table"><div className="matrix-header"><span>Model</span><span>Family</span><span>Daily</span><span>Weekly</span><span>Last flip</span><span>Next condition</span></div>{items.map(item => <button className={`matrix-row ${indicator === item.id ? "selected" : ""}`} key={item.id} onClick={() => { beginRefresh(); setIndicator(item.id); }}><span><strong>{item.shortName}</strong><small>{item.thresholdKind}</small></span><span>{item.family}</span><StateBadge state={item.dailyState ?? (timeframe === "1d" ? item.state : null)} compact /><StateBadge state={item.weeklyState ?? (timeframe === "1w" ? item.state : null)} compact /><span>{formatDate(timeframe === "1d" ? item.dailyLastFlip ?? item.lastFlip : item.weeklyLastFlip ?? item.lastFlip)}</span><b>{item.nextCondition}</b></button>)}{!items.length && <p className="empty-state">No {role} model supports this timeframe.</p>}</div><p className="matrix-footnote">Fixed thresholds are known from prior completed candles. Provisional levels can move with unfinished OHLC. Conditional models cannot be reduced to one guaranteed price.</p></section>
      <section className="research-grid"><article className="research-card wide"><div className="section-heading"><div><p className="eyebrow">NEXT-OPEN BACKTEST</p><h2>Fixed presets, honest execution</h2></div><span className="assumption-pill">15 bps turnover</span></div><div className="backtest-table"><div className="backtest-head"><span>Model</span><span>CAGR</span><span>Max DD</span><span>Calmar</span><span>Exposure</span><span>Flips</span></div>{data.backtests.slice(0, 8).map(row => <div className="backtest-row" key={row.indicatorId}><strong>{row.displayName}</strong><span>{formatPct(row.cagr)}</span><span className="negative">{formatPct(row.maxDrawdown)}</span><b>{row.calmar?.toFixed(2) ?? "—"}</b><span>{formatPct(row.exposure)}</span><span>{row.flips}</span></div>)}</div></article>
        <article className="research-card"><p className="eyebrow">PUBLISHED BASELINE</p><h2>Faber 10-month rule</h2><StateBadge state={data.research.faber10Month.state === "unavailable" ? null : data.research.faber10Month.state} /><dl><div><dt>Monthly close</dt><dd>{formatPrice(data.research.faber10Month.close, data.dataset.denomination)}</dd></div><div><dt>10-month SMA</dt><dd>{formatPrice(data.research.faber10Month.sma10, data.dataset.denomination)}</dd></div></dl><p>Included in reports, not the daily/weekly flip matrix.</p></article>
        <article className="research-card"><p className="eyebrow">DATA PROVENANCE</p><h2>{data.dataset.sourceLabel} · {data.dataset.market}</h2><dl><div><dt>Calculation history</dt><dd>{data.dataset.candleCount.toLocaleString()} bars</dd></div><div><dt>Visible chart</dt><dd>Last {data.dataset.chartCandleCount} bars</dd></div><div><dt>Series begins</dt><dd>{formatDate(data.dataset.firstCandle)}</dd></div><div><dt>Storage</dt><dd>{data.dataset.storage === "sqlite" ? "Local SQLite cache" : data.dataset.storage === "d1" ? "Cloudflare D1" : data.dataset.storage === "provider" ? "Fresh provider import" : "Demo only"}</dd></div><div><dt>SHA-256</dt><dd className="checksum">{data.dataset.checksum.slice(0, 12)}…</dd></div><div><dt>Quality</dt><dd>{Object.values(data.dataset.quality).every(value => value === 0) ? "Passed" : "Review"}</dd></div></dl><p>Venues are never spliced and missing prices are never forward-filled.</p></article></section>
      <footer><p>Crypto Regime Lab separates price regimes, confirmation, exits, and valuation. It does not optimize presets against {data.dataset.assetLabel} history.</p><nav><a href="/api/v1/registry">Registry JSON</a><a href={`/api/v1/series?asset=${asset}&source=${source}&timeframe=${timeframe}`}>Series JSON</a><a href={`/api/v1/health?asset=${asset}`}>Source health</a></nav></footer>
    </>}
  </main>;
}
