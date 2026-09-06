"use client";

import { useEffect, useRef, useState } from "react";
import { ASSETS, marketDefinition, type AssetId, type SourceId } from "../lib/markets";
import { STOCKS, stockDefinition, type StockId, type StockQuote } from "../lib/stocks";
import { readCryptoHistoryCache } from "../lib/crypto-cache";
import { readStockHistoryCache } from "../lib/stock-cache";
import { historyIsCurrent, loadCryptoHistory, loadStockHistory, requestJson } from "../lib/history-client";
import { cryptoWatchSummary, normalizePins, pinKey, stockWatchSummary, type WatchPin, type WatchSummary } from "../lib/watchlist";
import { formatDate, formatPct, formatPrice, quoteAge } from "../lib/display";
import type { Lab } from "../lib/view-preferences";
import { authenticatedFetch } from "./AuthClient";
import { signalTiming } from "../lib/signal-timing";

type WatchQuote = { price: number; retrievedAt: string; denomination: string };
type Row = { summary?: WatchSummary; quote?: WatchQuote; error?: string };

export default function Watchlist({ lab, active, revision, now, activeQuote, onSelect }: { lab: Lab; active: WatchPin; revision?: string; now: number; activeQuote?: WatchQuote | null; onSelect: (pin: WatchPin) => void }) {
  const [pins, setPins] = useState<WatchPin[]>([]);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState("pinned");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      let saved: unknown;
      try { saved = JSON.parse(localStorage.getItem(`regime-watchlist-v1:${lab}`) ?? "null"); } catch { /* Use default pins. */ }
      if (!cancelled) { setPins(normalizePins(lab, saved)); setReady(true); }
    });
    return () => { cancelled = true; controller.current?.abort(); };
  }, [lab]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(`regime-watchlist-v1:${lab}`, JSON.stringify(pins)); } catch { /* Watchlist still works for this visit. */ }
    let cancelled = false;
    const read = async () => {
      const results = await Promise.all(pins.map(async pin => {
        if (lab === "crypto") {
          const history = await readCryptoHistoryCache(pin.asset as AssetId, pin.source as SourceId).catch(() => null);
          return { key: pinKey(pin), summary: history ? cryptoWatchSummary(history, pin.asset as AssetId) : undefined };
        }
        const history = await readStockHistoryCache(stockDefinition(pin.asset as StockId).symbol).catch(() => null);
        return { key: pinKey(pin), summary: history ? stockWatchSummary(history) : undefined };
      }));
      if (!cancelled) setRows(current => Object.fromEntries(results.map(row => [row.key, { ...current[row.key], ...(row.summary ? { summary: row.summary } : {}) }])));
    };
    void read();
    return () => { cancelled = true; };
  }, [lab, pins, ready, revision]);
  const check = async () => {
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setBusy(true); setNotice("Checking pinned assets once. No automatic polling.");
    let failures = 0;
    for (const pin of pins) {
      if (abort.signal.aborted) return;
      const key = pinKey(pin);
      try {
        let summary: WatchSummary, quote: WatchQuote | undefined, status: string;
        if (lab === "crypto") {
          const result = await loadCryptoHistory(pin.asset as AssetId, pin.source as SourceId, authenticatedFetch, abort.signal);
          summary = cryptoWatchSummary(result.history, pin.asset as AssetId); status = result.status;
          quote = await requestJson<WatchQuote>(authenticatedFetch, `/api/v1/spot?${new URLSearchParams({ asset: pin.asset, source: pin.source })}`, { signal: abort.signal }, 12_000).catch(() => undefined);
        } else {
          const stock = stockDefinition(pin.asset as StockId);
          const result = await loadStockHistory(stock.symbol, authenticatedFetch, abort.signal);
          summary = stockWatchSummary(result.history); status = result.status;
          const fetched = await requestJson<StockQuote>(authenticatedFetch, `/api/v1/stocks/quote?symbol=${stock.symbol}`, { signal: abort.signal }, 12_000).catch(() => undefined);
          quote = fetched ? { price: fetched.price, retrievedAt: fetched.retrievedAt, denomination: "USD" } : undefined;
        }
        if (abort.signal.aborted) return;
        if (status === "failed") failures++;
        setRows(current => ({ ...current, [key]: { summary, quote, error: status === "failed" ? "Update failed; last snapshot" : undefined } }));
      } catch {
        if (abort.signal.aborted) return;
        failures++; setRows(current => ({ ...current, [key]: { ...current[key], error: "Update failed; retry available" } }));
      }
    }
    setBusy(false); setNotice(failures ? `${failures} update(s) failed; available snapshots are retained.` : "Watchlist check complete. See each row for candle freshness and quote age.");
  };
  const rowQuote = (pin: WatchPin) => {
    const saved = rows[pinKey(pin)]?.quote;
    return pinKey(pin) === pinKey(active) && activeQuote && (!saved || activeQuote.retrievedAt >= saved.retrievedAt) ? activeQuote : saved;
  };
  const distance = (pin: WatchPin) => { const row = rows[pinKey(pin)]?.summary, quote = rowQuote(pin); const price = quote?.price ?? row?.close; return row?.level != null && price ? Math.abs(row.level / price - 1) : Infinity; };
  const sorted = [...pins].sort((a, b) => sort === "distance" ? distance(a) - distance(b) : sort === "flip" ? (rows[pinKey(b)]?.summary?.lastFlip ?? 0) - (rows[pinKey(a)]?.summary?.lastFlip ?? 0) : 0);
  const pinned = pins.some(pin => pinKey(pin) === pinKey(active));
  const state = (value: WatchSummary["dailyState"] | undefined) => value === "bull" ? "Bullish" : value === "bear" ? "Bearish" : value === "neutral" ? "Neutral" : "Not ready";
  return <details className="watchlist-card" open><summary>KK watchlist · {lab === "crypto" ? "Crypto" : "Stocks"}<small>Saved on this browser · weekly reversal levels</small></summary>
    <div className="watchlist-controls"><button type="button" disabled={!ready || pinned || pins.length >= 12 || busy} onClick={() => setPins(current => [...current, active])}>{pinned ? "Current market pinned" : "Pin current market"}</button><button type="button" disabled={busy || !pins.length} onClick={check}>{busy ? "Checking watchlist…" : "Check watchlist"}</button>{busy && <button type="button" onClick={() => { controller.current?.abort(); setBusy(false); setNotice("Check stopped. Available snapshots retained."); }}>Stop</button>}<label>Sort<select value={sort} onChange={event => setSort(event.target.value)}><option value="pinned">Pinned order</option><option value="distance">Nearest reversal</option><option value="flip">Most recent flip</option></select></label></div>
    <p className="watchlist-note">Reads saved candle history on load. “Check watchlist” checks for new candles and fetches quotes once; it does not start a timer.</p>
    <div className="watchlist-table">{sorted.map(pin => {
      const key = pinKey(pin), row = rows[key], summary = row?.summary, quote = rowQuote(pin);
      const label = (lab === "crypto" ? ASSETS : STOCKS).find(item => item.id === pin.asset)!.symbol;
      const venue = lab === "crypto" ? marketDefinition(pin.asset as AssetId, pin.source as SourceId).label : "Yahoo";
      return <div className="watchlist-row" key={key}><button type="button" className="watchlist-open" onClick={() => onSelect(pin)}><strong>{label}</strong><small>{venue} · open KK weekly</small></button><span data-label="Daily" className={summary?.dailyState === "bull" ? "bull-text" : summary?.dailyState === "bear" ? "bear-text" : ""}>1D · {state(summary?.dailyState)}</span><span data-label="Weekly" className={summary?.weeklyState === "bull" ? "bull-text" : summary?.weeklyState === "bear" ? "bear-text" : ""}>1W · {state(summary?.weeklyState)}</span><span><b>{summary?.level != null ? `${summary.weeklyState === "bull" ? "Bear below" : "Bull above"} ${formatPrice(summary.level, summary.denomination)}` : "No reversal level"}</b><small>{Number.isFinite(distance(pin)) ? `${formatPct(distance(pin))} away · vs ${quote ? "quote" : "completed close"}` : "Insufficient or unloaded history"}</small></span><span><b>{formatPrice(quote?.price ?? summary?.close, quote?.denomination ?? summary?.denomination)}</b><small>{quote ? quoteAge(quote.retrievedAt, now) : `Completed close · ${formatDate(summary?.dailyLast)}`}</small></span><span><b>{summary ? historyIsCurrent(lab, summary.dailyLast, summary.weeklyLast, now) ? "Candles current" : "Snapshot behind" : "Not loaded"}</b><small>{row?.error ?? (summary?.lastFlip != null ? `Flip effective ${formatDate(signalTiming(summary.lastFlip, "1w", lab === "crypto" ? "crypto" : "equity")?.effectiveAt)}` : "No confirmed reversal")}</small>{summary?.dailyState && summary.weeklyState && summary.dailyState !== summary.weeklyState && <small className="bear-text">Daily / weekly disagree</small>}</span><button type="button" disabled={busy} aria-label={`Unpin ${label} ${venue}`} onClick={() => setPins(current => current.filter(item => pinKey(item) !== key))}>×</button></div>;
    })}</div>{!pins.length && <p>Choose an asset, then pin its market here.</p>}<p role="status">{notice}</p>
  </details>;
}
