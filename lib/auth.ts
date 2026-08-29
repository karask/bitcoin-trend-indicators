import type { AuthSessionUser, AuthStore } from "./auth-store.ts";

export const AUTH_COOKIE = "__Host-regime_session";
export const AUTH_SESSION_MS = 30 * 86_400_000;
export const AUTH_CODE_MS = 10 * 60_000;
export const AUTH_RESEND_MS = 60_000;
const MAX_CODE_ATTEMPTS = 5;
const GENERIC_CODE_MESSAGE = "If this address can receive email, a login code has been sent.";

export interface AuthEnvironment {
  RESEND_API_KEY?: string;
  AUTH_HMAC_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  AUTH_FROM_EMAIL?: string;
}

export interface AuthRuntime {
  store: AuthStore;
  hmacSecret: string;
  turnstileSiteKey: string;
  validateTurnstile(token: string, ip: string): Promise<boolean>;
  sendCode(input: { email: string; code: string; challengeId: string }): Promise<void>;
  now(): number;
  generateCode(): string;
}

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function secureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

function randomSixDigitCode(): string {
  const range = 0x1_0000_0000;
  const ceiling = range - (range % 1_000_000);
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= ceiling);
  return String(buffer[0] % 1_000_000).padStart(6, "0");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new AuthError(400, "invalid_email", "Enter a valid email address");
  const email = value.trim().toLowerCase();
  const hasControlCharacter = [...email].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || hasControlCharacter) {
    throw new AuthError(400, "invalid_email", "Enter a valid email address");
  }
  return email;
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "local";
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) throw new AuthError(403, "origin_rejected", "Request origin was rejected");
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new AuthError(400, "invalid_request", "Request body is invalid");
  }
}

function authHeaders(): Headers {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Vary: "Cookie",
  });
}

function response(payload: unknown, status = 200, cookie?: string): Response {
  const headers = authHeaders();
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) return response({ error: error.message, code: error.code }, error.status);
  return response({ error: "Authentication is temporarily unavailable", code: "auth_unavailable" }, 503);
}

function sessionCookie(token: string): string {
  return `${AUTH_COOKIE}=${token}; Path=/; Max-Age=${AUTH_SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Lax`;
}

export function expiredSessionCookie(): string {
  return `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function cookieToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${AUTH_COOKIE}=`))?.slice(AUTH_COOKIE.length + 1) ?? null;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function authenticatedUser(request: Request, store: AuthStore, now = Date.now()): Promise<AuthSessionUser | null> {
  const token = cookieToken(request);
  return token ? store.sessionUser(await sha256(token), now) : null;
}

export function authRequiredResponse(): Response {
  const headers = authHeaders();
  headers.set("X-Auth-Required", "1");
  return new Response(JSON.stringify({ error: "Authentication required", code: "auth_required" }), { status: 401, headers });
}

export function createAuthRuntime(store: AuthStore, env: AuthEnvironment, fetchImpl: typeof fetch = fetch): AuthRuntime {
  const hmacSecret = env.AUTH_HMAC_SECRET ?? "";
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY ?? "";
  return {
    store,
    hmacSecret,
    turnstileSiteKey,
    now: () => Date.now(),
    generateCode: randomSixDigitCode,
    async validateTurnstile(token, ip) {
      if (!env.TURNSTILE_SECRET_KEY) throw new AuthError(503, "auth_not_configured", "Email login is not configured");
      let result: Response;
      try {
        result = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new AuthError(503, "turnstile_unavailable", "Human verification is temporarily unavailable");
      }
      const payload = await result.json().catch(() => null) as { success?: boolean; action?: string } | null;
      return Boolean(result.ok && payload?.success && payload.action === "request-code");
    },
    async sendCode({ email, code, challengeId }) {
      if (!env.RESEND_API_KEY || !env.AUTH_FROM_EMAIL) throw new AuthError(503, "auth_not_configured", "Email login is not configured");
      const safeCode = escapeHtml(code);
      let result: Response;
      try {
        result = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": challengeId,
          },
          body: JSON.stringify({
            from: env.AUTH_FROM_EMAIL,
            to: [email],
            subject: "Your Regime Lab login code",
            text: `Your Regime Lab login code is ${code}. It expires in 10 minutes and can be used once. If you did not request this code, ignore this email.`,
            html: `<div style="font-family:Arial,sans-serif;color:#17231f"><h1 style="font-size:22px">Your Regime Lab login code</h1><p style="font-size:34px;font-weight:700;letter-spacing:8px">${safeCode}</p><p>This code expires in 10 minutes and can be used once.</p><p style="color:#68736e">If you did not request this code, ignore this email.</p></div>`,
          }),
          redirect: "manual",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new AuthError(503, "email_unavailable", "Login email is temporarily unavailable");
      }
      if (!result.ok) {
        const code = result.status === 429 ? "email_rate_limited" : "email_unavailable";
        throw new AuthError(result.status === 429 ? 429 : 503, code, result.status === 429 ? "Login email limit reached; try again later" : "Login email is temporarily unavailable");
      }
    },
  };
}

