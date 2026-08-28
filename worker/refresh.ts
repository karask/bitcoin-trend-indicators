import { sourcesForAsset, type AssetId, type SourceDefinition } from "../lib/markets";
import type { Candle } from "../lib/regimes";
import type { CloudflareEnv, D1Database, D1PreparedStatement } from "../functions/_lib/cloudflare";

const DAY = 86_400_000;
const CRON_ASSET: Record<string, AssetId> = {
  "15 0 * * *": "btc",
  "25 0 * * *": "eth",
  "35 0 * * *": "sol",
};

type ScheduledController = { cron: string; scheduledTime: number };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };
type CandleRow = { time: number; open: number; high: number; low: number; close: number; volume: number; complete: number };

function candle(time: unknown, open: unknown, high: unknown, low: unknown, close: unknown, volume: unknown): Candle {
  return { time: Number(time), open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) || 0, complete: true };
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<{ body: unknown; raw: string }> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const raw = await response.text();
  return { body: JSON.parse(raw), raw };
}

function validateRecent(candles: Candle[]): Candle[] {
  const completed = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - DAY;
  const unique = new Map<number, Candle>();
  for (const item of candles.sort((a, b) => a.time - b.time)) {
    if (![item.time, item.open, item.high, item.low, item.close].every(Number.isFinite)) throw new Error("Provider returned a non-numeric candle");
    if (item.low > Math.min(item.open, item.close) || item.high < Math.max(item.open, item.close) || item.low > item.high) throw new Error(`Malformed OHLC at ${item.time}`);
    if (item.time <= completed) unique.set(item.time, item);
  }
  const result = [...unique.values()];
  if (!result.length) throw new Error("Provider returned no completed candles");
  return result;
}

async function recentCandles(definition: SourceDefinition): Promise<{ candles: Candle[]; raw: string }> {
  const now = Date.now();
  if (definition.id === "bitstamp") {
    const result = await fetchJson(`https://www.bitstamp.net/api/v2/ohlc/${definition.providerSymbol}/?step=86400&limit=35&exclude_current_candle=true`);
    const rows = (result.body as { data?: { ohlc?: Array<Record<string, string>> } }).data?.ohlc ?? [];
    return { candles: validateRecent(rows.map(row => candle(Number(row.timestamp) * 1000, row.open, row.high, row.low, row.close, row.volume))), raw: result.raw };
  }
  if (definition.id === "binance") {
    const result = await fetchJson(`https://data-api.binance.vision/api/v3/klines?symbol=${definition.providerSymbol}&interval=1d&limit=35`);
    const rows = result.body as Array<Array<number | string>>;
    return { candles: validateRecent(rows.map(row => candle(row[0], row[1], row[2], row[3], row[4], row[5]))), raw: result.raw };
  }
  if (definition.id === "kraken") {
    const since = Math.floor((now - 36 * DAY) / 1000);
    const result = await fetchJson(`https://api.kraken.com/0/public/OHLC?pair=${definition.providerSymbol}&interval=1440&since=${since}`);
    const record = result.body as { error?: string[]; result?: Record<string, unknown> };
    if (record.error?.length) throw new Error(record.error.join(", "));
    const key = Object.keys(record.result ?? {}).find(item => item !== "last");
    const rows = key ? record.result?.[key] as Array<Array<number | string>> : [];
    return { candles: validateRecent(rows.slice(0, -1).map(row => candle(Number(row[0]) * 1000, row[1], row[2], row[3], row[4], row[6]))), raw: result.raw };
  }
  const end = new Date(now - DAY);
  const start = new Date(end.getTime() - 34 * DAY);
  const params = new URLSearchParams({ granularity: "86400", start: start.toISOString(), end: end.toISOString() });
  const result = await fetchJson(`https://api.exchange.coinbase.com/products/${definition.providerSymbol}/candles?${params}`, { "User-Agent": "Crypto-Regime-Lab/1.0" });
  const rows = result.body as Array<Array<number>>;
  return { candles: validateRecent(rows.map(row => candle(row[0] * 1000, row[3], row[2], row[1], row[4], row[5]))), raw: result.raw };
}

