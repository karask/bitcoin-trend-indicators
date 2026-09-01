import { storedStockHistory } from "../../../_lib/stock-history.ts";
import type { CloudflareEnv, PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestGet: PagesFunction<CloudflareEnv> = ({ request, env }) => storedStockHistory(request, env);
