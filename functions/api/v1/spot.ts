import { sourcesForAsset } from "../../../lib/markets";
import { errorResponse, json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";
import { marketRequest } from "../../_lib/request";
import { spotPrice } from "../../_lib/spot";

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  try {
    const { asset, source } = marketRequest(request);
    const definitions = sourcesForAsset(asset);
    const requested = definitions.find(item => item.id === source)!;
    const candidates = [requested, ...definitions.filter(item => item.id !== source)];
    let lastError: unknown;
    for (const definition of candidates) {
      try {
        return json(request, env, {
          asset,
          // Preserve the selected indicator source so the browser accepts the
          // response, while explicitly identifying the actual quote venue.
          source,
          quoteSource: definition.id,
          sourceLabel: definition.label,
          market: definition.market,
          denomination: definition.denomination,
          fallback: definition.id !== source,
          price: await spotPrice(definition),
          retrievedAt: new Date().toISOString(),
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("No live quote venue was available");
  } catch (error) {
    return errorResponse(request, env, error, 502);
  }
};
