import { dashboardPayload } from "../../../../lib/dashboard-data";
import { ASSETS, marketDefinition, type AssetId, type SourceId } from "../../../../lib/market-data";
import type { Timeframe } from "../../../../lib/regimes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedAsset = url.searchParams.get("asset") ?? "btc";
  if (!ASSETS.some(asset => asset.id === requestedAsset)) return Response.json({ error: "Unsupported asset" }, { status: 400 });
  const asset = requestedAsset as AssetId;
  const source = (url.searchParams.get("source") ?? ASSETS.find(item => item.id === asset)!.defaultSource) as SourceId;
  const timeframe = (url.searchParams.get("timeframe") === "1d" ? "1d" : "1w") as Timeframe;
  const indicator = url.searchParams.get("indicator") ?? "support_band";
  try {
    marketDefinition(asset, source);
    return Response.json(await dashboardPayload(asset, source, timeframe, indicator), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to build dashboard" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
