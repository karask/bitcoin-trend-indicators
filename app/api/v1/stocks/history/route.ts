import { handleStockHistoryRequest } from "../../../../../lib/tiingo.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleStockHistoryRequest(request);
}
