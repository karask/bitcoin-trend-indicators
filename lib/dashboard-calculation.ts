import { backtest, calculateIndicators, familyAgreement, INDICATOR_SPECS, type Candle, type IndicatorCalculationOptions, type SignalSnapshot, type Timeframe } from "./regimes";
import { ASSETS, sourcesForAsset, type AssetId, type SourceId } from "./markets";
import type { MarketDataset } from "./market-data";

function flips(candles: Candle[], states: SignalSnapshot["states"]) {
  const result: Array<{ time: number; from: string; to: string; close: number }> = [];
  let prior: string | null = null;
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    if (!state) continue;
    if (prior && state !== prior) result.push({ time: candles[i].time, from: prior, to: state, close: candles[i].close });
    prior = state;
  }
  return result;
}

function nextCondition(signal: SignalSnapshot, denomination: string): string {
  const format = (value: number) => denomination === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 100 ? 2 : 0 }).format(value)
    : `${value.toLocaleString("en-US", { maximumFractionDigits: value < 100 ? 2 : 0 })} USDT`;
  if (signal.thresholdKind === "conditional") return "Conditional";
  if (signal.state === "bull" && signal.bearTrigger != null) return `Below ${format(signal.bearTrigger)}`;
  if (signal.state === "bear" && signal.bullTrigger != null) return `Above ${format(signal.bullTrigger)}`;
  if (signal.bullTrigger != null && signal.bearTrigger != null && signal.bullTrigger !== signal.bearTrigger) return `${format(signal.bearTrigger)}–${format(signal.bullTrigger)}`;
  if (signal.bullTrigger != null) return format(signal.bullTrigger);
  return signal.thresholdKind === "provisional" ? "Provisional" : "Conditional";
}

function slimMatrix(signal: SignalSnapshot, candles: Candle[], denomination: string) {
  return {
    id: signal.id,
    displayName: signal.displayName,
    shortName: signal.shortName,
    role: signal.role,
    family: signal.family,
    state: signal.state,
    previousState: signal.previousState,
    lastFlip: signal.lastFlip,
    thresholdKind: signal.thresholdKind,
    nextCondition: nextCondition(signal, denomination),
    bullTrigger: signal.bullTrigger,
    bearTrigger: signal.bearTrigger,
    triggerLabel: signal.triggerLabel,
    explanation: signal.explanation,
    guidance: signal.guidance,
    values: signal.values,
    disclaimer: signal.disclaimer,
    sourceUrl: signal.sourceUrl,
    candleClose: candles.at(-1)?.time ?? null,
  };
}

function monthlyFaber(candles: Candle[]) {
  const months = new Map<string, Candle[]>();
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  for (const candle of candles) {
    const d = new Date(candle.time);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (key === currentMonth) continue;
    const group = months.get(key) ?? [];
    group.push(candle);
    months.set(key, group);
  }
  const closes = [...months.values()].map(group => group.sort((a, b) => a.time - b.time).at(-1)!.close);
  if (closes.length < 10) return { state: "unavailable" as const, close: null, sma10: null };
  const close = closes.at(-1)!;
  const sma10 = closes.slice(-10).reduce((sum, value) => sum + value, 0) / 10;
  return { state: close >= sma10 ? "bull" as const : "bear" as const, close, sma10 };
}

export function buildDashboardPayload(asset: AssetId, source: SourceId, timeframe: Timeframe, indicatorId: string, daily: MarketDataset, weekly: MarketDataset, options: IndicatorCalculationOptions = {}) {
  const selectedDataset = timeframe === "1d" ? daily : weekly;
  const dailySignals = calculateIndicators(daily.candles, "1d", options);
  const weeklySignals = calculateIndicators(weekly.candles, "1w", options);
  const signals = timeframe === "1d" ? dailySignals : weeklySignals;
  const selected = signals.find(item => item.id === indicatorId) ?? signals.find(item => item.id === "support_band") ?? signals[0];
  const visibleCount = timeframe === "1d" ? 180 : 120;
  const start = Math.max(0, selectedDataset.candles.length - visibleCount);
  const visibleCandles = selectedDataset.candles.slice(start);
  const visibleTimes = new Set(visibleCandles.map(c => c.time));
  const selectedView = {
    ...slimMatrix(selected, selectedDataset.candles, selectedDataset.denomination),
    states: selected.states.slice(start),
    overlays: selected.overlays.map(line => ({ ...line, points: line.points.filter(point => visibleTimes.has(point.time)) })),
    ribbons: selected.ribbons.map(ribbon => ({ ...ribbon, points: ribbon.points.filter(point => visibleTimes.has(point.time)) })),
    events: selected.events.filter(event => visibleTimes.has(event.time)),
    barColors: selected.barColors.filter(point => visibleTimes.has(point.time)),
    flips: selected.id === "super_guppy" ? [] : flips(selectedDataset.candles, selected.states).filter(item => visibleTimes.has(item.time)),
  };
  const counterpart = timeframe === "1d" ? weeklySignals : dailySignals;
  const matrix = signals.filter(signal => signal.role === "regime").map(signal => {
    const other = counterpart.find(item => item.id === signal.id);
    return {
      ...slimMatrix(signal, selectedDataset.candles, selectedDataset.denomination),
      dailyState: timeframe === "1d" ? signal.state : other?.state ?? null,
      weeklyState: timeframe === "1w" ? signal.state : other?.state ?? null,
      dailyLastFlip: timeframe === "1d" ? signal.lastFlip : other?.lastFlip ?? null,
      weeklyLastFlip: timeframe === "1w" ? signal.lastFlip : other?.lastFlip ?? null,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    registry: INDICATOR_SPECS,
    assets: ASSETS,
    sources: sourcesForAsset(asset),
    dataset: {
      asset: selectedDataset.asset,
      assetLabel: selectedDataset.assetLabel,
      source: selectedDataset.source,
      sourceLabel: selectedDataset.sourceLabel,
      market: selectedDataset.market,
      denomination: selectedDataset.denomination,
      timeframe,
      retrievedAt: selectedDataset.retrievedAt,
      checksum: selectedDataset.checksum,
      stale: selectedDataset.stale,
      demo: selectedDataset.demo,
      storage: selectedDataset.storage,
      warning: selectedDataset.warning,
      quality: selectedDataset.quality,
      firstCandle: selectedDataset.candles[0]?.time ?? null,
      lastCandle: selectedDataset.candles.at(-1)?.time ?? null,
      candleCount: selectedDataset.candles.length,
      chartCandleCount: visibleCandles.length,
    },
    candles: visibleCandles,
    selected: selectedView,
    matrix,
    supporting: signals.filter(signal => signal.role !== "regime").map(signal => slimMatrix(signal, selectedDataset.candles, selectedDataset.denomination)),
    familyAgreement: familyAgreement(signals),
    backtests: backtest(selectedDataset.candles, signals, timeframe),
    research: {
      faber10Month: monthlyFaber(daily.candles),
      assumptions: { execution: "Next candle open", exposure: "Bull 100% · Neutral 50% · Bear 0%", cashYield: 0, costBps: 15, sensitivityBps: [5, 15, 30] },
      ranking: "Indicative single-venue view. Production research ranks median equal-date cross-venue Calmar and reports the Pareto set; it does not declare a universal winner.",
    },
  };
}

export type DashboardPayload = ReturnType<typeof buildDashboardPayload>;
