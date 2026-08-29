import { authenticatedUser, authRequiredResponse } from "../lib/auth.ts";
import { d1AuthStore } from "../lib/auth-store-d1.ts";
import type { CloudflareEnv, PagesFunction } from "./_lib/cloudflare.ts";

const PUBLIC_PATHS = new Set(["/login", "/login/", "/privacy", "/privacy/"]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/v1/auth/");
}

function noStore(source: Response): Response {
  const headers = new Headers(source.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return new Response(source.body, { status: source.status, statusText: source.statusText, headers });
}

export const onRequest: PagesFunction<CloudflareEnv> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  if (isPublic(url.pathname)) return noStore(await next());

  const user = await authenticatedUser(request, d1AuthStore(env.REGIME_DB));
  if (user) return noStore(await next());
  if (url.pathname.startsWith("/api/")) return authRequiredResponse();

  const login = new URL("/login", url.origin);
  login.searchParams.set("next", `${url.pathname}${url.search}`);
  return new Response(null, { status: 302, headers: { Location: login.toString(), "Cache-Control": "private, no-store" } });
};
