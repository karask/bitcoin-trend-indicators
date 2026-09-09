"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Cloudflare Pages serves independent static shells. */

import { useEffect, useMemo, useRef, useState } from "react";
import { AccountControls, authenticatedFetch } from "../AuthClient";
import LabNavigation from "../LabNavigation";
import { INDICATOR_SPECS } from "../../lib/regimes";
import { commodityDefinition } from "../../lib/commodities";
import { stockDefinition } from "../../lib/stocks";
import { historyIsCurrent, loadCryptoHistory, loadStockHistory, loadCommodityHistory, requestJson, type SyncStatus } from "../../lib/history-client";
import { OVERVIEW_ASSETS, overviewIndicator, overviewLevels, overviewState, overviewTimeframe, overviewUrl, summarizeOverview, type OverviewHistory } from "../../lib/asset-overview";
import { formatDate, formatPct, formatPrice, quoteAge } from "../../lib/display";
import { signalTiming } from "../../lib/signal-timing";

type Quote = { price: number; denomination?: string; retrievedAt: string };
type Row = { quote?: Quote; status?: SyncStatus; historyError?: boolean; quoteError?: boolean };

export default function AssetOverview() {
  const [indicator, setIndicator] = useState("kk_supertrend");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [histories, setHistories] = useState<Record<string, OverviewHistory>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [clock, setClock] = useState(0);
  const [dark, setDark] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const spec = overviewIndicator(indicator), timeframe = overviewTimeframe(indicator);
  const summaries = useMemo(() => Object.fromEntries(Object.entries(histories).map(([key, history]) => [key, summarizeOverview(history, indicator)])), [histories, indicator]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIndicator(overviewIndicator(new URLSearchParams(window.location.search).get("indicator")).id);
      setClock(Date.now()); setDark(document.documentElement.dataset.theme === "dark");
    });
    const back = () => setIndicator(overviewIndicator(new URLSearchParams(window.location.search).get("indicator")).id);
    window.addEventListener("popstate", back);
    // Age labels only: no network requests from this timer.
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener("popstate", back); };
  }, []);

  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    const update = (key: string, values: Partial<Row> & { data?: OverviewHistory }) => {
      if (abort.signal.aborted) return;
      const { data, ...status } = values;
      if (data) setHistories(current => ({ ...current, [key]: data }));
      setRows(current => ({ ...current, [key]: { ...current[key], ...status } }));
    };
    const check = async () => {
      await Promise.resolve();
      if (abort.signal.aborted) return;
      setBusy(true); setProgress(0); setStopped(false);
      let next = 0;
      const worker = async () => {
        while (!abort.signal.aborted && next < OVERVIEW_ASSETS.length) {
          const asset = OVERVIEW_ASSETS[next++], key = asset.asset;
          update(key, { status: "checking", historyError: false, quoteError: false });
          const history = asset.lab === "crypto"
            ? loadCryptoHistory(asset.asset, asset.source, authenticatedFetch, abort.signal, cached => update(key, { data: { lab: "crypto", history: cached } })).then(result => update(key, { data: { lab: "crypto", history: result.history }, status: result.status }))
            : asset.lab === "commodity" ? loadCommodityHistory(commodityDefinition(asset.asset).symbol, authenticatedFetch, abort.signal, cached => update(key, { data: { lab: "commodity", history: cached } })).then(result => update(key, { data: { lab: "commodity", history: result.history }, status: result.status }))
            : loadStockHistory(stockDefinition(asset.asset).symbol, authenticatedFetch, abort.signal, cached => update(key, { data: { lab: "stock", history: cached } })).then(result => update(key, { data: { lab: "stock", history: result.history }, status: result.status }));
          const quoteUrl = asset.lab === "crypto" ? `/api/v1/spot?${new URLSearchParams({ asset: asset.asset, source: asset.source })}` : asset.lab === "commodity" ? `/api/v1/commodities/quote?symbol=${encodeURIComponent(commodityDefinition(asset.asset).symbol)}` : `/api/v1/stocks/quote?symbol=${stockDefinition(asset.asset).symbol}`;
          await Promise.all([
            history.catch(() => update(key, { status: "failed", historyError: true })),
            requestJson<Quote>(authenticatedFetch, quoteUrl, { signal: abort.signal }, 12_000).then(quote => update(key, { quote })).catch(() => update(key, { quoteError: true })),
          ]);
          if (!abort.signal.aborted) setProgress(value => value + 1);
        }
      };
      // One market at a time avoids provider bursts as the asset catalog grows.
      await worker();
      if (!abort.signal.aborted) setBusy(false);
    };
    void check();
    return () => abort.abort();
  }, [refreshKey]);

  const chooseIndicator = (id: string) => {
    const valid = overviewIndicator(id).id;
    setIndicator(valid);
    const url = new URL(window.location.href); url.searchParams.set("indicator", valid);
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  };
  const toggleTheme = () => {
    const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("crypto-regime-theme", next ? "dark" : "light"); } catch { /* Theme works for this visit. */ }
  };
  return <main className="app-shell overview-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark">RL</div><div><p className="eyebrow">REGIME LAB</p><h1>Asset overview</h1></div></div><div className="header-actions"><LabNavigation current="overview" /><AccountControls /><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} theme`}><span aria-hidden="true">{dark ? "☀" : "☾"}</span><b>{dark ? "Light" : "Dark"}</b></button></div></header>
    <section className="overview-controls" aria-label="Overview controls"><label htmlFor="overview-indicator">Indicator for all assets<select id="overview-indicator" value={indicator} onChange={event => chooseIndicator(event.target.value)}>{INDICATOR_SPECS.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><button type="button" disabled={busy} onClick={() => { setBusy(true); setRefreshKey(value => value + 1); }}>Check all assets</button>{busy && <button type="button" onClick={() => { controller.current?.abort(); setBusy(false); setStopped(true); setRows(current => Object.fromEntries(Object.entries(current).map(([key, row]) => [key, row.status === "checking" ? { ...row, status: undefined } : row]))); }}>Stop</button>}<p role="status">{busy ? `Checking ${progress} / ${OVERVIEW_ASSETS.length} assets…` : stopped ? "Check stopped. Available snapshots retained." : `Checked ${progress} assets. See rows for any failures.`}</p></section>
    <p className="overview-note">Daily and weekly signals use completed candles. Levels and flip dates use {timeframe === "1w" ? "weekly" : "daily"} bars. Cached history appears first; opening this page checks for updates once. Changing the indicator does not fetch data. No automatic polling.</p>
    <p className="overview-note">Crypto uses each asset’s default venue, shown below. Stock prices use Yahoo Finance; history is split-adjusted. Commodities use continuous gold/silver futures in USD per troy ounce, not spot metal. Contract rolls can affect levels. Provisional levels may move before the next close. Conditional models have no guaranteed single-price reversal.</p>
    {(["crypto", "stock", "commodity"] as const).map(lab => <section className="overview-section" aria-labelledby={`overview-${lab}`} key={lab}>
      <div className="section-heading"><h2 id={`overview-${lab}`}>{lab === "crypto" ? "Crypto" : lab === "stock" ? "Stocks" : "Commodities"}</h2><span>{OVERVIEW_ASSETS.filter(asset => asset.lab === lab).length} assets · {spec.shortName}</span></div>
      <table className="overview-table"><thead><tr><th scope="col">Asset / source</th><th scope="col">Daily</th><th scope="col">Weekly</th><th scope="col">{timeframe === "1w" ? "Weekly" : "Daily"} level / condition</th><th scope="col">Price</th><th scope="col">Snapshot / last flip</th></tr></thead><tbody>{OVERVIEW_ASSETS.filter(asset => asset.lab === lab).map(asset => {
        const row = rows[asset.asset], summary = summaries[asset.asset], signal = summary?.selected, quote = row?.quote;
        const levels = overviewLevels(signal), price = quote?.price ?? summary?.close;
        const ready = signal?.readiness?.ready, current = summary && historyIsCurrent(lab, summary.dailyLast, summary.weeklyLast, clock);
        const flip = ready && signal.lastFlip != null ? signalTiming(signal.lastFlip, timeframe, lab === "crypto" ? "crypto" : lab === "stock" ? "equity" : "commodity") : null;
        return <tr key={asset.asset}>
          <th scope="row"><a href={overviewUrl(asset, indicator)}><strong>{asset.symbol}</strong><small>{asset.label}</small><small>{asset.venue} · open {timeframe === "1w" ? "weekly" : "daily"} chart</small></a></th>
          {(["1d", "1w"] as const).map(tf => { const item = tf === "1d" ? summary?.day : summary?.week; return <td key={tf} data-label={tf === "1d" ? "Daily" : "Weekly"} className={item?.readiness?.ready && item.role === "regime" ? `${item.state}-text` : ""}>{overviewState(item, spec.supportedTimeframes.includes(tf))}</td>; })}
          <td data-label={`${timeframe === "1w" ? "Weekly" : "Daily"} level / condition`}>{levels.map(level => <div key={level.label}><b>{level.label} {formatPrice(level.price, summary?.denomination)}</b><small>{price ? `${formatPct(Math.abs(level.price / price - 1))} away · vs ${quote ? "quote" : "completed close"}` : "Price unavailable"}</small></div>)}{!levels.length && <b>{!signal ? "Not loaded" : !ready ? "Insufficient history" : signal.role === "valuation" ? "Price-ratio context only" : signal.thresholdKind === "conditional" ? "Conditional — no single price" : "No price threshold"}</b>}{ready && <small>{signal.role === "valuation" ? "Context, not a trade signal" : `${signal.thresholdKind} · close-confirmed`}</small>}</td>
          <td data-label="Price"><b>{formatPrice(price, quote?.denomination ?? summary?.denomination)}</b><small>{quote ? `Quote · ${quoteAge(quote.retrievedAt, clock)}` : `Completed close · ${formatDate(summary?.dailyLast)}`}</small>{row?.quoteError && <small className="bear-text">Quote update failed{quote ? "; previous quote retained" : ""}</small>}</td>
          <td data-label="Snapshot / last flip"><b>{row?.status === "checking" ? "Checking for updates" : row?.status === "failed" || row?.historyError ? "Update failed; retry available" : !summary ? busy ? "Waiting to load" : "Not loaded" : current ? "Candles current" : "Snapshot behind"}</b><small>Daily: {formatDate(summary?.dailyLast)}<br />Week of: {formatDate(summary?.weeklyLast)}</small>{summary && <small>{flip ? lab === "commodity" ? `Flip cutoff ${formatDate(flip.confirmedAt)} · next available bar open` : `Flip effective ${formatDate(flip.effectiveAt)}` : "No confirmed flip"}</small>}{spec.role === "regime" && summary?.day?.readiness?.ready && summary.week?.readiness?.ready && summary.day.state !== summary.week.state && <small className="bear-text">Daily / weekly disagree</small>}</td>
        </tr>;
      })}</tbody></table>
    </section>)}
    <footer><p>All platform assets · unchanged indicator presets · Data sourced from Yahoo Finance for stocks and commodity futures.</p><nav><a href="/">Crypto lab</a><a href="/stocks/">Stock lab</a><a href="/commodities/">Commodity lab</a></nav></footer>
  </main>;
}
