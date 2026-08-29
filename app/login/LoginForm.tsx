"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type TurnstileApi = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

type Challenge = { id: string; email: string; expiresAt: number; resendAfter: number };

function safeNext(): string {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const deleted = new URLSearchParams(window.location.search).get("deleted");
    const frame = deleted ? window.requestAnimationFrame(() => setMessage("Your account and active sessions were deleted.")) : 0;
    fetch("/api/v1/auth/session", { cache: "no-store" }).then(result => result.json()).then((payload: { authenticated?: boolean }) => {
      if (payload.authenticated) window.location.replace(safeNext());
    }).catch(() => undefined);
    fetch("/api/v1/auth/config", { cache: "no-store" }).then(async result => {
      const payload = await result.json() as { turnstileSiteKey?: string; error?: string };
      if (!result.ok || !payload.turnstileSiteKey) throw new Error(payload.error ?? "Email login is not configured");
      setSiteKey(payload.turnstileSiteKey);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Email login is unavailable"));
    return () => { if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!siteKey || !widget.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !widget.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: siteKey,
        action: "request-code",
        theme: "auto",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-regime-turnstile="true"]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.regimeTurnstile = "true";
        document.head.append(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, challenge]);

  const resetTurnstile = () => {
    setTurnstileToken("");
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  };

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!email.trim() || !turnstileToken) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await fetch("/api/v1/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken }),
        cache: "no-store",
      });
      const payload = await result.json() as { challengeId?: string; expiresAt?: number; resendAfter?: number; message?: string; error?: string };
      if (!result.ok || !payload.challengeId || !payload.expiresAt || !payload.resendAfter) throw new Error(payload.error ?? "The code could not be sent");
      setChallenge({ id: payload.challengeId, email: email.trim().toLowerCase(), expiresAt: payload.expiresAt, resendAfter: payload.resendAfter });
      setMessage(payload.message ?? "Check your email for the login code.");
      setCode("");
      resetTurnstile();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The code could not be sent");
      resetTurnstile();
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge || !/^[0-9]{6}$/.test(code)) return;
    setBusy(true); setError(null);
    try {
      const result = await fetch("/api/v1/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, code }),
        cache: "no-store",
      });
      const payload = await result.json() as { authenticated?: boolean; error?: string };
      if (!result.ok || !payload.authenticated) throw new Error(payload.error ?? "The code is invalid or expired");
      window.location.replace(safeNext());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The code is invalid or expired");
      setCode("");
      setBusy(false);
    }
  };

  const resendSeconds = challenge ? Math.max(0, Math.ceil((challenge.resendAfter - now) / 1_000)) : 0;
  const expired = Boolean(challenge && now >= challenge.expiresAt);

  return <div className="login-panel">
    <div className="login-heading"><div className="brand-mark">RL</div><div><p className="eyebrow">REGIME LABS · SECURE ACCESS</p><h1>Continue with email.</h1></div></div>
    <p className="login-intro">No password is needed. We will email a single-use six-digit code. Your first verified code creates the account; future codes sign you back in.</p>
    {message && <p className="auth-message" role="status">{message}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {!challenge ? <form onSubmit={requestCode} className="auth-form"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /><div ref={widget} className="turnstile-slot" aria-label="Human verification" /><button type="submit" disabled={busy || !turnstileToken}>{busy ? "Sending…" : "Email me a code"}</button></form>
      : <form onSubmit={verifyCode} className="auth-form"><div className="code-destination"><span>Code sent to</span><strong>{challenge.email}</strong><button type="button" onClick={() => { setChallenge(null); setCode(""); setError(null); setMessage(null); }}>Change email</button></div><label htmlFor="auth-code">Six-digit code</label><input id="auth-code" className="code-input" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /><button type="submit" disabled={busy || code.length !== 6 || expired}>{busy ? "Verifying…" : expired ? "Code expired" : "Verify and continue"}</button><div ref={widget} className="turnstile-slot compact" aria-label="Human verification for resend" /><button className="resend-code" type="button" onClick={() => requestCode()} disabled={busy || resendSeconds > 0 || !turnstileToken}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Send a new code"}</button></form>}
    <p className="auth-privacy">By continuing, you agree that your email may be processed only to provide authentication. Read the <a href="/privacy">privacy notice</a>.</p>
  </div>;
}
