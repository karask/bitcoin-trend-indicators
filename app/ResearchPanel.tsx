"use client";

import { useState } from "react";
import { formatDate, formatPct, formatPrice } from "../lib/display";
import type { EquityPoint } from "../lib/regimes";
import type { Research } from "../lib/research";

function PerformanceChart({ strategy, benchmark }: { strategy: EquityPoint[]; benchmark: EquityPoint[] }) {
  const max = Math.max(1, ...strategy.map(point => point.equity), ...benchmark.map(point => point.equity));
  const low = Math.min(-.01, ...strategy.map(point => point.drawdown), ...benchmark.map(point => point.drawdown));
  const x = (index: number) => 48 + index / Math.max(1, strategy.length - 1) * 804;
  const line = (points: EquityPoint[], drawdown = false) => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${(drawdown ? 225 + point.drawdown / low * 95 : 190 - point.equity / max * 165).toFixed(1)}`).join(" ");
  return <figure className="performance-chart"><svg viewBox="0 0 900 352" role="img" aria-label="Strategy and buy-and-hold growth of one dollar, followed by drawdown. Both use the same dates and 15 basis point turnover costs.">
    <text x="48" y="16">Growth of $1</text><text x="48" y="218">Drawdown</text>
    <path d="M48,190H852 M48,225H852 M48,320H852" className="performance-grid" />
    <text x="5" y="31">{max.toFixed(1)}×</text><text x="6" y="230">0%</text><text x="2" y="323">{formatPct(low)}</text>
    <path d={line(benchmark)} className="benchmark-line" /><path d={line(strategy)} className="strategy-line" />
    <path d={line(benchmark, true)} className="benchmark-line" /><path d={line(strategy, true)} className="strategy-line" />
    <text x="48" y="348">{formatDate(strategy[0]?.time)}</text><text x="852" y="348" textAnchor="end">{formatDate(strategy.at(-1)?.time)}</text>
  </svg><figcaption><span className="bull-text">━ Selected strategy</span><span>┄ Buy and hold</span><span>Open-to-open valuation · costs included · no forced final sale</span></figcaption></figure>;
}

export default function ResearchPanel({ research, selectedName, denomination = "USD" }: { research: Research; selectedName: string; denomination?: string }) {
  const [showAllTrades, setShowAllTrades] = useState(false);
  const { detail, benchmark } = research;
  const trades = detail?.executions ?? [];
  const rollingCagr = research.rolling.map(row => row.result.cagr).sort((a, b) => a - b);
  const middle = Math.floor(rollingCagr.length / 2);
  const median = rollingCagr.length ? (rollingCagr[middle] + rollingCagr[Math.floor((rollingCagr.length - 1) / 2)]) / 2 : null;
  return <section className="research-grid" aria-label="Matched-window research">
    <article className="research-card wide"><div className="section-heading"><div><p className="eyebrow">NEXT-OPEN BACKTEST · COMMON DATES</p><h2>Compare like with like</h2></div><span className="assumption-pill">{research.periodsPerYear} periods/year · 15 bps</span></div>
      <p>{research.observations ? `${formatDate(research.start)} – ${formatDate(research.end)} · ${research.observations.toLocaleString()} open-to-open observations. All included models finish warmup before this window.` : "Insufficient history for a next-open backtest."}</p>
      <div className="backtest-table"><div className="backtest-head"><span>Model</span><span>CAGR</span><span>Max DD</span><span>Calmar</span><span>Exposure</span><span>Executions</span></div>{research.backtests.map(row => <div className={`backtest-row ${row.indicatorId === detail?.summary.indicatorId ? "selected" : ""}`} key={row.indicatorId}><strong>{row.displayName}</strong><span data-label="CAGR">{formatPct(row.cagr)}</span><span data-label="Max DD" className="negative">{formatPct(row.maxDrawdown)}</span><b data-label="Calmar">{row.calmar?.toFixed(2) ?? "—"}</b><span data-label="Exposure">{formatPct(row.exposure)}</span><span data-label="Executions">{row.flips}</span></div>)}</div>
      {!!research.excluded.length && <p>Not ranked: {research.excluded.join(", ")} — insufficient or discontinuous signal history.</p>}
      <p>Descriptive single-source results, not a performance forecast or a universal ranking. Changing the asset or timeframe can change the shared evaluation start.</p>
    </article>
    {!detail || !benchmark ? <article className="research-card wide"><h2>{selectedName}</h2><p>No allocation backtest: the selected indicator either has insufficient history or is supporting context, not a regime model.</p></article> : <>
      <article className="research-card"><p className="eyebrow">COST SENSITIVITY · {selectedName.toUpperCase()}</p><h2>5 / 15 / 30 bps turnover</h2><dl>{research.sensitivity.map(row => <div key={row.costBps}><dt>{row.costBps} bps</dt><dd>{formatPct(row.result?.cagr)} CAGR · {row.result?.calmar?.toFixed(2) ?? "—"} Calmar</dd></div>)}</dl><p>0.05% / 0.15% / 0.30% per unit of exposure changed. Every test starts in cash and charges its initial entry. Bull: 100%; neutral: 50%; bear: 0%. No cash yield, shorts, or leverage.</p></article>
      <article className="research-card"><p className="eyebrow">BUY-AND-HOLD COMPARISON · SAME DATES</p><h2>{selectedName} vs holding</h2><dl><div><dt>Strategy / holding CAGR</dt><dd>{formatPct(detail.summary.cagr)} / {formatPct(benchmark.summary.cagr)}</dd></div><div><dt>Strategy / holding max DD</dt><dd>{formatPct(detail.summary.maxDrawdown)} / {formatPct(benchmark.summary.maxDrawdown)}</dd></div><div><dt>Strategy / holding total return</dt><dd>{formatPct(detail.summary.totalReturn)} / {formatPct(benchmark.summary.totalReturn)}</dd></div></dl><p>Identical next-open measurement window, price basis, annualization, and 15-bps cost model.</p></article>
      <article className="research-card wide"><h2>Growth and drawdown</h2><PerformanceChart strategy={detail.curve} benchmark={benchmark.curve} /></article>
      <article className="research-card wide"><details className="execution-details"><summary>Execution ledger · {trades.length} position changes</summary><p>Signal candle is the candle whose close confirmed the state. Execution is the following candle&apos;s open, never that signal&apos;s historical close. Costs are a percentage of the portfolio.</p><div className="execution-table"><div className="execution-head"><span>Signal candle</span><span>Execution open</span><span>Price</span><span>Exposure</span><span>Cost</span></div>{(showAllTrades ? trades : trades.slice(-20)).map(trade => <div className="execution-row" key={trade.time}><span data-label="Signal candle">{formatDate(trade.signalTime)}</span><span data-label="Execution open">{formatDate(trade.time)}</span><span data-label="Price">{formatPrice(trade.price, denomination)}</span><span data-label="Exposure">{formatPct(trade.previousExposure)} → {formatPct(trade.exposure)}</span><span data-label="Cost">{(trade.cost * 100).toFixed(3)}%</span></div>)}</div>{!trades.length && <p>No exposure changes in this window.</p>}{trades.length > 20 && <button type="button" onClick={() => setShowAllTrades(!showAllTrades)}>{showAllTrades ? "Show latest 20" : `Show all ${trades.length} executions`}</button>}</details></article>
    </>}
    <article className="research-card wide"><p className="eyebrow">ROLLING FOUR-YEAR TESTS · ANNUAL STARTS</p><h2>{selectedName} through different windows</h2>{research.rolling.length ? <><p>Median CAGR {formatPct(median)} · {research.rolling.filter(row => row.result.totalReturn > 0).length}/{research.rolling.length} positive windows. Each window contains exactly {research.periodsPerYear * 4} returns after warmup; windows overlap and are not independent trials.</p><details><summary>View {research.rolling.length} windows and matched benchmarks</summary><div className="rolling-table"><div className="rolling-head"><span>Window</span><span>Strategy CAGR</span><span>Holding CAGR</span><span>Max DD</span></div>{research.rolling.map(row => <div className="rolling-row" key={row.start}><strong>{formatDate(row.start)} – {formatDate(row.end)}</strong><span data-label="Strategy CAGR">{formatPct(row.result.cagr)}</span><span data-label="Holding CAGR">{formatPct(row.benchmark.cagr)}</span><span data-label="Max DD">{formatPct(row.result.maxDrawdown)}</span></div>)}</div></details></> : <p>Insufficient history for a complete four-year allocation test after warmup, or the selected indicator is not a regime model. No shortened windows are presented as four-year results.</p>}</article>
  </section>;
}
