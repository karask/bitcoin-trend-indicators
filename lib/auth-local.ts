import { authenticatedUser, authRequiredResponse, createAuthRuntime } from "./auth.ts";
import { localAuthStore } from "./auth-store-local.ts";

export function localAuthRuntime() {
  return createAuthRuntime(localAuthStore(), {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_HMAC_SECRET: process.env.AUTH_HMAC_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    AUTH_FROM_EMAIL: process.env.AUTH_FROM_EMAIL,
  });
}

export async function requireLocalAuth(request: Request): Promise<Response | null> {
  const runtime = localAuthRuntime();
  return await authenticatedUser(request, runtime.store, runtime.now()) ? null : authRequiredResponse();
}
