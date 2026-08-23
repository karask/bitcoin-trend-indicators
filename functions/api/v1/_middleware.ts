import { responseHeaders, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";

export const onRequestOptions: PagesFunction<CloudflareEnv> = ({ request, env }) => {
  const headers = new Headers(responseHeaders(request, env));
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(null, { status: 204, headers });
};

export const onRequest: PagesFunction<CloudflareEnv> = async ({ next }) => next();
