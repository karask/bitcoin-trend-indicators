import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ensureMarketSchema } from "../db/index.ts";
import {
  AUTH_COOKIE,
  AUTH_SESSION_MS,
  AuthError,
  createAuthRuntime,
  handleDeleteAccount,
  handleLogout,
  handleRequestCode,
  handleSession,
  handleVerifyCode,
  normalizeEmail,
  type AuthRuntime,
} from "../lib/auth.ts";
import { localAuthStore } from "../lib/auth-store-local.ts";
import { onRequest as pagesAuthMiddleware } from "../functions/_middleware.ts";
import type { D1Database, D1PreparedStatement } from "../functions/_lib/cloudflare.ts";

const ORIGIN = "https://regime.example";

function database() {
  const result = new DatabaseSync(":memory:");
  ensureMarketSchema(result);
  return result;
}

function tableCount(db: DatabaseSync, table: "auth_users" | "auth_sessions"): number {
  return Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

function d1(database: DatabaseSync): D1Database {
  return {
    prepare(sql: string): D1PreparedStatement {
      let values: unknown[] = [];
      const statement: D1PreparedStatement = {
        bind(...next: unknown[]) { values = next; return statement; },
        async first<T>() { return (database.prepare(sql).get(...values as never[]) as T | undefined) ?? null; },
        async all<T>() { return { results: database.prepare(sql).all(...values as never[]) as T[], success: true }; },
        async run() {
          const result = database.prepare(sql).run(...values as never[]);
          return { results: [], success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
    async batch() { throw new Error("Batch is not used by auth tests"); },
  };
}

function runtime(db: DatabaseSync, options: { now?: number; code?: string; turnstile?: boolean } = {}) {
  let now = options.now ?? Date.UTC(2026, 7, 29, 12);
  const sent: Array<{ email: string; code: string; challengeId: string }> = [];
  const value: AuthRuntime = {
    store: localAuthStore(db),
    hmacSecret: "test-secret-that-is-at-least-thirty-two-characters",
    turnstileSiteKey: "test-site-key",
    validateTurnstile: async () => options.turnstile !== false,
    sendCode: async input => { sent.push(input); },
    now: () => now,
    generateCode: () => options.code ?? "123456",
  };
  return { runtime: value, sent, advance: (milliseconds: number) => { now += milliseconds; } };
}

function jsonRequest(path: string, payload: unknown, cookie?: string, origin = ORIGIN) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}), "CF-Connecting-IP": "203.0.113.8" },
    body: JSON.stringify(payload),
  });
}

async function payload(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function requestChallenge(auth: AuthRuntime, email = "Person@Example.com") {
  const result = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email, turnstileToken: "human" }), auth);
  const data = await payload(result);
  assert.equal(result.status, 200);
  return String(data.challengeId);
}

test("normalizes deliverable-looking email addresses and rejects malformed input", () => {
  assert.equal(normalizeEmail("  Person+Lab@Example.COM "), "person+lab@example.com");
  assert.throws(() => normalizeEmail("not-an-email"));
  assert.throws(() => normalizeEmail("a@b"));
  assert.throws(() => normalizeEmail("x\n@example.com"));
});

test("requests a generic, single-use code without storing plaintext", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);
  const challengeId = await requestChallenge(setup.runtime);
  assert.deepEqual(setup.sent.map(row => ({ email: row.email, code: row.code })), [{ email: "person@example.com", code: "123456" }]);
  const row = db.prepare("SELECT email,code_hash,expires_at,attempts,consumed_at FROM auth_challenges WHERE id=?").get(challengeId) as Record<string, unknown>;
  assert.equal(row.email, "person@example.com");
  assert.notEqual(row.code_hash, "123456");
  assert.equal(row.attempts, 0);
  assert.equal(row.consumed_at, null);

  await setup.runtime.store.getOrCreateUser("existing@example.com", setup.runtime.now());
  const existing = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "existing@example.com", turnstileToken: "human" }), setup.runtime);
  const newAddress = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "new@example.com", turnstileToken: "human" }), setup.runtime);
  assert.equal((await payload(existing)).message, (await payload(newAddress)).message);
});

