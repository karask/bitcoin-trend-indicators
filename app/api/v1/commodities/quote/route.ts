import { requireLocalAuth } from "../../../../../lib/auth-local.ts";
import { commodityError, commodityJson, commoditySymbolFromRequest, fetchCommodityQuote } from "../../../../../lib/yahoo-commodities.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  try { return commodityJson(await fetchCommodityQuote(commoditySymbolFromRequest(request))); }
  catch (error) { return commodityError(error); }
}
