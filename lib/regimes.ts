export type RegimeState = "bull" | "bear" | "neutral";
export type ThresholdKind = "fixed" | "provisional" | "conditional";
export type IndicatorRole = "regime" | "confirmation" | "exit" | "valuation";
export type Timeframe = "1d" | "1w";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface IndicatorSpec {
  id: string;
  displayName: string;
  shortName: string;
  role: IndicatorRole;
  family: string;
  supportedTimeframes: Timeframe[];
  parameters: Record<string, number | string>;
  thresholdKind: ThresholdKind;
  description: string;
  disclaimer?: string;
  sourceUrl?: string;
}

export interface LinePoint { time: number; value: number }
export interface OverlaySeries { name: string; color: string; points: LinePoint[]; dashed?: boolean }

export interface SignalSnapshot {
  id: string;
  displayName: string;
  shortName: string;
  role: IndicatorRole;
  family: string;
  state: RegimeState;
  previousState: RegimeState;
  lastFlip: number | null;
  thresholdKind: ThresholdKind;
  bullTrigger: number | null;
  bearTrigger: number | null;
  triggerLabel: string;
  explanation: string;
  values: Record<string, number | null>;
  disclaimer?: string;
  overlays: OverlaySeries[];
  states: Array<RegimeState | null>;
}

export interface BacktestSummary {
  indicatorId: string;
  displayName: string;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  calmar: number | null;
  sharpe: number | null;
  sortino: number | null;
  volatility: number;
  exposure: number;
  turnover: number;
  flips: number;
  upsideCapture: number | null;
  downsideCapture: number | null;
  timeInState: Record<RegimeState, number>;
}

