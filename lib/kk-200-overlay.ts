import type { Candle, OverlaySeries, RegimeState, RibbonBand, Timeframe } from "./regimes.ts";

const WEEK_MS = 7 * 86_400_000;

function sma200(candles: Candle[]): Array<number | null> {
  let sum = 0;
  return candles.map((candle, index) => {
    sum += candle.close;
    if (index >= 200) sum -= candles[index - 200].close;
    return index >= 199 ? sum / 200 : null;
  });
}

/** Plot the other timeframe's SMA without using a weekly close before that week completes. */
export function kk200CompanionOverlay(chartCandles: Candle[], daily: Candle[], weekly: Candle[], timeframe: Timeframe): OverlaySeries {
  const source = timeframe === "1d" ? weekly : daily;
  const values = sma200(source);
  const points: OverlaySeries["points"] = [];
  let sourceIndex = -1;
  for (const candle of chartCandles) {
    if (timeframe === "1d") {
      while (sourceIndex + 1 < weekly.length && weekly[sourceIndex + 1].time + WEEK_MS <= candle.time) sourceIndex++;
    } else {
      while (sourceIndex + 1 < daily.length && daily[sourceIndex + 1].time < candle.time + WEEK_MS) sourceIndex++;
    }
    const value = values[sourceIndex];
    if (value != null) points.push({ time: candle.time, value });
  }
  return {
    name: timeframe === "1d" ? "200-week SMA" : "200-day SMA",
    color: timeframe === "1d" ? "#298fb1" : "#d26059",
    width: 2,
    points,
  };
}

/** The combined chart colors the weekly close against the 200-day line; the 200-week line remains separate context. */
export function kk200WeeklyCombinedRange(weekly: Candle[], daily: Candle[]) {
  const dailyLine = kk200CompanionOverlay(weekly, daily, weekly, "1w");
  const dailyAverage = new Map(dailyLine.points.map(point => [point.time, point.value]));
  const states: Array<RegimeState | null> = [];
  const flips: Array<{ time: number; from: RegimeState; to: RegimeState; close: number }> = [];
  const points: RibbonBand["points"] = [];
  let previous: RegimeState | null = null;
  for (const candle of weekly) {
    const average = dailyAverage.get(candle.time);
    const state: RegimeState | null = average == null ? null : candle.close > average ? "bull" : candle.close < average ? "bear" : "neutral";
    states.push(state);
    if (state == null) continue;
    points.push({ time: candle.time, upper: Math.max(candle.close, average!), lower: Math.min(candle.close, average!), state });
    if (previous != null && state !== previous) flips.push({ time: candle.time, from: previous, to: state, close: candle.close });
    previous = state;
  }
  const ribbon: RibbonBand = {
    id: "kk-200-price-range", name: "Weekly close to 200-day SMA",
    palette: { bull: "#2687d2", bear: "#ef9128", neutral: "#919896" },
    fillOpacity: .58, points,
  };
  return { dailyLine, ribbon, states, flips };
}
