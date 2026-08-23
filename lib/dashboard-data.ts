import { calculateIndicators, type Timeframe } from "./regimes";
import { getMarketData } from "./market-data";
import type { AssetId, SourceId } from "./markets";
import { buildDashboardPayload } from "./dashboard-calculation";

export async function dashboardPayload(asset: AssetId, source: SourceId, timeframe: Timeframe, indicatorId: string) {
  const [daily, weekly] = await Promise.all([getMarketData(asset, source, "1d"), getMarketData(asset, source, "1w")]);
  const selectedDataset = timeframe === "1d" ? daily : weekly;
  const signals = calculateIndicators(selectedDataset.candles, timeframe);
  try {
    const { persistSignalSnapshots } = await import("./market-store.ts");
    await persistSignalSnapshots(asset, source, timeframe, selectedDataset.candles.at(-1)?.time ?? null, signals);
  } catch {
    // The dashboard remains readable if local signal storage is unavailable.
  }
  return buildDashboardPayload(asset, source, timeframe, indicatorId, daily, weekly);
}

export async function rawSeriesPayload(asset: AssetId, source: SourceId, timeframe: Timeframe) {
  const dataset = await getMarketData(asset, source, timeframe);
  return { ...dataset, indicators: calculateIndicators(dataset.candles, timeframe) };
}
