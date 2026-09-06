import { backtest, backtestDetail, type AnnualizationOptions, type Candle, type SignalSnapshot, type Timeframe } from "./regimes.ts";

/** All eligible regime models use identical open-to-open intervals after warmup. */
export function researchWindow(candles: Candle[], signals: SignalSnapshot[]) {
  const eligible = signals.filter(signal => signal.role === "regime" && signal.states.some((state, index) => state != null && index + 2 < candles.length));
  if (!eligible.length) return null;
  const startIndex = Math.max(...eligible.map(signal => signal.states.findIndex(state => state != null) + 1));
  const endIndex = candles.length - 1;
  // An internal hole is not a shorter test: exclude that model, never splice returns.
  const comparable = eligible.filter(signal => signal.states.slice(startIndex - 1, endIndex - 1).every(state => state != null));
  return startIndex < endIndex && comparable.length ? { startIndex, endIndex, comparable } : null;
}

export function buildResearch(candles: Candle[], signals: SignalSnapshot[], selectedId: string, timeframe: Timeframe, options: AnnualizationOptions = {}) {
  const periodsPerYear = options.periodsPerYear ?? (timeframe === "1w" ? 52 : options.market === "equity" ? 252 : 365);
  const window = researchWindow(candles, signals);
  const settings = { ...options, periodsPerYear, startIndex: window?.startIndex, endIndex: window?.endIndex };
  const selected = window?.comparable.find(signal => signal.id === selectedId);
  const benchmarkSignal = selected ? { ...selected, id: "buy_hold", shortName: "Buy and hold", states: candles.map(() => "bull" as const) } : null;
  const detail = selected ? backtestDetail(candles, selected, timeframe, 15, settings) : null;
  const benchmark = benchmarkSignal ? backtestDetail(candles, benchmarkSignal, timeframe, 15, settings) : null;
  const backtests = window ? backtest(candles, window.comparable, timeframe, 15, settings) : [];
  const sensitivity = [5, 15, 30].map(costBps => ({ costBps, result: selected ? backtestDetail(candles, selected, timeframe, costBps, settings)?.summary ?? null : null }));
  const rolling = [];
  const windowSize = periodsPerYear * 4;
  if (window && selected && benchmarkSignal) {
    for (let start = window.startIndex; start + windowSize <= window.endIndex; start += periodsPerYear) {
      const rollingOptions = { ...settings, startIndex: start, endIndex: start + windowSize };
      const result = backtestDetail(candles, selected, timeframe, 15, rollingOptions);
      const hold = backtestDetail(candles, benchmarkSignal, timeframe, 15, rollingOptions);
      if (result && hold) rolling.push({ start: result.summary.start, end: result.summary.end, result: result.summary, benchmark: hold.summary });
    }
  }
  return {
    periodsPerYear, backtests, sensitivity, detail, benchmark, rolling,
    start: window ? candles[window.startIndex].time : null,
    end: window ? candles[window.endIndex].time : null,
    observations: window ? window.endIndex - window.startIndex : 0,
    excluded: signals.filter(signal => signal.role === "regime" && !window?.comparable.includes(signal)).map(signal => signal.shortName),
  };
}

export type Research = ReturnType<typeof buildResearch>;
