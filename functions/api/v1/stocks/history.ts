import { handleStockHistoryRequest } from "../../../../lib/tiingo.ts";
import type { CloudflareEnv, PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestGet: PagesFunction<CloudflareEnv> = ({ request }) => handleStockHistoryRequest(request);
