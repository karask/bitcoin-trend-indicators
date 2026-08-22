import { INDICATOR_SPECS } from "../../../../lib/regimes";
import { SOURCES } from "../../../../lib/market-data";

export async function GET() {
  return Response.json({ indicators: INDICATOR_SPECS, sources: SOURCES }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