export const INDICATOR_SPECS: IndicatorSpec[] = [
  { id: "support_band", displayName: "20 SMA / 21 EMA Support Band", shortName: "Support Band", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { sma: 20, ema: 21 }, thresholdKind: "fixed", description: "Above both averages is bullish, below both is bearish, and between is neutral." },
  { id: "supertrend", displayName: "SuperTrend 10/3", shortName: "SuperTrend", role: "regime", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { atr: 10, factor: 3 }, thresholdKind: "provisional", description: "A transparent ATR trailing regime line with close-based reversals.", disclaimer: "A transparent alternative commonly compared with private one-line systems; not a MoneyLine clone.", sourceUrl: "https://www.tradingview.com/support/solutions/43000634738-supertrend/" },
  { id: "smma_ribbon", displayName: "SMMA Ribbon 15/19/25/29", shortName: "SMMA Ribbon", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { lengths: "15/19/25/29", source: "HL2" }, thresholdKind: "conditional", description: "Fully ordered averages are bullish or bearish; tangled averages are neutral.", disclaimer: "Community Larsson-style proxy only. The official Larsson Line formula is private." },
  { id: "super_guppy", displayName: "Super Guppy EMA 3–23 / 25–70", shortName: "Super Guppy", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { fast: "3–23 step 2", slow: "25–70 step 3", source: "Close", averages: 27 }, thresholdKind: "conditional", description: "All 27 close EMAs strictly ordered from shortest to longest are bullish; reverse ordering is bearish; every other configuration is neutral.", disclaimer: "Transparent fixed Super Guppy variant. Published scripts differ in their coloring, pullback, and alert rules.", sourceUrl: "https://www.tradingview.com/script/Lj6d7UxQ-Super-Guppy-R1-0-by-JustUncleL/" },
  { id: "long_sma", displayName: "Long SMA Filter", shortName: "Long SMA", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { daily: 200, weekly: 30 }, thresholdKind: "fixed", description: "Price above the long average is bullish; below is bearish." },
  { id: "donchian_20_10", displayName: "Donchian Close 20/10", shortName: "Donchian 20/10", role: "regime", family: "breakout", supportedTimeframes: ["1d", "1w"], parameters: { entry: 20, exit: 10 }, thresholdKind: "fixed", description: "Close above the prior 20-period high turns bullish; below the prior 10-period low turns bearish." },
  { id: "donchian_55_20", displayName: "Donchian Close 55/20", shortName: "Donchian 55/20", role: "regime", family: "breakout", supportedTimeframes: ["1d", "1w"], parameters: { entry: 55, exit: 20 }, thresholdKind: "fixed", description: "A slower close-confirmed adaptation of the Turtle breakout family." },
  { id: "ichimoku", displayName: "Ichimoku Cloud 9/26/52", shortName: "Ichimoku", role: "regime", family: "cloud/projected support", supportedTimeframes: ["1d", "1w"], parameters: { tenkan: 9, kijun: 26, spanB: 52 }, thresholdKind: "conditional", description: "Above the correctly displaced cloud is bullish, below is bearish, inside is neutral." },
  { id: "macd", displayName: "MACD Regime 12/26/9", shortName: "MACD", role: "regime", family: "momentum", supportedTimeframes: ["1d", "1w"], parameters: { fast: 12, slow: 26, signal: 9 }, thresholdKind: "conditional", description: "MACD above its signal line is bullish; below is bearish." },
  { id: "psar", displayName: "Parabolic SAR", shortName: "Parabolic SAR", role: "regime", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { step: 0.02, maximum: 0.2 }, thresholdKind: "provisional", description: "SAR below price is bullish; above price is bearish." },
  { id: "vortex", displayName: "Vortex 14", shortName: "Vortex", role: "regime", family: "momentum", supportedTimeframes: ["1d", "1w"], parameters: { length: 14 }, thresholdKind: "provisional", description: "VI+ above VI− is bullish; the inverse is bearish." },
  { id: "heikin_ashi", displayName: "Heikin Ashi Color", shortName: "Heikin Ashi", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d", "1w"], parameters: { method: "standard recursive" }, thresholdKind: "provisional", description: "Synthetic candle color is used as an exploratory regime filter." },
  { id: "absolute_momentum", displayName: "12-Month Absolute Momentum", shortName: "12M Momentum", role: "regime", family: "momentum", supportedTimeframes: ["1d", "1w"], parameters: { daily: 365, weekly: 52 }, thresholdKind: "fixed", description: "Price above its value one year earlier is bullish; below is bearish." },
  { id: "golden_cross", displayName: "Golden / Death Cross", shortName: "50/200 Cross", role: "regime", family: "smoothing/order", supportedTimeframes: ["1d"], parameters: { fast: 50, slow: 200 }, thresholdKind: "conditional", description: "Daily 50 SMA above 200 SMA is bullish; below is bearish." },
  { id: "adx", displayName: "ADX / DMI 14", shortName: "ADX / DMI", role: "confirmation", family: "trend strength", supportedTimeframes: ["1d", "1w"], parameters: { length: 14, weak: 20, strong: 25 }, thresholdKind: "conditional", description: "Direction comes from DMI ordering; ADX labels trend strength rather than a price regime." },
  { id: "chandelier", displayName: "Chandelier Exit 22/3", shortName: "Chandelier", role: "exit", family: "ATR/trailing stop", supportedTimeframes: ["1d", "1w"], parameters: { length: 22, factor: 3 }, thresholdKind: "provisional", description: "A volatility-adjusted trailing exit overlay, excluded from family agreement." },
  { id: "mayer", displayName: "Mayer Multiple", shortName: "Mayer Multiple", role: "valuation", family: "valuation", supportedTimeframes: ["1d"], parameters: { average: 200 }, thresholdKind: "conditional", description: "Price divided by the 200-day average; shown as valuation context, not a regime vote." },
  { id: "ma_200w", displayName: "200-Week Moving Average", shortName: "200W MA", role: "valuation", family: "valuation", supportedTimeframes: ["1w"], parameters: { average: 200 }, thresholdKind: "fixed", description: "A slow cycle reference, not an ordinary allocation switch." },
];

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

function sma(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

function ema(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (!values.length) return out;
  const alpha = 2 / (length + 1);
  let current = values[0];
  out[0] = current;
  for (let i = 1; i < values.length; i++) {
    current = alpha * values[i] + (1 - alpha) * current;
    out[i] = current;
  }
  return out;
}

function rma(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < length) return out;
  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  let current = seed / length;
  out[length - 1] = current;
  for (let i = length; i < values.length; i++) {
    current = (current * (length - 1) + values[i]) / length;
    out[i] = current;
  }
  return out;
}

function rollingMid(candles: Candle[], length: number): Array<number | null> {
  return candles.map((_, i) => {
    if (i < length - 1) return null;
    const window = candles.slice(i - length + 1, i + 1);
    return (Math.max(...window.map(c => c.high)) + Math.min(...window.map(c => c.low))) / 2;
  });
}

function trueRanges(candles: Candle[]): number[] {
  return candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
}

function points(candles: Candle[], values: Array<number | null>, name: string, color: string, dashed = false): OverlaySeries {
  return { name, color, dashed, points: candles.flatMap((c, i) => finite(values[i]) ? [{ time: c.time, value: values[i] as number }] : []) };
}

function lastState(states: Array<RegimeState | null>): { state: RegimeState; previous: RegimeState; lastFlip: number | null; flipIndex: number | null } {
  let idx = states.length - 1;
  while (idx >= 0 && states[idx] === null) idx--;
  const state = idx >= 0 ? states[idx] as RegimeState : "neutral";
  let prev = state;
  let flipIndex: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (states[i] !== null && states[i] !== state) { prev = states[i] as RegimeState; flipIndex = i + 1; break; }
  }
  return { state, previous: prev, lastFlip: null, flipIndex };
}

