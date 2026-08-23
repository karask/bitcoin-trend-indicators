import { ASSETS, sourcesForAsset, type AssetId, type SourceId } from "../../../lib/markets";
import type { Candle, Timeframe } from "../../../lib/regimes";
import type { MarketDataset } from "../../../lib/market-data";
import { errorResponse, json, type CloudflareEnv, type D1Database, type PagesFunction } from "../../_lib/cloudflare";
import { marketDefinition, marketRequest } from "../../_lib/request";

const DAY = 86_400_000;

type CandleRow = { time: number; open: number; high: number; low: number; close: number; volume: number; complete: number };
type SnapshotRow = { market: string; retrieved_at: string; checksum: string; warning: string | null; first_candle: number | null; last_candle: number | null; candle_count: number };
type AvailableRow = { source: SourceId };

function completedBoundary(timeframe: Timeframe, now = Date.now()): number {
  const date = new Date(now);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (timeframe === "1d") return today - DAY;
  const monday = today - ((date.getUTCDay() + 6) % 7) * DAY;
  return monday - 7 * DAY;
}

async function dataset(database: D1Database, asset: AssetId, source: SourceId, timeframe: Timeframe): Promise<MarketDataset> {
  const [metadata, candleResult] = await Promise.all([
    database.prepare("SELECT market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count FROM provider_snapshots WHERE asset=? AND source=? AND timeframe=?").bind(asset, source, timeframe).first<SnapshotRow>(),
    database.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE asset=? AND source=? AND timeframe=? ORDER BY time").bind(asset, source, timeframe).all<CandleRow>(),
  ]);
  if (!metadata || !candleResult.results.length) throw new Error(`No seeded ${asset.toUpperCase()} ${source} ${timeframe} history is available in D1`);
  const definition = marketDefinition(asset, source);
  const assetDefinition = ASSETS.find(item => item.id === asset)!;
  const candles: Candle[] = candleResult.results.map(row => ({ ...row, complete: Boolean(row.complete) }));
  const stale = (metadata.last_candle ?? 0) < completedBoundary(timeframe);
  return {
    asset,
    assetLabel: assetDefinition.label,
    source,
    sourceLabel: definition.label,
    market: metadata.market,
    denomination: definition.denomination,
    timeframe,
    candles,
    retrievedAt: metadata.retrieved_at,
    checksum: metadata.checksum,
    provisional: null,
    stale,
    demo: false,
    storage: "d1",
    warning: metadata.warning ?? (stale ? "Cloud data is stale. Confirmed indicators remain based on the last stored completed candle." : null),
    quality: { gaps: 0, duplicates: 0, malformed: 0 },
  };
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  try {
    const { asset, source } = marketRequest(request);
    const availableResult = await env.REGIME_DB.prepare("SELECT source FROM provider_snapshots WHERE asset=? GROUP BY source HAVING count(DISTINCT timeframe)=2 ORDER BY source").bind(asset).all<AvailableRow>();
    const available = new Set(availableResult.results.map(row => row.source));
    if (!available.has(source)) throw new Error(`${asset.toUpperCase()} ${source} has not been seeded in D1 yet`);
    const [daily, weekly] = await Promise.all([dataset(env.REGIME_DB, asset, source, "1d"), dataset(env.REGIME_DB, asset, source, "1w")]);
    return json(request, env, {
      calculation: "browser",
      daily,
      weekly,
      sources: sourcesForAsset(asset).filter(definition => available.has(definition.id)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(request, env, error, /Unsupported/.test(message) ? 400 : /seeded|history/.test(message) ? 503 : 500);
  }
};
