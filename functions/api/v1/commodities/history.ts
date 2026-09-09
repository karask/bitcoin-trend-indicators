import { d1CommodityStore } from "../../../_lib/commodity-history.ts";
import { commodityError, commodityJson } from "../../../../lib/yahoo-commodities.ts";
import type { PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try { return commodityJson(await d1CommodityStore(env.REGIME_DB).read(request)); }
  catch (error) { return commodityError(error); }
};