function buildSnapshot(spec: IndicatorSpec, candles: Candle[], states: Array<RegimeState | null>, overlays: OverlaySeries[], values: Record<string, number | null>, bullTrigger: number | null, bearTrigger: number | null, triggerLabel: string, explanation?: string): SignalSnapshot {
  const stateMeta = lastState(states);
  return { id: spec.id, displayName: spec.displayName, shortName: spec.shortName, role: spec.role, family: spec.family, state: stateMeta.state, previousState: stateMeta.previous, lastFlip: stateMeta.flipIndex === null ? null : candles[stateMeta.flipIndex]?.time ?? null, thresholdKind: spec.thresholdKind, bullTrigger, bearTrigger, triggerLabel, explanation: explanation ?? spec.description, values, disclaimer: spec.disclaimer, overlays, states };
}

function supportBand(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const closes = candles.map(c => c.close), s = sma(closes, 20), e = ema(closes, 21);
  const states = closes.map((c, i): RegimeState | null => !finite(s[i]) || !finite(e[i]) ? null : c > Math.max(s[i]!, e[i]!) ? "bull" : c < Math.min(s[i]!, e[i]!) ? "bear" : "neutral");
  const prev19 = closes.length >= 19 ? closes.slice(-19).reduce((a, b) => a + b, 0) / 19 : null;
  const lastEma = e.at(-1) ?? null;
  const bull = finite(prev19) && finite(lastEma) ? Math.max(prev19, lastEma) : null;
  const bear = finite(prev19) && finite(lastEma) ? Math.min(prev19, lastEma) : null;
  return buildSnapshot(spec, candles, states, [points(candles, s, "20 SMA", "#d7a928"), points(candles, e, "21 EMA", "#264f66")], { sma: s.at(-1) ?? null, ema: e.at(-1) ?? null }, bull, bear, "Exact close thresholds fixed from completed candles");
}

