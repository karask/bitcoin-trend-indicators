import { requireLocalAuth } from "../../../../../lib/auth-local.ts";
import { handleYahooStockQuoteRequest } from "../../../../../lib/yahoo.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  return handleYahooStockQuoteRequest(request);
}
