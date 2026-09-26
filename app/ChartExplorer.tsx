"use client";

import { useMemo, useRef, useState } from "react";
import RegimeChart, { type ChartSelected, type Theme } from "./RegimeChart";
import { kk200CompanionOverlay, kk200WeeklyCombinedRange } from "../lib/kk-200-overlay";
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
  const [showBoth200, setShowBoth200] = useState(timeframe === "1w");
  const canShowBoth200 = (dailyCandles?.length ?? 0) >= 200 && (weeklyCandles?.length ?? 0) >= 200;
  const [flipTime, setFlipTime] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const { start, end } = chartWindow(candles.length, size, right ?? candles.length);
  const view = useMemo(() => {
    const visible = candles.slice(start, end), times = new Set(visible.map(candle => candle.time));
    const combinedWeekly = showBoth200 && canShowBoth200 && selected.id === "kk_200_ma" && timeframe === "1w" && dailyCandles
      ? kk200WeeklyCombinedRange(candles, dailyCandles) : null;
    const companion = showBoth200 && canShowBoth200 && selected.id === "kk_200_ma" && dailyCandles && weeklyCandles
      ? combinedWeekly?.dailyLine ?? kk200CompanionOverlay(candles, dailyCandles, weeklyCandles, timeframe) : null;
    const chartFlips = combinedWeekly?.flips ?? selected.flips;
    return { candles: visible, navigationEvents: chartFlips.length ? chartFlips : selected.events, selected: { ...selected,
      states: (combinedWeekly?.states ?? selected.states).slice(start, end),
      bullTrigger: end === candles.length ? selected.bullTrigger : null, bearTrigger: end === candles.length ? selected.bearTrigger : null,
      overlays: [...selected.overlays, ...(companion ? [companion] : [])].map(line => ({ ...line, points: line.points.filter(point => times.has(point.time)) })),
      ribbons: (combinedWeekly ? [combinedWeekly.ribbon] : selected.ribbons).map(ribbon => ({ ...ribbon, points: ribbon.points.filter(point => times.has(point.time)) })),
      events: selected.events.filter(event => times.has(event.time)), barColors: selected.barColors.filter(point => times.has(point.time)), flips: chartFlips.filter(flip => times.has(flip.time)),
    } };
  }, [candles, selected, start, end, showBoth200, dailyCandles, weeklyCandles, timeframe, canShowBoth200]);
  const selectRange = (label: string, days?: number) => {
    if (!candles.length) return;
    const cutoff = candles.at(-1)!.time - (days ?? 0) * 86_400_000;
    setSize(days ? candles.filter(candle => candle.time >= cutoff).length : candles.length);
    setRight(null); setRange(label); setFlipTime(null);
  };
  const pan = (bars: number) => { setRight(chartWindow(candles.length, size, end + bars).end); setRange("Custom"); };
  const zoom = (factor: number) => { setSize(Math.min(candles.length, Math.max(Math.min(10, candles.length), Math.round((end - start) * factor)))); setRange("Custom"); };
  const events = view.navigationEvents;
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
      {selected.id === "kk_200_ma" && <button type="button" onClick={() => setShowBoth200(value => !value)} aria-pressed={showBoth200} disabled={!canShowBoth200}>Show both averages</button>}
      <button type="button" onClick={() => setPanMode(!panMode)} aria-pressed={panMode}>Drag to pan</button>
      <button type="button" onClick={fullscreen}>Fullscreen</button>
    </div>
    <RegimeChart {...view} denomination={denomination} timeframe={timeframe} theme={theme} scale={scale} onPan={pan} panMode={panMode} />
    {selected.id === "kk_200_ma" && <p className="chart-range-caption kk-200-meaning"><span className="kk-200-blue">Blue range</span> = completed {timeframe === "1w" ? "weekly" : "daily"} close above the {timeframe === "1w" && !view.selected.ribbons.some(ribbon => ribbon.name === "Weekly close to 200-day SMA") ? "200-week" : "200-day"} SMA; <span className="kk-200-orange">orange range</span> = below it. {timeframe === "1w" && view.selected.ribbons.some(ribbon => ribbon.name === "Weekly close to 200-day SMA") ? "The red 200-day line drives the colored range; the blue 200-week line and status card show the slower weekly baseline." : !canShowBoth200 ? "Both averages require 200 completed daily and weekly candles." : showBoth200 ? "The other average is context; the selected-timeframe signal is unchanged." : "Show both averages to compare both lines."} The reference screenshot uses a live monthly candle, so its newest color can precede a completed-candle signal here.</p>}
    {selected.id === "kk_50_200_ema" && <p className="chart-range-caption">Blue: 50-{timeframe === "1w" ? "week" : "day"} EMA · Orange: 200-{timeframe === "1w" ? "week" : "day"} EMA. Bullish if and only if the completed {timeframe === "1w" ? "weekly" : "daily"} close is strictly above both. Between or touching: neutral; below both: bearish.</p>}
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