test("first verification creates an account and a secure 30-day session", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);
  const challengeId = await requestChallenge(setup.runtime);
  const verified = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId, code: "123456" }), setup.runtime);
  assert.equal(verified.status, 200);
  const cookie = verified.headers.get("set-cookie") ?? "";
  assert.match(cookie, new RegExp(`^${AUTH_COOKIE}=[a-f0-9]{64}`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, new RegExp(`Max-Age=${AUTH_SESSION_MS / 1000}`));
  assert.equal(tableCount(db, "auth_users"), 1);
  assert.notEqual((db.prepare("SELECT token_hash FROM auth_sessions").get() as { token_hash: string }).token_hash, cookie.split("=", 2)[1]);

  const session = await handleSession(new Request(`${ORIGIN}/api/v1/auth/session`, { headers: { Cookie: cookie } }), setup.runtime);
  const sessionBody = await payload(session);
  assert.equal(sessionBody.authenticated, true);
  assert.equal((sessionBody.user as { email: string }).email, "person@example.com");
  assert.equal(sessionBody.expiresAt, setup.runtime.now() + AUTH_SESSION_MS);
});

test("session endpoint, returning login, logout, and account deletion work", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);
  const first = await requestChallenge(setup.runtime);
  const verified = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: first, code: "123456" }), setup.runtime);
  const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];

  const session = await handleSession(new Request(`${ORIGIN}/api/v1/auth/session`, { headers: { Cookie: cookie } }), setup.runtime);
  const sessionBody = await payload(session);
  assert.equal(sessionBody.authenticated, true);
  assert.equal((sessionBody.user as { email: string }).email, "person@example.com");

  setup.advance(60_001);
  const second = await requestChallenge(setup.runtime, "PERSON@example.com");
  const secondLogin = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: second, code: "123456" }, cookie), setup.runtime);
  assert.equal(secondLogin.status, 200);
  assert.equal(tableCount(db, "auth_users"), 1);

  const secondCookie = (secondLogin.headers.get("set-cookie") ?? "").split(";")[0];
  const logout = await handleLogout(jsonRequest("/api/v1/auth/logout", {}, secondCookie), setup.runtime);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
  const loggedOut = await handleSession(new Request(`${ORIGIN}/api/v1/auth/session`, { headers: { Cookie: secondCookie } }), setup.runtime);
  assert.equal((await payload(loggedOut)).authenticated, false);

  setup.advance(60_001);
  const third = await requestChallenge(setup.runtime);
  const thirdLogin = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: third, code: "123456" }), setup.runtime);
  const thirdCookie = (thirdLogin.headers.get("set-cookie") ?? "").split(";")[0];
  const deletionRequest = new Request(`${ORIGIN}/api/v1/auth/account`, { method: "DELETE", headers: { Origin: ORIGIN, Cookie: thirdCookie } });
  const deletion = await handleDeleteAccount(deletionRequest, setup.runtime);
  assert.equal(deletion.status, 200);
  assert.equal(tableCount(db, "auth_users"), 0);
  assert.equal(tableCount(db, "auth_sessions"), 0);
});

test("wrong, expired, consumed, superseded, and concurrently reused codes fail", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);
  const superseded = await requestChallenge(setup.runtime);
  setup.advance(60_001);
  const current = await requestChallenge(setup.runtime);
  assert.equal((await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: superseded, code: "123456" }), setup.runtime)).status, 400);
  assert.equal((await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: current, code: "654321" }), setup.runtime)).status, 400);
  const [left, right] = await Promise.all([
    handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: current, code: "123456" }), setup.runtime),
    handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: current, code: "123456" }), setup.runtime),
  ]);
  assert.deepEqual([left.status, right.status].sort(), [200, 400]);

  const expiring = await requestChallenge(setup.runtime, "later@example.com");
  setup.advance(10 * 60_000 + 1);
  assert.equal((await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: expiring, code: "123456" }), setup.runtime)).status, 400);

  const locked = await requestChallenge(setup.runtime, "locked@example.com");
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: locked, code: "000000" }), setup.runtime)).status, 400);
  }
  assert.equal((await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: locked, code: "123456" }), setup.runtime)).status, 400);
});

