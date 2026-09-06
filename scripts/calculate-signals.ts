import { readFileSync } from "node:fs";
import type { AssetId } from "../lib/markets.ts";
import { backtest, calculateIndicators, familyAgreement, type Candle, type IndicatorCalculationOptions, type Timeframe } from "../lib/regimes.ts";
import { buildResearch, researchWindow } from "../lib/research.ts";

const input = JSON.parse(readFileSync(0, "utf8")) as { asset?: AssetId; candles: Candle[]; timeframe: Timeframe; costs?: number[] };
const options: IndicatorCalculationOptions = { asset: input.asset ?? "btc" };
const snapshots = calculateIndicators(input.candles, input.timeframe, options);
const shared = researchWindow(input.candles, snapshots);
const research = buildResearch(input.candles, snapshots, shared?.comparable[0]?.id ?? "support_band", input.timeframe);
const windowOptions = shared ? { startIndex: shared.startIndex, endIndex: shared.endIndex } : {};
const windowSize = input.timeframe === "1d" ? 4 * 365 : 4 * 52;
const step = input.timeframe === "1d" ? 365 : 52;
const rolling = [];
for (let start = shared?.startIndex ?? input.candles.length; start + windowSize < input.candles.length; start += step) {
  const end = start + windowSize;
  rolling.push({ start: input.candles[start].time, end: input.candles[end].time, results: backtest(input.candles, shared?.comparable ?? [], input.timeframe, 15, { startIndex: start, endIndex: end }) });
}
const result = {
  snapshots,
  familyAgreement: familyAgreement(snapshots),
  backtests: Object.fromEntries((input.costs ?? [5, 15, 30]).map(cost => [String(cost), backtest(input.candles, shared?.comparable ?? [], input.timeframe, cost, windowOptions)])),
  buyAndHold: research.benchmark?.summary ?? null,
  evaluation: { start: research.start, end: research.end, observations: research.observations, excluded: research.excluded },
  rollingFourYear: rolling,
};
process.stdout.write(JSON.stringify(result));
