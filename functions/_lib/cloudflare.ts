export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
}

export interface CloudflareEnv {
  REGIME_DB: D1Database;
  ALLOWED_ORIGIN?: string;
  REFRESH_TOKEN?: string;
}

export interface PagesContext<Env = CloudflareEnv> {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
  next(): Promise<Response>;
}

export type PagesFunction<Env = CloudflareEnv> = (context: PagesContext<Env>) => Response | Promise<Response>;

export function responseHeaders(request: Request, env: CloudflareEnv, maxAge = 0): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    ...(origin && allowed && (allowed === "*" || origin === allowed) ? { "Access-Control-Allow-Origin": allowed === "*" ? "*" : origin, Vary: "Origin" } : {}),
  };
}

export function json(request: Request, env: CloudflareEnv, body: unknown, status = 200, maxAge = 0): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request, env, maxAge) });
}

export function errorResponse(request: Request, env: CloudflareEnv, error: unknown, status = 500): Response {
  return json(request, env, { error: error instanceof Error ? error.message : String(error) }, status);
}
