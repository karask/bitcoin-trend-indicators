import { rawSeriesPayload } from "../../../../lib/dashboard-data";
import { ASSETS, marketDefinition, type AssetId, type SourceId } from "../../../../lib/market-data";
import type { Timeframe } from "../../../../lib/regimes";
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
  const timeframe = (url.searchParams.get("timeframe") === "1d" ? "1d" : "1w") as Timeframe;
  try {
    marketDefinition(asset, source);
    return Response.json(await rawSeriesPayload(asset, source, timeframe), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to build series" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
