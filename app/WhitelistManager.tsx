"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetch } from "./AuthClient.tsx";
import styles from "./WhitelistManager.module.css";

type Entry = { email: string; createdAt: number };

export default function WhitelistManager({ onClose }: { onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    authenticatedFetch("/api/v1/auth/allowlist", { cache: "no-store", signal: controller.signal }).then(async result => {
      const payload = await result.json() as { entries?: Entry[]; error?: string };
      if (!result.ok || !payload.entries) throw new Error(payload.error ?? "The whitelist could not be loaded.");
      setEntries(payload.entries);
      setError(null);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The whitelist could not be loaded.");
    });
    return () => controller.abort();
  }, [reload]);

  const update = async (method: "POST" | "DELETE", address: string) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await authenticatedFetch("/api/v1/auth/allowlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
        cache: "no-store",
      });
      const payload = await result.json() as { entries?: Entry[]; error?: string };
      if (!result.ok || !payload.entries) throw new Error(payload.error ?? "The whitelist could not be updated.");
      setEntries(payload.entries);
      setMessage(method === "POST" ? "Email whitelisted. They can now sign in." : "Access removed. Their sessions and pending codes have been revoked.");
      if (method === "POST") setEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The whitelist could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    void update("POST", email);
  };

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="whitelist-title" onCancel={onClose}>
    <div className={styles.heading}><div><p className="eyebrow">ADMINISTRATION</p><h2 id="whitelist-title">Email whitelist</h2></div><button type="button" onClick={onClose} aria-label="Close email whitelist">Close</button></div>
    <p className={styles.intro}>Only approved emails can sign in. Added emails receive member access. Your administrator access is always retained.</p>
    <form onSubmit={add} className="auth-form">
      <label htmlFor="whitelist-email">Email address to whitelist</label>
      <input id="whitelist-email" type="email" autoComplete="off" maxLength={254} required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} placeholder="person@example.com" />
      <button type="submit" disabled={busy || entries === null || !email.trim()}>{busy ? "Saving…" : "Whitelist email"}</button>
    </form>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p className="auth-message" role="status">{message}</p>}
    {entries === null ? <p role="status">{error ? <button type="button" onClick={() => setReload(value => value + 1)}>Retry loading whitelist</button> : "Loading whitelist…"}</p> : <section className={styles.members} aria-label="Whitelisted members">
      <h3>Members <span>{entries.length}</span></h3>
      <p>Removing an email immediately ends its access and active sessions.</p>
      {entries.length === 0 ? <p>No members whitelisted yet.</p> : <ul>{entries.map(entry => <li key={entry.email}><span>{entry.email}</span><button type="button" disabled={busy} aria-label={`Remove access for ${entry.email}`} onClick={() => void update("DELETE", entry.email)}>Remove</button></li>)}</ul>}
    </section>}
  </dialog>;
}