function supertrend(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const atr = rma(trueRanges(candles), 10), upper: Array<number | null> = Array(candles.length).fill(null), lower = [...upper], st = [...upper], states: Array<RegimeState | null> = Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (!finite(atr[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const bu = hl2 + 3 * atr[i]!, bl = hl2 - 3 * atr[i]!;
    if (i === 0 || !finite(upper[i - 1]) || !finite(lower[i - 1])) {
      upper[i] = bu; lower[i] = bl; states[i] = "bear"; st[i] = bu; continue;
    }
    upper[i] = bu < upper[i - 1]! || candles[i - 1].close > upper[i - 1]! ? bu : upper[i - 1];
    lower[i] = bl > lower[i - 1]! || candles[i - 1].close < lower[i - 1]! ? bl : lower[i - 1];
    const wasUpper = st[i - 1] === upper[i - 1];
    states[i] = wasUpper ? (candles[i].close > upper[i]! ? "bull" : "bear") : (candles[i].close < lower[i]! ? "bear" : "bull");
    st[i] = states[i] === "bull" ? lower[i] : upper[i];
  }
  const meta = lastState(states), level = st.at(-1) ?? null;
  return buildSnapshot(spec, candles, states, [points(candles, st, "SuperTrend", "#8769c3")], { atr: atr.at(-1) ?? null, supertrend: level }, meta.state === "bear" ? level : null, meta.state === "bull" ? level : null, "Provisional until the open candle completes");
}

function ribbon(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const source = candles.map(c => (c.high + c.low) / 2), lengths = [15, 19, 25, 29], colors = ["#0b8a61", "#d7a928", "#cf6a4c", "#264f66"], lines = lengths.map(n => rma(source, n));
  const states = candles.map((_, i): RegimeState | null => {
    const v = lines.map(line => line[i]); if (v.some(x => !finite(x))) return null;
    if (v[0]! > v[1]! && v[1]! > v[2]! && v[2]! > v[3]!) return "bull";
    if (v[0]! < v[1]! && v[1]! < v[2]! && v[2]! < v[3]!) return "bear";
    return "neutral";
  });
  return buildSnapshot(spec, candles, states, lines.map((line, i) => points(candles, line, `SMMA ${lengths[i]}`, colors[i])), Object.fromEntries(lengths.map((n, i) => [`smma${n}`, lines[i].at(-1) ?? null])), null, null, "Ordering condition; no single guaranteed flip price");
}

function superGuppy(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const fastLengths = Array.from({ length: 11 }, (_, index) => 3 + index * 2);
  const slowLengths = Array.from({ length: 16 }, (_, index) => 25 + index * 3);
  const lengths = [...fastLengths, ...slowLengths];
  const closes = candles.map(candle => candle.close);
  const lines = lengths.map(length => ema(closes, length));
  const states = candles.map((_, candleIndex): RegimeState | null => {
    if (candleIndex < Math.max(...lengths) - 1) return null;
    const values = lines.map(line => line[candleIndex]);
    if (values.some(value => !finite(value))) return null;
    if (values.every((value, index) => index === 0 || values[index - 1]! > value!)) return "bull";
    if (values.every((value, index) => index === 0 || values[index - 1]! < value!)) return "bear";
    return "neutral";
  });
  const visible = [3, 13, 23, 25, 49, 70];
  const colors = ["#10a7a7", "#267f8d", "#264f66", "#7f9f35", "#d7a928", "#c95545"];
  const overlays = visible.map((length, index) => points(candles, lines[lengths.indexOf(length)], `EMA ${length}`, colors[index]));
  const last = (length: number) => lines[lengths.indexOf(length)].at(-1) ?? null;
  const ema3 = last(3), ema23 = last(23), ema25 = last(25), ema70 = last(70);
  return buildSnapshot(spec, candles, states, overlays, {
    ema3,
    ema23,
    ema25,
    ema70,
    fastSpread: finite(ema3) && finite(ema23) ? ema3 / ema23 - 1 : null,
    slowSpread: finite(ema25) && finite(ema70) ? ema25 / ema70 - 1 : null,
  }, null, null, "27-EMA ordering condition; six representative lines shown");
}

function longSma(candles: Candle[], spec: IndicatorSpec, timeframe: Timeframe): SignalSnapshot {
  const n = timeframe === "1d" ? 200 : 30, closes = candles.map(c => c.close), avg = sma(closes, n);
  const states = closes.map((c, i): RegimeState | null => !finite(avg[i]) ? null : c >= avg[i]! ? "bull" : "bear");
  const trigger = closes.length >= n - 1 ? closes.slice(-(n - 1)).reduce((a, b) => a + b, 0) / (n - 1) : null;
  return buildSnapshot(spec, candles, states, [points(candles, avg, `${n} SMA`, "#d7a928")], { sma: avg.at(-1) ?? null, slope: finite(avg.at(-1)) && finite(avg.at(-2)) ? avg.at(-1)! - avg.at(-2)! : null }, trigger, trigger, `Exact next-close threshold from the prior ${n - 1} closes`);
}

function donchian(candles: Candle[], spec: IndicatorSpec, entry: number, exit: number): SignalSnapshot {
  const upper: Array<number | null> = Array(candles.length).fill(null), lower = [...upper], states: Array<RegimeState | null> = Array(candles.length).fill(null);
  let state: RegimeState = "neutral";
  for (let i = 0; i < candles.length; i++) {
    if (i >= entry) upper[i] = Math.max(...candles.slice(i - entry, i).map(c => c.high));
    if (i >= exit) lower[i] = Math.min(...candles.slice(i - exit, i).map(c => c.low));
    if (finite(upper[i]) && candles[i].close > upper[i]!) state = "bull";
    else if (finite(lower[i]) && candles[i].close < lower[i]!) state = "bear";
    states[i] = i >= Math.max(entry, exit) ? state : null;
  }
  return buildSnapshot(spec, candles, states, [points(candles, upper, `${entry}-period high`, "#0b8a61", true), points(candles, lower, `${exit}-period low`, "#c95545", true)], { upper: upper.at(-1) ?? null, lower: lower.at(-1) ?? null }, upper.at(-1) ?? null, lower.at(-1) ?? null, "Fixed from prior completed candles");
}

function ichimoku(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const tenkan = rollingMid(candles, 9), kijun = rollingMid(candles, 26), rawB = rollingMid(candles, 52), spanA: Array<number | null> = Array(candles.length).fill(null), spanB = [...spanA];
  for (let i = 0; i < candles.length; i++) if (i + 26 < candles.length) {
    if (finite(tenkan[i]) && finite(kijun[i])) spanA[i + 26] = (tenkan[i]! + kijun[i]!) / 2;
    if (finite(rawB[i])) spanB[i + 26] = rawB[i];
  }
  const states = candles.map((c, i): RegimeState | null => !finite(spanA[i]) || !finite(spanB[i]) ? null : c.close > Math.max(spanA[i]!, spanB[i]!) ? "bull" : c.close < Math.min(spanA[i]!, spanB[i]!) ? "bear" : "neutral");
  return buildSnapshot(spec, candles, states, [points(candles, spanA, "Senkou A", "#0b8a61"), points(candles, spanB, "Senkou B", "#c95545")], { spanA: spanA.at(-1) ?? null, spanB: spanB.at(-1) ?? null, tenkan: tenkan.at(-1) ?? null, kijun: kijun.at(-1) ?? null }, null, null, "Cloud condition; no single guaranteed flip price");
}

function macd(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const closes = candles.map(c => c.close), fast = ema(closes, 12), slow = ema(closes, 26), line = closes.map((_, i) => finite(fast[i]) && finite(slow[i]) ? fast[i]! - slow[i]! : 0), signal = ema(line, 9);
  const states = line.map((v, i): RegimeState | null => !finite(signal[i]) ? null : v >= signal[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [], { macd: line.at(-1) ?? null, signal: signal.at(-1) ?? null, histogram: finite(signal.at(-1)) ? line.at(-1)! - signal.at(-1)! : null }, null, null, "Momentum crossover condition; displayed in the evidence panel");
}

function psar(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const sar: Array<number | null> = Array(candles.length).fill(null), states: Array<RegimeState | null> = Array(candles.length).fill(null);
  if (candles.length < 2) return buildSnapshot(spec, candles, states, [], {}, null, null, "Insufficient data");
  let bull = candles[1].close >= candles[0].close, af = 0.02, ep = bull ? Math.max(candles[0].high, candles[1].high) : Math.min(candles[0].low, candles[1].low);
  sar[1] = bull ? Math.min(candles[0].low, candles[1].low) : Math.max(candles[0].high, candles[1].high); states[1] = bull ? "bull" : "bear";
  for (let i = 2; i < candles.length; i++) {
    let next = sar[i - 1]! + af * (ep - sar[i - 1]!);
    if (bull) {
      next = Math.min(next, candles[i - 1].low, candles[i - 2].low);
      if (candles[i].low < next) { bull = false; next = ep; ep = candles[i].low; af = 0.02; }
      else if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(0.2, af + 0.02); }
    } else {
      next = Math.max(next, candles[i - 1].high, candles[i - 2].high);
      if (candles[i].high > next) { bull = true; next = ep; ep = candles[i].high; af = 0.02; }
      else if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(0.2, af + 0.02); }
    }
    sar[i] = next; states[i] = bull ? "bull" : "bear";
  }
  const meta = lastState(states), level = sar.at(-1) ?? null;
  return buildSnapshot(spec, candles, states, [points(candles, sar, "SAR", "#8769c3")], { sar: level }, meta.state === "bear" ? level : null, meta.state === "bull" ? level : null, "Provisional while the current high/low can change");
}

function vortex(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const tr = trueRanges(candles), plus = candles.map((c, i) => i ? Math.abs(c.high - candles[i - 1].low) : 0), minus = candles.map((c, i) => i ? Math.abs(c.low - candles[i - 1].high) : 0);
  const vip: Array<number | null> = Array(candles.length).fill(null), vim = [...vip], n = 14;
  for (let i = n; i < candles.length; i++) {
    const sumTr = tr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0);
    if (sumTr) { vip[i] = plus.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / sumTr; vim[i] = minus.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / sumTr; }
  }
  const states = candles.map((_, i): RegimeState | null => !finite(vip[i]) || !finite(vim[i]) ? null : vip[i]! >= vim[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [], { viPlus: vip.at(-1) ?? null, viMinus: vim.at(-1) ?? null }, null, null, "Directional crossover depends on completed OHLC");
}

function heikinAshi(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const ho: number[] = [], hc: number[] = [], hh: number[] = [], hl: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    hc[i] = (candles[i].open + candles[i].high + candles[i].low + candles[i].close) / 4;
    ho[i] = i === 0 ? (candles[i].open + candles[i].close) / 2 : (ho[i - 1] + hc[i - 1]) / 2;
    hh[i] = Math.max(candles[i].high, ho[i], hc[i]); hl[i] = Math.min(candles[i].low, ho[i], hc[i]);
  }
  const states = hc.map((c, i): RegimeState => c >= ho[i] ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [], { haOpen: ho.at(-1) ?? null, haHigh: hh.at(-1) ?? null, haLow: hl.at(-1) ?? null, haClose: hc.at(-1) ?? null }, null, null, "Synthetic candle color remains provisional until close");
}