function aggregateWeekly(daily: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const item of daily) {
    const date = new Date(item.time);
    const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const monday = midnight - ((date.getUTCDay() + 6) % 7) * DAY;
    groups.set(monday, [...(groups.get(monday) ?? []), item]);
  }
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return [...groups.entries()].sort(([a], [b]) => a - b).flatMap(([monday, rows]) => {
    const sorted = rows.sort((a, b) => a.time - b.time);
    if (monday + 7 * DAY > today || sorted.length !== 7 || !sorted.every((item, index) => item.time === monday + index * DAY)) return [];
    return [{ time: monday, open: sorted[0].open, high: Math.max(...sorted.map(item => item.high)), low: Math.min(...sorted.map(item => item.low)), close: sorted[6].close, volume: sorted.reduce((sum, item) => sum + item.volume, 0), complete: true }];
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function upsertCandle(database: D1Database, definition: SourceDefinition, timeframe: "1d" | "1w", item: Candle, retrievedAt: string, rawChecksum: string): D1PreparedStatement {
  return database.prepare("INSERT INTO market_candles (asset,source,timeframe,time,market,open,high,low,close,volume,complete,retrieved_at,raw_checksum) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(asset,source,timeframe,time) DO UPDATE SET market=excluded.market,open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,complete=excluded.complete,retrieved_at=excluded.retrieved_at,raw_checksum=excluded.raw_checksum")
    .bind(definition.asset, definition.id, timeframe, item.time, definition.market, item.open, item.high, item.low, item.close, item.volume, 1, retrievedAt, rawChecksum);
}

async function updateSnapshot(database: D1Database, definition: SourceDefinition, timeframe: "1d" | "1w", retrievedAt: string, checksum: string): Promise<number | null> {
  const summary = await database.prepare("SELECT min(time) AS first_candle,max(time) AS last_candle,count(*) AS candle_count FROM market_candles WHERE asset=? AND source=? AND timeframe=?").bind(definition.asset, definition.id, timeframe).first<{ first_candle: number | null; last_candle: number | null; candle_count: number }>();
  if (!summary) return null;
  await database.prepare("INSERT INTO provider_snapshots (asset,source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(asset,source,timeframe) DO UPDATE SET market=excluded.market,retrieved_at=excluded.retrieved_at,checksum=excluded.checksum,warning=NULL,first_candle=excluded.first_candle,last_candle=excluded.last_candle,candle_count=excluded.candle_count")
    .bind(definition.asset, definition.id, timeframe, definition.market, retrievedAt, checksum, null, summary.first_candle, summary.last_candle, summary.candle_count).run();
  return summary.last_candle;
}

async function refreshSource(database: D1Database, definition: SourceDefinition): Promise<{ source: string; status: string; daily: number; weekly: number }> {
  const retrievedAt = new Date().toISOString();
  try {
    const recent = await recentCandles(definition);
    const rawChecksum = await sha256(recent.raw);
    await database.batch(recent.candles.map(item => upsertCandle(database, definition, "1d", item, retrievedAt, rawChecksum)));
    // Kraken's native weekly endpoint is not Monday-anchored. Retain its
    // deeper daily validation window and build the app's Monday-Sunday weeks
    // exclusively from those daily candles.
    const since = definition.id === "kraken" ? 0 : Date.now() - 42 * DAY;
    const dailyResult = await database.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE asset=? AND source=? AND timeframe='1d' AND time>=? ORDER BY time").bind(definition.asset, definition.id, since).all<CandleRow>();
    const weekly = aggregateWeekly(dailyResult.results.map(row => ({ ...row, complete: Boolean(row.complete) })));
    if (weekly.length) {
      if (definition.id === "kraken") {
        await database.prepare("DELETE FROM market_candles WHERE asset=? AND source=? AND timeframe='1w' AND (time % 604800000) != 345600000").bind(definition.asset, definition.id).run();
      }
      await database.batch(weekly.map(item => upsertCandle(database, definition, "1w", item, retrievedAt, rawChecksum)));
    }
    const [dailyLast, weeklyLast] = await Promise.all([
      updateSnapshot(database, definition, "1d", retrievedAt, rawChecksum),
      updateSnapshot(database, definition, "1w", retrievedAt, rawChecksum),
    ]);
    await database.prepare("INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) VALUES (?,?,?,?,?,?,?) ON CONFLICT(asset,source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message,daily_last=excluded.daily_last,weekly_last=excluded.weekly_last")
      .bind(definition.asset, definition.id, retrievedAt, "healthy", "Completed candles refreshed; indicator calculations remain client-side", dailyLast, weeklyLast).run();
    return { source: definition.id, status: "healthy", daily: recent.candles.length, weekly: weekly.length };
  } catch (error) {
    await database.prepare("INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) VALUES (?,?,?,?,?,?,?) ON CONFLICT(asset,source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message")
      .bind(definition.asset, definition.id, retrievedAt, "failed", error instanceof Error ? error.message : String(error), null, null).run();
    return { source: definition.id, status: "failed", daily: 0, weekly: 0 };
  }
}

async function refreshAsset(database: D1Database, asset: AssetId) {
  const results = [];
  for (const definition of sourcesForAsset(asset)) results.push(await refreshSource(database, definition));
  return { asset, refreshedAt: new Date().toISOString(), results };
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const requested = url.searchParams.get("asset") ?? "btc";
    if (!(["btc", "eth", "sol"] as string[]).includes(requested)) return Response.json({ error: "Unsupported asset" }, { status: 400 });
    if (!env.REFRESH_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.REFRESH_TOKEN}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json(await refreshAsset(env.REGIME_DB, requested as AssetId));
  },
  scheduled(controller: ScheduledController, env: CloudflareEnv, context: ExecutionContext): void {
    const asset = CRON_ASSET[controller.cron] ?? "btc";
    context.waitUntil(refreshAsset(env.REGIME_DB, asset));
  },
};
