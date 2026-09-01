import { handleYahooStockQuoteRequest } from "../../../../lib/yahoo.ts";
import type { CloudflareEnv, PagesFunction } from "../../../_lib/cloudflare.ts";

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request }) => handleYahooStockQuoteRequest(request);