test("enforces origin, Turnstile, email, IP, and global-style request limits", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);
  const wrongOrigin = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "a@example.com", turnstileToken: "human" }, undefined, "https://attacker.example"), setup.runtime);
  assert.equal(wrongOrigin.status, 403);

  const noHuman = runtime(db, { turnstile: false });
  const turnstile = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "a@example.com", turnstileToken: "fake" }), noHuman.runtime);
  assert.equal(turnstile.status, 400);

  assert.equal((await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "limited@example.com", turnstileToken: "human" }), setup.runtime)).status, 200);
  const tooSoon = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "limited@example.com", turnstileToken: "human" }), setup.runtime);
  assert.equal(tooSoon.status, 429);
  setup.advance(60_001);
  assert.equal((await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "limited@example.com", turnstileToken: "human" }), setup.runtime)).status, 200);
  setup.advance(60_001);
  assert.equal((await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "limited@example.com", turnstileToken: "human" }), setup.runtime)).status, 200);
  setup.advance(60_001);
  const limited = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "limited@example.com", turnstileToken: "human" }), setup.runtime);
  assert.equal(limited.status, 429);
  assert.equal((await payload(limited)).code, "code_rate_limited");

  db.prepare("DELETE FROM auth_rate_events").run();
  const insert = db.prepare("INSERT INTO auth_rate_events (id,kind,subject_hash,created_at) VALUES (?,?,?,?)");
  for (let index = 0; index < 90; index++) insert.run(crypto.randomUUID(), "global-send", "global", setup.runtime.now());
  const globalLimit = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "global@example.com", turnstileToken: "human" }), setup.runtime);
  assert.equal(globalLimit.status, 429);
});

test("atomically enforces parallel send, IP-send, and IP-verification limits", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);

  const parallel = await Promise.all(Array.from({ length: 4 }, () => handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "parallel@example.com", turnstileToken: "human" }), setup.runtime)));
  assert.deepEqual(parallel.map(result => result.status).sort(), [200, 429, 429, 429]);

  db.prepare("DELETE FROM auth_rate_events").run();
  for (let index = 0; index < 10; index++) {
    const sent = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: `ip-${index}@example.com`, turnstileToken: "human" }), setup.runtime);
    assert.equal(sent.status, 200);
    setup.advance(60_001);
  }
  const ipLimited = await handleRequestCode(jsonRequest("/api/v1/auth/request-code", { email: "ip-over@example.com", turnstileToken: "human" }), setup.runtime);
  assert.equal(ipLimited.status, 429);

  db.prepare("DELETE FROM auth_rate_events").run();
  for (let index = 0; index < 20; index++) {
    const rejected = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: crypto.randomUUID(), code: "000000" }), setup.runtime);
    assert.equal(rejected.status, 400);
  }
  const verifyLimited = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId: crypto.randomUUID(), code: "000000" }), setup.runtime);
  assert.equal(verifyLimited.status, 429);
});

test("caps each account at ten active sessions and expires fixed sessions", async t => {
  const db = database();
  t.after(() => db.close());
  const setup = runtime(db);
  const user = await setup.runtime.store.getOrCreateUser("devices@example.com", setup.runtime.now());
  for (let index = 0; index < 12; index++) {
    await setup.runtime.store.createSession(user.id, String(index).padStart(64, "0"), setup.runtime.now() + index, setup.runtime.now() + AUTH_SESSION_MS);
  }
  const active = db.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE revoked_at IS NULL").get() as { count: number };
  assert.equal(active.count, 10);
  const oldest = db.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE revoked_at IS NOT NULL").get() as { count: number };
  assert.equal(oldest.count, 2);
  const newestHash = String(11).padStart(64, "0");
  assert.equal((await setup.runtime.store.sessionUser(newestHash, setup.runtime.now()))?.email, "devices@example.com");
  setup.advance(AUTH_SESSION_MS + 1);
  assert.equal(await setup.runtime.store.sessionUser(newestHash, setup.runtime.now()), null);
});

