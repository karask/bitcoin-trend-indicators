import { getMarketData, SOURCES, type SourceId } from "../../../../lib/market-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const results = await Promise.all(SOURCES.map(async source => {
    const data = await getMarketData(source.id as SourceId, "1d");
    return { source: source.id, market: source.market, stale: data.stale, demo: data.demo, warning: data.warning, lastCandle: data.candles.at(-1)?.time ?? null, retrievedAt: data.retrievedAt, checksum: data.checksum, quality: data.quality };
  }));
  return Response.json({ generatedAt: new Date().toISOString(), sources: results }, { headers: { "Cache-Control": "no-store" } });
}
