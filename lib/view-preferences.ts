import { ASSETS, isAssetId, isSourceId, resolveSourceForAsset, type AssetId, type SourceId } from "./markets.ts";
import { isStockId, type StockId } from "./stocks.ts";
import { INDICATOR_SPECS, type Timeframe } from "./regimes.ts";

export type Lab = "crypto" | "stock";
export type LabView = { asset: AssetId | StockId; source: SourceId | "yahoo"; timeframe: Timeframe; indicator: string };
export const defaultView = (lab: Lab): LabView => ({ asset: lab === "crypto" ? "btc" : "tsla", source: lab === "crypto" ? "bitstamp" : "yahoo", timeframe: "1w", indicator: "support_band" });

export function resolveView(lab: Lab, saved: unknown, query = new URLSearchParams()): LabView {
  const defaults = defaultView(lab);
  const object = saved && typeof saved === "object" ? saved as Record<string, unknown> : {};
  const get = (key: keyof LabView) => query.get(key) ?? object[key] ?? defaults[key];
  const requestedAsset = get("asset");
  const asset = typeof requestedAsset === "string" && (lab === "crypto" ? isAssetId(requestedAsset) : isStockId(requestedAsset)) ? requestedAsset as LabView["asset"] : defaults.asset;
  const requestedSource = get("source");
  const source = lab === "stock" ? "yahoo" : resolveSourceForAsset(asset as AssetId, typeof requestedSource === "string" && isSourceId(requestedSource) ? requestedSource : ASSETS.find(item => item.id === asset)!.defaultSource);
  const timeframe = get("timeframe") === "1d" ? "1d" : "1w";
  const requestedIndicator = get("indicator");
  const indicator = INDICATOR_SPECS.find(item => item.id === requestedIndicator && item.supportedTimeframes.includes(timeframe))?.id ?? "support_band";
  return { asset, source, timeframe, indicator };
}

export function viewUrl(lab: Lab, view: LabView) {
  const valid = resolveView(lab, view);
  return `${lab === "crypto" ? "/" : "/stocks/"}?${new URLSearchParams({ asset: valid.asset, ...(lab === "crypto" ? { source: valid.source } : {}), timeframe: valid.timeframe, indicator: valid.indicator })}`;
}