function assertConfigured(runtime: AuthRuntime): void {
  if (!runtime.hmacSecret || runtime.hmacSecret.length < 32 || !runtime.turnstileSiteKey) {
    throw new AuthError(503, "auth_not_configured", "Email login is not configured");
  }
}

export async function handleAuthConfig(runtime: AuthRuntime): Promise<Response> {
  try {
    assertConfigured(runtime);
    return response({ turnstileSiteKey: runtime.turnstileSiteKey });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRequestCode(request: Request, runtime: AuthRuntime): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertConfigured(runtime);
    const payload = await body(request);
    const email = normalizeEmail(payload.email);
    const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
    const ip = clientIp(request);
    if (!turnstileToken || !(await runtime.validateTurnstile(turnstileToken, ip))) throw new AuthError(400, "turnstile_failed", "Complete the human verification and try again");

    const now = runtime.now();
    const emailHash = await hmac(runtime.hmacSecret, `rate:email:${email}`);
    const ipHash = await hmac(runtime.hmacSecret, `rate:ip:${ip}`);
    const utcDay = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
    await runtime.store.cleanup(now);
    if (!(await runtime.store.reserveCodeSend(emailHash, ipHash, utcDay, now))) throw new AuthError(429, "code_rate_limited", "Please wait before requesting another code");
    await runtime.store.invalidateChallenges(email, now);

    const challengeId = crypto.randomUUID();
    const code = runtime.generateCode();
    const codeHash = await hmac(runtime.hmacSecret, `code:${challengeId}:${email}:${code}`);
    await runtime.store.createChallenge({ id: challengeId, email, codeHash, createdAt: now, expiresAt: now + AUTH_CODE_MS, attempts: 0, consumedAt: null });
    try {
      await runtime.sendCode({ email, code, challengeId });
    } catch (error) {
      await runtime.store.consumeChallenge(challengeId, now);
      throw error;
    }
    return response({ message: GENERIC_CODE_MESSAGE, challengeId, expiresAt: now + AUTH_CODE_MS, resendAfter: now + AUTH_RESEND_MS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleVerifyCode(request: Request, runtime: AuthRuntime): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertConfigured(runtime);
    const payload = await body(request);
    const challengeId = typeof payload.challengeId === "string" ? payload.challengeId : "";
    const code = typeof payload.code === "string" ? payload.code.trim() : "";
    if (!/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(challengeId)) throw new AuthError(400, "code_invalid", "The code is invalid or expired");

    const now = runtime.now();
    const ipHash = await hmac(runtime.hmacSecret, `rate:ip:${clientIp(request)}`);
    if (!(await runtime.store.reserveVerificationAttempt(ipHash, now))) throw new AuthError(429, "verify_rate_limited", "Too many verification attempts; try again later");

    const challenge = await runtime.store.challenge(challengeId);
    if (!challenge || challenge.consumedAt != null || challenge.expiresAt <= now || challenge.attempts >= MAX_CODE_ATTEMPTS) {
      throw new AuthError(400, "code_invalid", "The code is invalid or expired");
    }
    const suppliedHash = await hmac(runtime.hmacSecret, `code:${challenge.id}:${challenge.email}:${code}`);
    if (!constantTimeEqual(suppliedHash, challenge.codeHash)) {
      const failedAttempts = await runtime.store.incrementChallengeAttempts(challenge.id);
      if (failedAttempts != null && failedAttempts >= MAX_CODE_ATTEMPTS) await runtime.store.consumeChallenge(challenge.id, now);
      throw new AuthError(400, "code_invalid", "The code is invalid or expired");
    }
    if (!(await runtime.store.consumeChallenge(challenge.id, now))) throw new AuthError(400, "code_invalid", "The code is invalid or expired");

    const user = await runtime.store.getOrCreateUser(challenge.email, now);
    const existing = cookieToken(request);
    if (existing) await runtime.store.revokeSession(await sha256(existing), now);
    const token = secureToken();
    await runtime.store.createSession(user.id, await sha256(token), now, now + AUTH_SESSION_MS);
    return response({ authenticated: true, user: { id: user.id, email: user.email } }, 200, sessionCookie(token));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleSession(request: Request, runtime: Pick<AuthRuntime, "store" | "now">): Promise<Response> {
  try {
    const user = await authenticatedUser(request, runtime.store, runtime.now());
    return response(user ? { authenticated: true, user: { id: user.id, email: user.email }, expiresAt: user.sessionExpiresAt } : { authenticated: false, user: null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleLogout(request: Request, runtime: Pick<AuthRuntime, "store" | "now">): Promise<Response> {
  try {
    assertSameOrigin(request);
    const token = cookieToken(request);
    if (token) await runtime.store.revokeSession(await sha256(token), runtime.now());
    return response({ authenticated: false }, 200, expiredSessionCookie());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleDeleteAccount(request: Request, runtime: Pick<AuthRuntime, "store" | "now">): Promise<Response> {
  try {
    assertSameOrigin(request);
    const user = await authenticatedUser(request, runtime.store, runtime.now());
    if (!user) return authRequiredResponse();
    await runtime.store.deleteUser(user.id);
    return response({ deleted: true }, 200, expiredSessionCookie());
  } catch (error) {
    return errorResponse(error);
  }
}
