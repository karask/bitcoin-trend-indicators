import { requireLocalAuth } from "../../../../../lib/auth-local.ts";
import { localCommodityStore } from "../../../../../lib/commodity-store-local.ts";
import { commodityError, commodityJson, commoditySymbolFromRequest } from "../../../../../lib/yahoo-commodities.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const unauthorized = await requireLocalAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const symbol = commoditySymbolFromRequest(request), store = localCommodityStore();
    try { await store.refresh(symbol, fetch, Date.now(), true); }
    catch (error) { if (!await store.snapshot(symbol)) throw error; }
    return commodityJson(await store.read(request));
  } catch (error) { return commodityError(error); }
}