function momentum(candles: Candle[], spec: IndicatorSpec, timeframe: Timeframe): SignalSnapshot {
  const n = timeframe === "1d" ? 365 : 52, refs: Array<number | null> = candles.map((_, i) => i >= n ? candles[i - n].close : null);
  const states = candles.map((c, i): RegimeState | null => !finite(refs[i]) ? null : c.close >= refs[i]! ? "bull" : "bear");
  const trigger = refs.at(-1) ?? null;
  return buildSnapshot(spec, candles, states, [], { referenceClose: trigger, return: finite(trigger) ? candles.at(-1)!.close / trigger! - 1 : null }, trigger, trigger, "Fixed reference close from one year earlier");
}

function goldenCross(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const closes = candles.map(c => c.close), fast = sma(closes, 50), slow = sma(closes, 200);
  const states = candles.map((_, i): RegimeState | null => !finite(fast[i]) || !finite(slow[i]) ? null : fast[i]! >= slow[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [points(candles, fast, "50 SMA", "#d7a928"), points(candles, slow, "200 SMA", "#264f66")], { sma50: fast.at(-1) ?? null, sma200: slow.at(-1) ?? null }, null, null, "Average crossover condition; no single displayed price");
}

function adx(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const tr = trueRanges(candles), plusDm = candles.map((c, i) => i ? (c.high - candles[i - 1].high > candles[i - 1].low - c.low && c.high > candles[i - 1].high ? c.high - candles[i - 1].high : 0) : 0), minusDm = candles.map((c, i) => i ? (candles[i - 1].low - c.low > c.high - candles[i - 1].high && c.low < candles[i - 1].low ? candles[i - 1].low - c.low : 0) : 0);
  const atr = rma(tr, 14), plusR = rma(plusDm, 14), minusR = rma(minusDm, 14), pdi: Array<number | null> = [], mdi: Array<number | null> = [], dx: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    pdi[i] = finite(atr[i]) && atr[i]! > 0 && finite(plusR[i]) ? 100 * plusR[i]! / atr[i]! : null;
    mdi[i] = finite(atr[i]) && atr[i]! > 0 && finite(minusR[i]) ? 100 * minusR[i]! / atr[i]! : null;
    dx[i] = finite(pdi[i]) && finite(mdi[i]) && pdi[i]! + mdi[i]! > 0 ? 100 * Math.abs(pdi[i]! - mdi[i]!) / (pdi[i]! + mdi[i]!) : 0;
  }
  const adxLine = rma(dx, 14), states = candles.map((_, i): RegimeState | null => !finite(adxLine[i]) ? null : adxLine[i]! < 20 ? "neutral" : pdi[i]! >= mdi[i]! ? "bull" : "bear");
  const strength = !finite(adxLine.at(-1)) ? "unavailable" : adxLine.at(-1)! < 20 ? "weak" : adxLine.at(-1)! < 25 ? "transitional" : "strong";
  return buildSnapshot(spec, candles, states, [], { adx: adxLine.at(-1) ?? null, plusDI: pdi.at(-1) ?? null, minusDI: mdi.at(-1) ?? null }, null, null, `${strength} trend strength; confirmation only`);
}

