import { handleStockHistoryRequest } from "../../../../../lib/tiingo.ts";
import { requireLocalAuth } from "../../../../../lib/auth-local.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  return handleStockHistoryRequest(request);
}
