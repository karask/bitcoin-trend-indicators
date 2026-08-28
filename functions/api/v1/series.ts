import { INDICATOR_SPECS, type Timeframe } from "../../../lib/regimes";
import { MIN_SOURCE_CANDLES } from "../../../lib/markets";
import { errorResponse, json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";
import { marketRequest } from "../../_lib/request";

type CandleRow = { time: number; open: number; high: number; low: number; close: number; volume: number; complete: number };
type SnapshotRow = { candle_count: number };

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  try {
    const { asset, source, url } = marketRequest(request);
    const timeframe: Timeframe = url.searchParams.get("timeframe") === "1d" ? "1d" : "1w";
    const [snapshot, result] = await Promise.all([
      env.REGIME_DB.prepare("SELECT candle_count FROM provider_snapshots WHERE asset=? AND source=? AND timeframe=?").bind(asset, source, timeframe).first<SnapshotRow>(),
      env.REGIME_DB.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE asset=? AND source=? AND timeframe=? ORDER BY time").bind(asset, source, timeframe).all<CandleRow>(),
    ]);
    const minimum = MIN_SOURCE_CANDLES[timeframe];
    if (!snapshot || snapshot.candle_count < minimum || result.results.length < minimum) throw new Error(`No complete ${asset.toUpperCase()} ${source} ${timeframe} history is available in D1`);
    return json(request, env, {
      asset,
      source,
      timeframe,
      calculation: "browser",
      candles: result.results.map(row => ({ ...row, complete: Boolean(row.complete) })),
      registry: INDICATOR_SPECS.filter(spec => spec.supportedTimeframes.includes(timeframe)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(request, env, error, /Unsupported/.test(message) ? 400 : /history/.test(message) ? 503 : 500);
  }
};
