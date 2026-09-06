import { syncMessage, type SyncStatus as Status } from "../lib/history-client";

export default function SyncStatus({ status, isCurrent, hasHistory, onRefresh, cacheMessage }: { status: Status; isCurrent: boolean; hasHistory: boolean; onRefresh: () => void; cacheMessage?: string | null }) {
  return <div className={`sync-status ${status === "failed" || (status !== "checking" && !isCurrent) ? "sync-warning" : ""}`}>
    <div role="status"><strong>{syncMessage(status, isCurrent, hasHistory)}</strong>{cacheMessage && <small>{cacheMessage}</small>}</div>
    <button type="button" aria-label="Check for updates" onClick={onRefresh} disabled={status === "checking"}>{status === "checking" ? "Checking…" : "Check for updates"}</button>
  </div>;
}
