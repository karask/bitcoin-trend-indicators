import { ASSETS, isAssetId, isSourceId, marketDefinition, sourcesForAsset, type AssetId, type SourceId } from "../../lib/markets";

export function marketRequest(request: Request): { asset: AssetId; source: SourceId; url: URL } {
  const url = new URL(request.url);
  const requestedAsset = url.searchParams.get("asset") ?? "btc";
  if (!isAssetId(requestedAsset)) throw new Error("Unsupported asset");
  const asset = requestedAsset;
  const fallback = ASSETS.find(item => item.id === asset)!.defaultSource;
  const requestedSource = url.searchParams.get("source") ?? fallback;
  if (!isSourceId(requestedSource)) throw new Error("Unsupported market source");
  marketDefinition(asset, requestedSource);
  return { asset, source: requestedSource, url };
}

export { marketDefinition, sourcesForAsset };
