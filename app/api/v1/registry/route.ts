import { INDICATOR_SPECS } from "../../../../lib/regimes";
import { ASSETS, SOURCES } from "../../../../lib/market-data";
import { requireLocalAuth } from "../../../../lib/auth-local.ts";

export async function GET(request: Request) {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  return Response.json({ indicators: INDICATOR_SPECS, assets: ASSETS, sources: SOURCES }, { headers: { "Cache-Control": "private, no-store" } });
}
