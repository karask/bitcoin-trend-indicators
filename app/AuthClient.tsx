"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Cloudflare Pages publishes independent static shells, so auth transitions require full navigation. */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { clearAllStockHistoryCaches } from "../lib/stock-cache.ts";

type AuthUser = { id: string; email: string };
type AuthContextValue = { user: AuthUser | null; ready: boolean };

const AuthContext = createContext<AuthContextValue>({ user: null, ready: false });
const PUBLIC_PATHS = new Set(["/login", "/login/", "/privacy", "/privacy/"]);
const TIINGO_TOKEN_KEY = "stock-regime-tiingo-token";

function loginUrl(): string {
  const next = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const result = await fetch(input, init);
  if (result.status === 401 && result.headers.get("X-Auth-Required") === "1" && typeof window !== "undefined") window.location.assign(loginUrl());
  return result;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<AuthContextValue>({ user: null, ready: PUBLIC_PATHS.has(pathname) });

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;
    const controller = new AbortController();
    fetch("/api/v1/auth/session", { cache: "no-store", signal: controller.signal }).then(async result => {
      const payload = await result.json() as { authenticated?: boolean; user?: AuthUser | null };
      if (!result.ok || !payload.authenticated || !payload.user) {
        window.location.replace(loginUrl());
        return;
      }
      setState({ user: payload.user, ready: true });
    }).catch(error => {
      if (error.name !== "AbortError") window.location.replace(loginUrl());
    });
    return () => controller.abort();
  }, [pathname]);

  if (!state.ready) return <main className="auth-loading" aria-live="polite"><div className="brand-mark">RL</div><p>Checking your secure session…</p></main>;
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AccountControls() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const logout = async () => {
    setBusy(true);
    try {
      const result = await fetch("/api/v1/auth/logout", { method: "POST", cache: "no-store" });
      if (!result.ok) throw new Error("Logout failed");
      window.sessionStorage.removeItem(TIINGO_TOKEN_KEY);
      window.location.assign("/login");
    } catch {
      window.alert("The session could not be ended. Please try again.");
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("Delete this account? Your email and every active Regime Lab session will be removed.")) return;
    setBusy(true);
    try {
      const result = await fetch("/api/v1/auth/account", { method: "DELETE", cache: "no-store" });
      if (!result.ok) throw new Error("Account deletion failed");
      window.sessionStorage.removeItem(TIINGO_TOKEN_KEY);
      await clearAllStockHistoryCaches().catch(() => undefined);
      window.location.assign("/login?deleted=1");
    } catch {
      window.alert("The account could not be deleted. Please try again.");
      setBusy(false);
    }
  };

  return <details className="account-menu"><summary aria-label={`Account menu for ${user.email}`}><span aria-hidden="true">@</span><b>{user.email}</b></summary><div><p>Signed in as</p><strong>{user.email}</strong><button type="button" onClick={logout} disabled={busy}>Log out</button><button type="button" className="delete-account" onClick={deleteAccount} disabled={busy}>Delete account</button></div></details>;
}
