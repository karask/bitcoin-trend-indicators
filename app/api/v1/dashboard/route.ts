import { getMarketData, ASSETS, marketDefinition, type AssetId, type SourceId } from "../../../../lib/market-data";
import { requireLocalAuth } from "../../../../lib/auth-local.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const requestedAsset = url.searchParams.get("asset") ?? "btc";
  if (!ASSETS.some(asset => asset.id === requestedAsset)) return Response.json({ error: "Unsupported asset" }, { status: 400 });
  const asset = requestedAsset as AssetId;
  const source = (url.searchParams.get("source") ?? ASSETS.find(item => item.id === asset)!.defaultSource) as SourceId;
  try {
    marketDefinition(asset, source);
    const [daily, weekly] = await Promise.all([getMarketData(asset, source, "1d"), getMarketData(asset, source, "1w")]);
    return Response.json({ calculation: "browser", daily, weekly }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to build dashboard" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
