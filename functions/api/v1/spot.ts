import { errorResponse, json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";
import { marketDefinition, marketRequest } from "../../_lib/request";
import { spotPrice } from "../../_lib/spot";

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  try {
    const { asset, source } = marketRequest(request);
    const definition = marketDefinition(asset, source);
    return json(request, env, {
      asset,
      source,
      sourceLabel: definition.label,
      market: definition.market,
      denomination: definition.denomination,
      price: await spotPrice(definition),
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(request, env, error, 502);
  }
};
