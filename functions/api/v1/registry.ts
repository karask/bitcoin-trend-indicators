import { ASSETS, SOURCES } from "../../../lib/markets";
import { INDICATOR_SPECS } from "../../../lib/regimes";
import { json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";

export const onRequestGet: PagesFunction<CloudflareEnv> = ({ request, env }) => json(request, env, { indicators: INDICATOR_SPECS, assets: ASSETS, sources: SOURCES });
