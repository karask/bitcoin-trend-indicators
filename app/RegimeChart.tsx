"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { nearestCandleIndex, periodLabel, priceAtY, type Theme } from "../lib/chart-interaction";

type State = "bull" | "bear" | "neutral";
type Timeframe = "1d" | "1w";
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type ChartSelected = {
  id: string;
  displayName: string;
  thresholdKind: "fixed" | "provisional" | "conditional";
  bullTrigger: number | null;
  bearTrigger: number | null;
  states: Array<State | null>;
  overlays: Array<{ name: string; legendLabel?: string; color: string; dashed?: boolean; width?: number; pointStyle?: "line" | "circles"; showInLegend?: boolean; points: Array<{ time: number; value: number; color?: string }> }>;
  ribbons: Array<{ id: string; name: string; palette: Record<State, string>; fillOpacity: number; showInLegend?: boolean; points: Array<{ time: number; upper: number; lower: number; state: State }> }>;
  events: Array<{ time: number; kind: "swing" | "trend_break"; direction: "bull" | "bear"; label: string; price: number; color: string }>;
  barColors: Array<{ time: number; color: string }>;
  flips: Array<{ time: number; from: State; to: State; close: number }>;
};
type Geometry = { width: number; height: number; ratio: number; left: number; top: number; plotWidth: number; plotHeight: number; minimum: number; maximum: number };
type Selection = { index: number; pinned: boolean; pointerY?: number; alignRight: boolean };

const COLOR_VARIABLES: Record<string, string> = {
  "#d7a928": "--chart-gold", "#ffd700": "--chart-gold", "#264f66": "--chart-blue",
  "#8769c3": "--chart-violet", "#8065b6": "--chart-violet", "#66716c": "--chart-neutral",
  "#6d756f": "--chart-neutral", "#919896": "--chart-neutral", "#808080": "--chart-neutral", "#c0c0c0": "--chart-neutral",
  "#00ffff": "--chart-guppy-aqua", "#0000ff": "--chart-guppy-blue", "#00ff00": "--chart-guppy-lime",
  "#ff0000": "--chart-guppy-red", "#ff00ff": "--chart-magenta", "#111111": "--chart-inkline",
  "#0b8a61": "--chart-up", "#0f8a61": "--chart-up", "#c95545": "--chart-down",
};

function colorVariable(color: string) {
  return COLOR_VARIABLES[color.trim().toLowerCase()];
}

export function chartColorCss(color: string) {
  const variable = colorVariable(color);
  return variable ? `var(${variable})` : color;
}

