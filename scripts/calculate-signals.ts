import { readFileSync } from "node:fs";
import { backtest, buyAndHold, calculateIndicators, familyAgreement, type Candle, type Timeframe } from "../lib/regimes.ts";

const input = JSON.parse(readFileSync(0, "utf8")) as { candles: Candle[]; timeframe: Timeframe; costs?: number[] };
const snapshots = calculateIndicators(input.candles, input.timeframe);
const windowSize = input.timeframe === "1d" ? 4 * 365 : 4 * 52;
const step = input.timeframe === "1d" ? 365 : 52;
const rolling = [];
for (let start = 0; start + windowSize <= input.candles.length; start += step) {
  const end = start + windowSize;
  rolling.push({ start: input.candles[start].time, end: input.candles[end - 1].time, results: backtest(input.candles.slice(start, end), snapshots.map(snapshot => ({ ...snapshot, states: snapshot.states.slice(start, end) })), input.timeframe, 15) });
}
const result = {
  snapshots,
  familyAgreement: familyAgreement(snapshots),
  backtests: Object.fromEntries((input.costs ?? [5, 15, 30]).map(cost => [String(cost), backtest(input.candles, snapshots, input.timeframe, cost)])),
  buyAndHold: buyAndHold(input.candles, input.timeframe),
  rollingFourYear: rolling,
};
process.stdout.write(JSON.stringify(result));