function chandelier(candles: Candle[], spec: IndicatorSpec): SignalSnapshot {
  const atr = rma(trueRanges(candles), 22), longExit: Array<number | null> = Array(candles.length).fill(null), shortExit = [...longExit];
  for (let i = 21; i < candles.length; i++) if (finite(atr[i])) {
    longExit[i] = Math.max(...candles.slice(i - 21, i + 1).map(c => c.high)) - 3 * atr[i]!;
    shortExit[i] = Math.min(...candles.slice(i - 21, i + 1).map(c => c.low)) + 3 * atr[i]!;
  }
  const states = candles.map((c, i): RegimeState | null => !finite(longExit[i]) ? null : c.close >= longExit[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [points(candles, longExit, "Long exit", "#c95545", true)], { longExit: longExit.at(-1) ?? null, shortExit: shortExit.at(-1) ?? null }, shortExit.at(-1) ?? null, longExit.at(-1) ?? null, "Trailing exit level is provisional until close");
}

function valuation(candles: Candle[], spec: IndicatorSpec, timeframe: Timeframe): SignalSnapshot {
  const closes = candles.map(c => c.close), avg = sma(closes, 200);
  if (spec.id === "mayer") {
    const multiple = finite(avg.at(-1)) ? closes.at(-1)! / avg.at(-1)! : null;
    return buildSnapshot(spec, candles, candles.map(() => null), [], { multiple, sma200: avg.at(-1) ?? null }, null, null, "Valuation context only; excluded from regime agreement");
  }
  const states = closes.map((c, i): RegimeState | null => !finite(avg[i]) ? null : c >= avg[i]! ? "bull" : "bear");
  return buildSnapshot(spec, candles, states, [points(candles, avg, "200W MA", "#d7a928")], { sma200: avg.at(-1) ?? null }, avg.at(-1) ?? null, avg.at(-1) ?? null, timeframe === "1w" ? "Cycle reference only; excluded from regime agreement" : "Weekly only");
}

export function calculateIndicators(candles: Candle[], timeframe: Timeframe): SignalSnapshot[] {
  return INDICATOR_SPECS.filter(s => s.supportedTimeframes.includes(timeframe)).map(spec => {
    switch (spec.id) {
      case "support_band": return supportBand(candles, spec);
      case "supertrend": return supertrend(candles, spec);
      case "smma_ribbon": return ribbon(candles, spec);
      case "super_guppy": return superGuppy(candles, spec);
      case "long_sma": return longSma(candles, spec, timeframe);
      case "donchian_20_10": return donchian(candles, spec, 20, 10);
      case "donchian_55_20": return donchian(candles, spec, 55, 20);
      case "ichimoku": return ichimoku(candles, spec);
      case "macd": return macd(candles, spec);
      case "psar": return psar(candles, spec);
      case "vortex": return vortex(candles, spec);
      case "heikin_ashi": return heikinAshi(candles, spec);
      case "absolute_momentum": return momentum(candles, spec, timeframe);
      case "golden_cross": return goldenCross(candles, spec);
      case "adx": return adx(candles, spec);
      case "chandelier": return chandelier(candles, spec);
      case "mayer": case "ma_200w": return valuation(candles, spec, timeframe);
      default: return buildSnapshot(spec, candles, candles.map(() => null), [], {}, null, null, "Not available");
    }
  });
}

export function backtest(candles: Candle[], snapshots: SignalSnapshot[], timeframe: Timeframe, costBps = 15): BacktestSummary[] {
  const periodsPerYear = timeframe === "1d" ? 365 : 52;
  return snapshots.filter(s => s.role === "regime").map(s => {
    let equity = 1, peak = 1, maxDrawdown = 0, turnover = 0, exposureSum = 0, flips = 0;
    const returns: number[] = [], assetReturns: number[] = [];
    const stateCounts: Record<RegimeState, number> = { bull: 0, bear: 0, neutral: 0 };
    for (let i = 1; i < candles.length - 1; i++) {
      const current = s.states[i - 1];
      if (!current) continue;
      const exposure = current === "bull" ? 1 : current === "neutral" ? 0.5 : 0;
      const previous = i >= 2 && s.states[i - 2] ? (s.states[i - 2] === "bull" ? 1 : s.states[i - 2] === "neutral" ? 0.5 : 0) : 0;
      const change = Math.abs(exposure - previous); turnover += change; if (change > 0) flips++;
      const assetReturn = candles[i + 1].open / candles[i].open - 1;
      const strategyReturn = exposure * assetReturn - change * costBps / 10000;
      returns.push(strategyReturn); assetReturns.push(assetReturn); stateCounts[current]++; exposureSum += exposure; equity *= 1 + strategyReturn; peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
    }
    const years = returns.length / periodsPerYear, cagr = years > 0 && equity > 0 ? equity ** (1 / years) - 1 : 0;
    const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 1 ? returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1) : 0;
    const volatility = Math.sqrt(variance * periodsPerYear), downside = Math.sqrt(returns.filter(value => value < 0).reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, returns.filter(value => value < 0).length)) * Math.sqrt(periodsPerYear);
    const positiveAsset = assetReturns.reduce((sum, value) => sum + Math.max(0, value), 0), negativeAsset = assetReturns.reduce((sum, value) => sum + Math.min(0, value), 0);
    const positiveStrategy = returns.reduce((sum, value, i) => assetReturns[i] > 0 ? sum + value : sum, 0), negativeStrategy = returns.reduce((sum, value, i) => assetReturns[i] < 0 ? sum + value : sum, 0);
    return { indicatorId: s.id, displayName: s.shortName, totalReturn: equity - 1, cagr, maxDrawdown, calmar: maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : null, sharpe: volatility > 0 ? mean * periodsPerYear / volatility : null, sortino: downside > 0 ? mean * periodsPerYear / downside : null, volatility, exposure: returns.length ? exposureSum / returns.length : 0, turnover, flips, upsideCapture: positiveAsset ? positiveStrategy / positiveAsset : null, downsideCapture: negativeAsset ? negativeStrategy / negativeAsset : null, timeInState: { bull: stateCounts.bull / Math.max(1, returns.length), bear: stateCounts.bear / Math.max(1, returns.length), neutral: stateCounts.neutral / Math.max(1, returns.length) } };
  }).sort((a, b) => (b.calmar ?? -Infinity) - (a.calmar ?? -Infinity));
}