const formatPrice = (value: number | null | undefined, denomination = "USD") => {
  if (value == null || !Number.isFinite(value)) return "—";
  const maximumFractionDigits = value >= 1_000 ? 0 : value >= 10 ? 2 : 4;
  return denomination === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits }).format(value)
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value)} USDT`;
};

const stateLabel = (state: State | null) => state === "bull" ? "Bullish" : state === "bear" ? "Bearish" : state === "neutral" ? "Neutral" : "Unavailable";

export default function RegimeChart({ candles, selected, denomination, timeframe, theme }: { candles: Candle[]; selected: ChartSelected; denomination: string; timeframe: Timeframe; theme: Theme }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const touchingRef = useRef(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSelection(null));
    return () => window.cancelAnimationFrame(frame);
  }, [candles, selected.id]);

  useEffect(() => {
    const frame = frameRef.current, canvas = baseRef.current, interactionCanvas = overlayRef.current;
    if (!frame || !canvas || !interactionCanvas || !candles.length) return;
    const render = () => {
      const bounds = frame.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = bounds.width, height = bounds.height;
      for (const layer of [canvas, interactionCanvas]) {
        layer.width = Math.max(1, Math.round(width * ratio));
        layer.height = Math.max(1, Math.round(height * ratio));
      }
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const styles = getComputedStyle(frame);
      const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      const resolveColor = (color: string) => {
        const variable = colorVariable(color);
        return variable ? css(variable, color) : color;
      };
      const pad = { t: 18, r: 76, b: 32, l: 12 }, plotWidth = width - pad.l - pad.r, plotHeight = height - pad.t - pad.b;
      const values = candles.flatMap(candle => [candle.high, candle.low]);
      for (const overlay of selected.overlays) for (const point of overlay.points) values.push(point.value);
      for (const ribbon of selected.ribbons) for (const point of ribbon.points) values.push(point.upper, point.lower);
      if (selected.bullTrigger != null) values.push(selected.bullTrigger);
      if (selected.bearTrigger != null) values.push(selected.bearTrigger);
      let minimum = Math.min(...values), maximum = Math.max(...values);
      const margin = Math.max(1, (maximum - minimum) * 0.09); minimum -= margin; maximum += margin;
      geometryRef.current = { width, height, ratio, left: pad.l, top: pad.t, plotWidth, plotHeight, minimum, maximum };
      const x = (index: number) => pad.l + (index + 0.5) * plotWidth / candles.length;
      const y = (value: number) => pad.t + (maximum - value) / (maximum - minimum) * plotHeight;

      ctx.clearRect(0, 0, width, height); ctx.fillStyle = css("--chart-bg", "#fffefa"); ctx.fillRect(0, 0, width, height);
      for (let index = 0; index < candles.length; index++) {
        const state = selected.states[index]; if (!state) continue;
        ctx.fillStyle = css(state === "bull" ? "--chart-state-bull" : state === "bear" ? "--chart-state-bear" : "--chart-state-neutral", "transparent");
        ctx.fillRect(pad.l + index * plotWidth / candles.length, pad.t, plotWidth / candles.length + 1, plotHeight);
      }
      ctx.strokeStyle = css("--chart-grid", "#e8ebe5"); ctx.lineWidth = 1; ctx.font = "10px ui-monospace, monospace"; ctx.fillStyle = css("--chart-axis", "#83908a"); ctx.textAlign = "left";
      for (let index = 0; index <= 4; index++) {
        const yy = pad.t + index * plotHeight / 4; ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(width - pad.r, yy); ctx.stroke();
        ctx.fillText(formatPrice(maximum - index * (maximum - minimum) / 4, denomination), width - pad.r + 8, yy + 3);
      }
      const indexByTime = new Map(candles.map((candle, index) => [candle.time, index]));
      for (const ribbon of selected.ribbons) {
        const byTime = new Map(ribbon.points.map(point => [point.time, point]));
        ctx.save(); ctx.globalAlpha = ribbon.fillOpacity;
        candles.forEach((candle, index) => {
          const point = byTime.get(candle.time); if (!point) return;
          const next = index + 1 < candles.length ? byTime.get(candles[index + 1].time) : undefined;
          const nextUpper = next?.state === point.state ? next.upper : point.upper, nextLower = next?.state === point.state ? next.lower : point.lower;
          const left = pad.l + index * plotWidth / candles.length, right = pad.l + (index + 1) * plotWidth / candles.length;
          ctx.fillStyle = resolveColor(ribbon.palette[point.state]); ctx.beginPath(); ctx.moveTo(left, y(point.upper)); ctx.lineTo(right, y(nextUpper)); ctx.lineTo(right, y(nextLower)); ctx.lineTo(left, y(point.lower)); ctx.closePath(); ctx.fill();
        });
        ctx.restore();
      }
      const candleWidth = Math.max(2, Math.min(8, plotWidth / candles.length * 0.58));
      const barColorByTime = new Map(selected.barColors.map(point => [point.time, point.color]));
      candles.forEach((candle, index) => {
        const up = candle.close >= candle.open, color = resolveColor(barColorByTime.get(candle.time) ?? (up ? "#0f8a61" : "#c95545"));
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x(index), y(candle.high)); ctx.lineTo(x(index), y(candle.low)); ctx.stroke();
        const top = y(Math.max(candle.open, candle.close)), bottom = y(Math.min(candle.open, candle.close)); ctx.fillRect(x(index) - candleWidth / 2, top, candleWidth, Math.max(1.5, bottom - top));
      });
      for (const overlay of selected.overlays) {
        const byTime = new Map(overlay.points.map(point => [point.time, point])); ctx.lineWidth = overlay.width ?? 1.7; ctx.setLineDash(overlay.dashed ? [5, 4] : []);
        if (overlay.pointStyle === "circles") {
          ctx.fillStyle = resolveColor(overlay.color);
          candles.forEach((candle, index) => { const point = byTime.get(candle.time); if (!point) return; ctx.beginPath(); ctx.arc(x(index), y(point.value), 1.6, 0, Math.PI * 2); ctx.fill(); });
          ctx.setLineDash([]); continue;
        }
        let prior: { index: number; point: { value: number; color?: string } } | null = null;
        candles.forEach((candle, index) => {
          const point = byTime.get(candle.time); if (!point) { prior = null; return; }
          if (prior) { ctx.strokeStyle = resolveColor(point.color ?? overlay.color); ctx.beginPath(); ctx.moveTo(x(prior.index), y(prior.point.value)); ctx.lineTo(x(index), y(point.value)); ctx.stroke(); }
          prior = { index, point };
        });
        ctx.setLineDash([]);
      }
      const drawTrigger = (value: number | null, rawColor: string, label: string) => {
        if (value == null) return; const yy = y(value), color = resolveColor(rawColor);
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(width - pad.r, yy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = css("--chart-bg", "#fffefa"); ctx.fillRect(Math.max(pad.l, width - pad.r - 178), yy - 10, 178, 18); ctx.fillStyle = color; ctx.font = "700 9px ui-monospace, monospace"; ctx.textAlign = "right"; ctx.fillText(`${label} · ${formatPrice(value, denomination)}`, width - pad.r - 4, yy + 3);
      };
      if (selected.bullTrigger === selected.bearTrigger) drawTrigger(selected.bullTrigger, "#6d756f", selected.thresholdKind.toUpperCase());
      else { drawTrigger(selected.bullTrigger, "#0f8a61", `BULL · ${selected.thresholdKind}`); drawTrigger(selected.bearTrigger, "#c95545", `BEAR · ${selected.thresholdKind}`); }
      for (const flip of selected.flips) {
        const index = indexByTime.get(flip.time); if (index == null) continue;
        const yy = flip.to === "bull" ? y(candles[index].low) + 13 : y(candles[index].high) - 13;
        ctx.fillStyle = resolveColor(flip.to === "bull" ? "#0f8a61" : flip.to === "bear" ? "#c95545" : "#d7a928"); ctx.beginPath();
        if (flip.to === "bull") { ctx.moveTo(x(index), yy - 7); ctx.lineTo(x(index) - 5, yy); ctx.lineTo(x(index) + 5, yy); }
        else { ctx.moveTo(x(index), yy + 7); ctx.lineTo(x(index) - 5, yy); ctx.lineTo(x(index) + 5, yy); }
        ctx.closePath(); ctx.fill();
      }
      for (const event of selected.events) {
        const index = indexByTime.get(event.time); if (index == null) continue;
        const yy = event.direction === "bull" ? y(candles[index].low) + (event.kind === "swing" ? 18 : 29) : y(candles[index].high) - (event.kind === "swing" ? 18 : 29);
        ctx.fillStyle = resolveColor(event.color); ctx.strokeStyle = css("--chart-event-stroke", "#fffefa"); ctx.lineWidth = 1.2; ctx.beginPath();
        if (event.direction === "bull") { ctx.moveTo(x(index), yy - 8); ctx.lineTo(x(index) - 6, yy + 1); ctx.lineTo(x(index) - 2, yy + 1); ctx.lineTo(x(index) - 2, yy + 7); ctx.lineTo(x(index) + 2, yy + 7); ctx.lineTo(x(index) + 2, yy + 1); ctx.lineTo(x(index) + 6, yy + 1); }
        else { ctx.moveTo(x(index), yy + 8); ctx.lineTo(x(index) - 6, yy - 1); ctx.lineTo(x(index) - 2, yy - 1); ctx.lineTo(x(index) - 2, yy - 7); ctx.lineTo(x(index) + 2, yy - 7); ctx.lineTo(x(index) + 2, yy - 1); ctx.lineTo(x(index) + 6, yy - 1); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = css("--chart-axis", "#83908a"); ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
      const dateIndexes = new Set([0, Math.floor((candles.length - 1) / 3), Math.floor(2 * (candles.length - 1) / 3), candles.length - 1]);
      dateIndexes.forEach(index => ctx.fillText(new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(candles[index].time), x(index), height - 9));
      setRenderVersion(version => version + 1);
    };
    render(); const observer = new ResizeObserver(render); observer.observe(frame); return () => observer.disconnect();
  }, [candles, selected, denomination, theme]);

  useEffect(() => {
    const canvas = overlayRef.current, frame = frameRef.current, geometry = geometryRef.current;
    if (!canvas || !frame || !geometry) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.setTransform(geometry.ratio, 0, 0, geometry.ratio, 0, 0); ctx.clearRect(0, 0, geometry.width, geometry.height);
    if (!selection || !candles[selection.index]) return;
    const styles = getComputedStyle(frame), css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const x = geometry.left + (selection.index + 0.5) * geometry.plotWidth / candles.length;
    const yForPrice = (value: number) => geometry.top + (geometry.maximum - value) / (geometry.maximum - geometry.minimum) * geometry.plotHeight;
    const rawY = selection.pointerY ?? yForPrice(candles[selection.index].close);
    const y = Math.max(geometry.top, Math.min(geometry.top + geometry.plotHeight, rawY));
    ctx.strokeStyle = css("--chart-crosshair", "#52625b"); ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, geometry.top); ctx.lineTo(x, geometry.top + geometry.plotHeight); ctx.moveTo(geometry.left, y); ctx.lineTo(geometry.left + geometry.plotWidth, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--chart-crosshair", "#52625b"); ctx.beginPath(); ctx.arc(x, yForPrice(candles[selection.index].close), 3.2, 0, Math.PI * 2); ctx.fill();
    const price = priceAtY(y, geometry.top, geometry.plotHeight, geometry.minimum, geometry.maximum);
    const priceText = formatPrice(price, denomination); ctx.font = "700 9px ui-monospace, monospace"; const priceWidth = Math.min(72, Math.max(46, ctx.measureText(priceText).width + 10));
    ctx.fillStyle = css("--chart-crosshair-tag", "#34433d"); ctx.fillRect(geometry.width - priceWidth, y - 9, priceWidth, 18); ctx.fillStyle = css("--chart-crosshair-tag-text", "#ffffff"); ctx.textAlign = "center"; ctx.fillText(priceText, geometry.width - priceWidth / 2, y + 3);
    const dateText = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(candles[selection.index].time);
    const dateWidth = ctx.measureText(dateText).width + 14, dateX = Math.max(geometry.left, Math.min(geometry.left + geometry.plotWidth - dateWidth, x - dateWidth / 2));
    ctx.fillStyle = css("--chart-crosshair-tag", "#34433d"); ctx.fillRect(dateX, geometry.height - 24, dateWidth, 18); ctx.fillStyle = css("--chart-crosshair-tag-text", "#ffffff"); ctx.fillText(dateText, dateX + dateWidth / 2, geometry.height - 12);
  }, [candles, denomination, renderVersion, selection, theme]);

  const inspected = selection ? candles[selection.index] : null;
  const tooltip = useMemo(() => {
    if (!selection || !inspected) return null;
    const prior = candles[selection.index - 1], change = prior ? inspected.close / prior.close - 1 : null;
    const overlays = selected.overlays.filter(line => line.showInLegend !== false).flatMap(line => {
      const point = line.points.find(item => item.time === inspected.time);
      return point ? [{ label: line.legendLabel ?? line.name, value: formatPrice(point.value, denomination) }] : [];
    });
    const ribbons = selected.ribbons.filter(ribbon => selected.id === "super_guppy" || ribbon.showInLegend !== false).flatMap(ribbon => {
      const point = ribbon.points.find(item => item.time === inspected.time);
      return point ? [{ label: ribbon.name, value: `${formatPrice(point.lower, denomination)} – ${formatPrice(point.upper, denomination)}` }] : [];
    });
    const events = selected.events.filter(event => event.time === inspected.time).map(event => event.label);
    const flip = selected.flips.find(item => item.time === inspected.time);
    return { prior, change, overlays, ribbons, events, flip };
  }, [candles, denomination, inspected, selected, selection]);

  const selectFromPointer = (event: PointerEvent<HTMLCanvasElement>, pinned: boolean) => {
    const geometry = geometryRef.current, canvas = overlayRef.current; if (!geometry || !canvas) return;
    const bounds = canvas.getBoundingClientRect(), pointerX = event.clientX - bounds.left, pointerY = event.clientY - bounds.top;
    const index = nearestCandleIndex(pointerX, geometry.left, geometry.plotWidth, candles.length); if (index < 0) return;
    setSelection({ index, pinned, pointerY, alignRight: pointerX > geometry.width * .57 });
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch") { if (touchingRef.current) selectFromPointer(event, true); return; }
    if (!selection?.pinned) selectFromPointer(event, false);
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    overlayRef.current?.focus();
    if (event.pointerType === "touch") { touchingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
    selectFromPointer(event, true);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    let index = selection?.index;
    if (event.key === "Escape") { setSelection(null); event.preventDefault(); return; }
    if (event.key === "Enter" && index != null) { setSelection(current => current ? { ...current, pinned: !current.pinned } : current); event.preventDefault(); return; }
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = candles.length - 1;
    else if (event.key === "ArrowLeft") index = index == null ? candles.length - 1 : Math.max(0, index - 1);
    else if (event.key === "ArrowRight") index = index == null ? 0 : Math.min(candles.length - 1, index + 1);
    else return;
    setSelection({ index, pinned: selection?.pinned ?? false, alignRight: index / Math.max(1, candles.length - 1) > .57 }); event.preventDefault();
  };

  return <div ref={frameRef} className="chart-interactive">
    <canvas ref={baseRef} className="regime-canvas chart-base" role="img" aria-label={`${selected.displayName} candlestick chart with confirmed regime shading, overlays, and signal markers`} />
    <canvas ref={overlayRef} className="regime-canvas chart-overlay" tabIndex={0} role="slider" aria-valuemin={0} aria-valuemax={Math.max(0, candles.length - 1)} aria-valuenow={selection?.index ?? candles.length - 1} aria-valuetext={selection && inspected ? `${periodLabel(inspected.time, timeframe)}, close ${formatPrice(inspected.close, denomination)}, ${stateLabel(selected.states[selection.index])}` : "No candle selected"} aria-label={`Interactive ${selected.displayName} chart. Use left and right arrow keys to inspect candles, Home and End to jump, Enter to pin, and Escape to clear.`}
      onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={() => { touchingRef.current = false; }} onPointerCancel={() => { touchingRef.current = false; }} onPointerLeave={() => { if (!selection?.pinned) setSelection(null); }} onKeyDown={onKeyDown} />
    {!selection && <span className="chart-interaction-hint">Hover, tap, or focus to inspect</span>}
    {selection && inspected && tooltip && <aside className={`chart-tooltip ${selection.alignRight ? "align-right" : ""}`} aria-hidden="true">
      <div className="chart-tooltip-heading"><strong>{periodLabel(inspected.time, timeframe)}</strong>{selection.pinned && <span>PINNED</span>}</div>
      <div className="chart-tooltip-ohlc"><span>O <b>{formatPrice(inspected.open, denomination)}</b></span><span>H <b>{formatPrice(inspected.high, denomination)}</b></span><span>L <b>{formatPrice(inspected.low, denomination)}</b></span><span>C <b>{formatPrice(inspected.close, denomination)}</b></span></div>
      <div className="chart-tooltip-summary"><span className={`tooltip-state ${selected.states[selection.index] ?? "unavailable"}`}>{stateLabel(selected.states[selection.index])}</span><b className={tooltip.change != null && tooltip.change < 0 ? "negative" : ""}>{tooltip.change == null ? "—" : `${tooltip.change > 0 ? "+" : ""}${(tooltip.change * 100).toFixed(2)}%`}</b></div>
      {(tooltip.overlays.length > 0 || tooltip.ribbons.length > 0) && <dl>{[...tooltip.overlays, ...tooltip.ribbons].map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
      {(tooltip.flip || tooltip.events.length > 0) && <div className="chart-tooltip-events">{tooltip.flip && <span>Confirmed flip: {stateLabel(tooltip.flip.from)} → {stateLabel(tooltip.flip.to)}</span>}{tooltip.events.map(event => <span key={event}>{event}</span>)}</div>}
    </aside>}
    <span className="sr-only" aria-live="polite">{selection && inspected ? `${periodLabel(inspected.time, timeframe)}. Close ${formatPrice(inspected.close, denomination)}. ${stateLabel(selected.states[selection.index])}.` : ""}</span>
  </div>;
}

export type { Theme };
