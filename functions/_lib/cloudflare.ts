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
  REFRESH_TOKEN?: string;
  RESEND_API_KEY?: string;
  AUTH_HMAC_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  AUTH_FROM_EMAIL?: string;
}

export interface PagesContext<Env = CloudflareEnv> {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
  next(): Promise<Response>;
}

export type PagesFunction<Env = CloudflareEnv> = (context: PagesContext<Env>) => Response | Promise<Response>;

export function responseHeaders(request: Request, env: CloudflareEnv, maxAge = 0): HeadersInit {
  void request;
  void env;
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
  };
}

export function json(request: Request, env: CloudflareEnv, body: unknown, status = 200, maxAge = 0): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request, env, maxAge) });
}

export function errorResponse(request: Request, env: CloudflareEnv, error: unknown, status = 500): Response {
  return json(request, env, { error: error instanceof Error ? error.message : String(error) }, status);
}
