import { commodityError, commodityJson, commoditySymbolFromRequest, fetchCommodityQuote } from "../../../../lib/yahoo-commodities.ts";
import type { PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestGet: PagesFunction = async ({ request }) => {
  try { return commodityJson(await fetchCommodityQuote(commoditySymbolFromRequest(request))); }
  catch (error) { return commodityError(error); }
};
