import type { CloudflareEnv, PagesFunction } from "../../_lib/cloudflare";

export const onRequestOptions: PagesFunction<CloudflareEnv> = ({ request }) => {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
};

export const onRequest: PagesFunction<CloudflareEnv> = async ({ request, next }) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin API access is not allowed" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  return next();
};