test("Resend and Turnstile adapters use server secrets without adding packages", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let turnstileCalls = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).includes("siteverify")) return Response.json({ success: turnstileCalls++ === 0, action: "request-code" });
    return Response.json({ id: "email-id" });
  };
  const db = database();
  const auth = createAuthRuntime(localAuthStore(db), {
    RESEND_API_KEY: "resend-secret",
    AUTH_HMAC_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    TURNSTILE_SITE_KEY: "turnstile-site",
    AUTH_FROM_EMAIL: "Regime Lab <login@auth.example.com>",
  }, fakeFetch);
  assert.equal(await auth.validateTurnstile("browser-token", "203.0.113.8"), true);
  assert.equal(await auth.validateTurnstile("browser-token", "203.0.113.8"), false);
  await auth.sendCode({ email: "person@example.com", code: "123456", challengeId: "challenge-id" });
  assert.equal(calls.length, 3);
  assert.equal(new URLSearchParams(String(calls[0].init?.body)).get("secret"), "turnstile-secret");
  assert.equal((calls[2].init?.headers as Record<string, string>).Authorization, "Bearer resend-secret");
  assert.equal((calls[2].init?.headers as Record<string, string>)["Idempotency-Key"], "challenge-id");
  assert.doesNotMatch(JSON.stringify(await calls[2].init?.body), /resend-secret|turnstile-secret/);
  db.close();
});

test("Resend authentication, rate, and server failures are sanitized", async t => {
  const db = database();
  t.after(() => db.close());
  for (const [status, expectedStatus, expectedCode] of [[401, 503, "email_unavailable"], [429, 429, "email_rate_limited"], [503, 503, "email_unavailable"]] as const) {
    const auth = createAuthRuntime(localAuthStore(db), {
      RESEND_API_KEY: "resend-secret",
      AUTH_HMAC_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      TURNSTILE_SITE_KEY: "turnstile-site",
      AUTH_FROM_EMAIL: "Regime Lab <login@auth.example.com>",
    }, async () => Response.json({ message: "upstream-private-detail" }, { status }));
    await assert.rejects(auth.sendCode({ email: "person@example.com", code: "123456", challengeId: crypto.randomUUID() }), error => {
      assert.ok(error instanceof AuthError);
      assert.equal(error.status, expectedStatus);
      assert.equal(error.code, expectedCode);
      assert.doesNotMatch(error.message, /upstream-private-detail|resend-secret/);
      return true;
    });
  }
});

test("Cloudflare middleware protects pages and APIs while leaving auth pages public", async t => {
  const db = database();
  t.after(() => db.close());
  const env = { REGIME_DB: d1(db) };
  for (const path of ["/api/v1/dashboard", "/api/v1/health", "/api/v1/registry", "/api/v1/series", "/api/v1/spot", "/api/v1/stocks/history?symbol=TSLA"]) {
    const api = await pagesAuthMiddleware({ request: new Request(`${ORIGIN}${path}`), env, next: async () => new Response("should not run"), waitUntil() {} });
    assert.equal(api.status, 401, path);
    assert.equal(api.headers.get("X-Auth-Required"), "1", path);
  }

  for (const path of ["/", "/stocks?symbol=TSLA"]) {
    const page = await pagesAuthMiddleware({ request: new Request(`${ORIGIN}${path}`), env, next: async () => new Response("should not run"), waitUntil() {} });
    assert.equal(page.status, 302, path);
    const destination = new URL(page.headers.get("location") ?? "");
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("next"), path);
  }

  const login = await pagesAuthMiddleware({ request: new Request(`${ORIGIN}/login`), env, next: async () => new Response("login shell", { headers: { "Cache-Control": "public" } }), waitUntil() {} });
  assert.equal(login.status, 200);
  assert.equal(await login.text(), "login shell");
  assert.equal(login.headers.get("Cache-Control"), "private, no-store, max-age=0");

  for (const path of ["/privacy", "/api/v1/auth/config", "/api/v1/auth/session"]) {
    const publicResponse = await pagesAuthMiddleware({ request: new Request(`${ORIGIN}${path}`), env, next: async () => new Response("public"), waitUntil() {} });
    assert.equal(publicResponse.status, 200, path);
    assert.equal(await publicResponse.text(), "public", path);
  }

  const setup = runtime(db);
  const challengeId = await requestChallenge(setup.runtime);
  const verified = await handleVerifyCode(jsonRequest("/api/v1/auth/verify-code", { challengeId, code: "123456" }), setup.runtime);
  const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];
  const protectedPage = await pagesAuthMiddleware({ request: new Request(`${ORIGIN}/`, { headers: { Cookie: cookie } }), env, next: async () => new Response("dashboard shell", { headers: { "Cache-Control": "public" } }), waitUntil() {} });
  assert.equal(protectedPage.status, 200);
  assert.equal(await protectedPage.text(), "dashboard shell");
  assert.equal(protectedPage.headers.get("Cache-Control"), "private, no-store, max-age=0");
});
