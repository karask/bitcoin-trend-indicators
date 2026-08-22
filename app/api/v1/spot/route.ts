import { getSpotQuote, SOURCES, type SourceId } from "../../../../lib/market-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("source") ?? "bitstamp";
  if (!SOURCES.some(source => source.id === requested)) {
    return Response.json({ error: "Unsupported market source" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return Response.json(await getSpotQuote(requested as SourceId), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to fetch current spot price" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
