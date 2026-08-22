import { rawSeriesPayload } from "../../../../lib/dashboard-data";
import type { SourceId } from "../../../../lib/market-data";
import type { Timeframe } from "../../../../lib/regimes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = (url.searchParams.get("source") ?? "bitstamp") as SourceId;
  const timeframe = (url.searchParams.get("timeframe") === "1d" ? "1d" : "1w") as Timeframe;
  return Response.json(await rawSeriesPayload(source, timeframe), { headers: { "Cache-Control": "no-store" } });
}
