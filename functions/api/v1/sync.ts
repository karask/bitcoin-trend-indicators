import { isAssetId, isSourceId, marketDefinition } from "../../../lib/markets.ts";
import { isStockSymbol } from "../../../lib/stocks.ts";
import { latestRequiredYahooSession } from "../../../lib/yahoo.ts";
import { xnasDateEpoch } from "../../../lib/xnas-calendar.ts";
import { refreshCryptoMarket, refreshStockMarket } from "../../../worker/refresh.ts";
import { json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare.ts";

type SyncBody = { market?: unknown; asset?: unknown; source?: unknown; symbol?: unknown };
type SnapshotRow = { last_candle: number | null };

const COOLDOWN_MS = 60_000;
const DAY = 86_400_000;

function latestCompletedCryptoDay(now = Date.now()): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - DAY;
}

function latestCompletedCryptoWeek(now = Date.now()): number {
  const date = new Date(now);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const monday = today - ((date.getUTCDay() + 6) % 7) * DAY;
  return monday - 7 * DAY;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function reserveRefresh(env: CloudflareEnv, asset: string, source: string): Promise<boolean> {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const reserved = await env.REGIME_DB.prepare(`INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last)
    VALUES (?,?,?,'refreshing','On-demand refresh in progress',NULL,NULL)
    ON CONFLICT(asset,source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message
    WHERE source_health.checked_at<=?
    RETURNING checked_at`).bind(asset, source, now, cutoff).first<{ checked_at: string }>();
  return reserved?.checked_at === now;
}

export const onRequestPost: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  if (!sameOrigin(request)) return json(request, env, { error: "Request origin was rejected" }, 403);
  let body: SyncBody;
  try {
    body = await request.json() as SyncBody;
  } catch {
    return json(request, env, { error: "Invalid sync request" }, 400);
  }

  if (body.market === "crypto") {
    if (typeof body.asset !== "string" || typeof body.source !== "string" || !isAssetId(body.asset) || !isSourceId(body.source)) {
      return json(request, env, { error: "Unsupported market" }, 400);
    }
    try {
      marketDefinition(body.asset, body.source);
      const [daily, weekly] = await Promise.all([
        env.REGIME_DB.prepare("SELECT last_candle FROM provider_snapshots WHERE asset=? AND source=? AND timeframe='1d'").bind(body.asset, body.source).first<SnapshotRow>(),
        env.REGIME_DB.prepare("SELECT last_candle FROM provider_snapshots WHERE asset=? AND source=? AND timeframe='1w'").bind(body.asset, body.source).first<SnapshotRow>(),
      ]);
      const current = (daily?.last_candle ?? 0) >= latestCompletedCryptoDay() && (weekly?.last_candle ?? 0) >= latestCompletedCryptoWeek();
      if (current) return json(request, env, { status: "current", lastCandle: daily!.last_candle });
      if (!await reserveRefresh(env, body.asset, body.source)) return json(request, env, { status: "cooldown", lastCandle: daily?.last_candle ?? null });
      const result = await refreshCryptoMarket(env.REGIME_DB, body.asset, body.source);
      return json(request, env, { status: result.status, lastCandle: daily?.last_candle ?? null });
    } catch {
      return json(request, env, { status: "failed" });
    }
  }

  if (body.market === "stock") {
    if (typeof body.symbol !== "string" || !isStockSymbol(body.symbol)) return json(request, env, { error: "Unsupported stock" }, 400);
    try {
      const stockId = body.symbol.toLowerCase();
      const snapshot = await env.REGIME_DB.prepare("SELECT last_candle FROM provider_snapshots WHERE asset=? AND source='yahoo' AND timeframe='1d'")
        .bind(stockId).first<SnapshotRow>();
      const requiredSession = latestRequiredYahooSession(Date.now());
      const required = requiredSession ? xnasDateEpoch(requiredSession.date) : null;
      if (required != null && (snapshot?.last_candle ?? 0) >= required) return json(request, env, { status: "current", lastCandle: snapshot!.last_candle });
      if (!await reserveRefresh(env, stockId, "yahoo")) return json(request, env, { status: "cooldown", lastCandle: snapshot?.last_candle ?? null });
      const result = await refreshStockMarket(env.REGIME_DB, body.symbol);
      return json(request, env, { status: result.status, lastCandle: snapshot?.last_candle ?? null });
    } catch {
      return json(request, env, { status: "failed" });
    }
  }

  return json(request, env, { error: "Unsupported market" }, 400);
};
