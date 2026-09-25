"use client";

import { useMemo, useRef, useState } from "react";
import RegimeChart, { type ChartSelected, type Theme } from "./RegimeChart";
import { kk200CompanionOverlay } from "../lib/kk-200-overlay";
import { chartWindow, type PriceScale } from "../lib/chart-interaction";
import { formatDate } from "../lib/display";
import type { Candle, Timeframe } from "../lib/regimes";

export default function ChartExplorer({ candles, selected, denomination, timeframe, theme, dailyCandles, weeklyCandles }: { candles: Candle[]; selected: ChartSelected; denomination: string; timeframe: Timeframe; theme: Theme; dailyCandles?: Candle[]; weeklyCandles?: Candle[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(timeframe === "1w" ? 120 : 180);
  const [right, setRight] = useState<number | null>(null);
  const [range, setRange] = useState("Recent");
  const [scale, setScale] = useState<PriceScale>("linear");
  const [panMode, setPanMode] = useState(false);
  const [showBoth200, setShowBoth200] = useState(false);
  const [flipTime, setFlipTime] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const { start, end } = chartWindow(candles.length, size, right ?? candles.length);
  const view = useMemo(() => {
    const visible = candles.slice(start, end), times = new Set(visible.map(candle => candle.time));
    const companion = showBoth200 && selected.id === "kk_200_ma" && dailyCandles && weeklyCandles ? kk200CompanionOverlay(candles, dailyCandles, weeklyCandles, timeframe) : null;
    return { candles: visible, selected: { ...selected, states: selected.states.slice(start, end),
      bullTrigger: end === candles.length ? selected.bullTrigger : null, bearTrigger: end === candles.length ? selected.bearTrigger : null,
      overlays: [...selected.overlays, ...(companion ? [companion] : [])].map(line => ({ ...line, points: line.points.filter(point => times.has(point.time)) })),
      ribbons: selected.ribbons.map(ribbon => ({ ...ribbon, points: ribbon.points.filter(point => times.has(point.time)) })),
      events: selected.events.filter(event => times.has(event.time)), barColors: selected.barColors.filter(point => times.has(point.time)), flips: selected.flips.filter(flip => times.has(flip.time)),
    } };
  }, [candles, selected, start, end, showBoth200, dailyCandles, weeklyCandles, timeframe]);
  const selectRange = (label: string, days?: number) => {
    if (!candles.length) return;
    const cutoff = candles.at(-1)!.time - (days ?? 0) * 86_400_000;
    setSize(days ? candles.filter(candle => candle.time >= cutoff).length : candles.length);
    setRight(null); setRange(label); setFlipTime(null);
  };
  const pan = (bars: number) => { setRight(chartWindow(candles.length, size, end + bars).end); setRange("Custom"); };
  const zoom = (factor: number) => { setSize(Math.min(candles.length, Math.max(Math.min(10, candles.length), Math.round((end - start) * factor)))); setRange("Custom"); };
  const events = selected.flips.length ? selected.flips : selected.events;
  const anchor = flipTime ?? (candles[end - 1]?.time ?? 0) + 1;
  const previousFlip = events.filter(event => event.time < anchor).at(-1);
  const nextFlip = events.find(event => event.time > anchor);
  const jump = (time: number) => {
    const index = candles.findIndex(candle => candle.time === time);
    setRight(chartWindow(candles.length, size, index + Math.ceil(size / 2)).end);
    setFlipTime(time); setRange("Custom");
  };
  const fullscreen = async () => {
    try { if (document.fullscreenElement === container.current) await document.exitFullscreen(); else await container.current?.requestFullscreen(); }
    catch { setMessage("Fullscreen is unavailable in this browser. Use the chart range and zoom controls instead."); }
  };
  return <div className="chart-explorer" ref={container}>
    <div className="chart-toolbar" aria-label="Chart view controls">
      <div className="chart-range">{([["6M", 183], ["1Y", 365], ["3Y", 1096], ["All", undefined]] as const).map(([label, days]) => <button type="button" key={label} aria-pressed={range === label} onClick={() => selectRange(label, days)}>{label}</button>)}</div>
      <button type="button" onClick={() => zoom(.5)} disabled={end - start <= Math.min(10, candles.length)} aria-label="Zoom in">＋</button>
      <button type="button" onClick={() => zoom(2)} disabled={end - start >= candles.length} aria-label="Zoom out">−</button>
      <button type="button" onClick={() => setScale(scale === "log" ? "linear" : "log")} aria-pressed={scale === "log"}>Log scale</button>
      {selected.id === "kk_200_ma" && <button type="button" onClick={() => setShowBoth200(value => !value)} aria-pressed={showBoth200} disabled={!dailyCandles || !weeklyCandles}>Show both averages</button>}
      <button type="button" onClick={() => setPanMode(!panMode)} aria-pressed={panMode}>Drag to pan</button>
      <button type="button" onClick={fullscreen}>Fullscreen</button>
    </div>
    <RegimeChart {...view} denomination={denomination} timeframe={timeframe} theme={theme} scale={scale} onPan={pan} panMode={panMode} />
    {selected.id === "kk_200_ma" && <p className="chart-range-caption kk-200-meaning"><span className="kk-200-blue">Blue range</span> = close above the {timeframe === "1d" ? "200-day" : "200-week"} SMA; <span className="kk-200-orange">orange range</span> = close below it. {showBoth200 ? view.selected.overlays.some(line => line.name === (timeframe === "1d" ? "200-week SMA" : "200-day SMA") && line.points.length) ? `The ${timeframe === "1d" ? "200-week" : "200-day"} line is context; the signal still uses the selected timeframe.` : `The other line needs 200 completed ${timeframe === "1d" ? "weeks" : "daily candles"} of history in this view.` : "Show both averages to add the other line."}</p>}
    <div className="chart-navigation">
      <button type="button" disabled={!previousFlip} onClick={() => previousFlip && jump(previousFlip.time)}>← Previous flip</button>
      <button type="button" disabled={!nextFlip} onClick={() => nextFlip && jump(nextFlip.time)}>Next flip →</button>
      <button type="button" onClick={() => { setRight(null); setFlipTime(null); }}>Latest</button>
      <label>Pan history<input aria-label="Pan through historical candles" type="range" min={Math.min(size, candles.length)} max={candles.length} value={end} onChange={event => { setRight(Number(event.target.value)); setRange("Custom"); setFlipTime(null); }} /></label>
    </div>
    <p className="chart-range-caption">{formatDate(view.candles[0]?.time)} – {formatDate(view.candles.at(-1)?.time)} · {end - start} of {candles.length.toLocaleString()} candles{flipTime != null ? ` · flip candle: ${formatDate(flipTime)}` : ""}{end < candles.length ? " · current triggers hidden in historical view" : ""}{scale === "log" ? " · non-positive levels omitted" : ""}</p>
    {message && <p role="status">{message}</p>}
  </div>;
}
