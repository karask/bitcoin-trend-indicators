import { isAssetId } from "../../../lib/markets";
import { errorResponse, json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";

type HealthRow = { asset: string; source: string; checked_at: string; status: string; message: string; daily_last: number | null; weekly_last: number | null };

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  try {
    const requested = new URL(request.url).searchParams.get("asset") ?? "btc";
    if (!isAssetId(requested)) return json(request, env, { error: "Unsupported asset" }, 400);
    const result = await env.REGIME_DB.prepare("SELECT asset,source,checked_at,status,message,daily_last,weekly_last FROM source_health WHERE asset=? ORDER BY source").bind(requested).all<HealthRow>();
    return json(request, env, { generatedAt: new Date().toISOString(), asset: requested, sources: result.results });
  } catch (error) {
    return errorResponse(request, env, error);
  }
};
