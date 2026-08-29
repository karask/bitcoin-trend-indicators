import { ASSETS, getMarketData, sourcesForAsset, type AssetId, type SourceId } from "../../../../lib/market-data";
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
  const results = await Promise.all(sourcesForAsset(asset).map(async source => {
    const data = await getMarketData(asset, source.id as SourceId, "1d");
    return { asset, source: source.id, market: source.market, stale: data.stale, demo: data.demo, warning: data.warning, lastCandle: data.candles.at(-1)?.time ?? null, retrievedAt: data.retrievedAt, checksum: data.checksum, quality: data.quality };
  }));
  return Response.json({ generatedAt: new Date().toISOString(), asset, sources: results }, { headers: { "Cache-Control": "no-store" } });
}
