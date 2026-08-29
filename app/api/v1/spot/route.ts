import { ASSETS, getSpotQuote, marketDefinition, type AssetId, type SourceId } from "../../../../lib/market-data";
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
  const requested = url.searchParams.get("source") ?? ASSETS.find(item => item.id === asset)!.defaultSource;
  try {
    marketDefinition(asset, requested as SourceId);
    return Response.json(await getSpotQuote(asset, requested as SourceId), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to fetch current spot price" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