export function buyAndHold(candles: Candle[], timeframe: Timeframe, costBps = 15) {
  if (candles.length < 2) return null;
  const periodsPerYear = timeframe === "1d" ? 365 : 52;
  const returns = candles.slice(1).map((candle, i) => candle.open / candles[i].open - 1);
  let equity = 1 - costBps / 10_000, peak = equity, maxDrawdown = 0;
  for (const value of returns) { equity *= 1 + value; peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity / peak - 1); }
  const years = returns.length / periodsPerYear, cagr = equity > 0 && years > 0 ? equity ** (1 / years) - 1 : 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.length > 1 ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1) : 0;
  const volatility = Math.sqrt(variance * periodsPerYear);
  return { totalReturn: equity - 1, cagr, maxDrawdown, calmar: maxDrawdown < 0 ? cagr / Math.abs(maxDrawdown) : null, sharpe: volatility > 0 ? mean * periodsPerYear / volatility : null, volatility };
}

export function familyAgreement(snapshots: SignalSnapshot[]): Record<RegimeState, number> {
  const families = ["smoothing/order", "ATR/trailing stop", "breakout", "momentum", "cloud/projected support"];
  const votes: RegimeState[] = families.map(family => {
    const members = snapshots.filter(s => s.role === "regime" && s.family === family && s.id !== "chandelier");
    if (!members.length) return "neutral";
    if (members.every(m => m.state === "bull")) return "bull";
    if (members.every(m => m.state === "bear")) return "bear";
    return "neutral";
  });
  return { bull: votes.filter(v => v === "bull").length, bear: votes.filter(v => v === "bear").length, neutral: votes.filter(v => v === "neutral").length };
}
