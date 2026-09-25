import type { Candle, OverlaySeries, Timeframe } from "./regimes.ts";

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
