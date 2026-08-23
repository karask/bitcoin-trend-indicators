import { INDICATOR_SPECS, type Timeframe } from "../../../lib/regimes";
import { errorResponse, json, type CloudflareEnv, type PagesFunction } from "../../_lib/cloudflare";
import { marketRequest } from "../../_lib/request";

type CandleRow = { time: number; open: number; high: number; low: number; close: number; volume: number; complete: number };

export const onRequestGet: PagesFunction<CloudflareEnv> = async ({ request, env }) => {
  try {
    const { asset, source, url } = marketRequest(request);
    const timeframe: Timeframe = url.searchParams.get("timeframe") === "1d" ? "1d" : "1w";
    const result = await env.REGIME_DB.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE asset=? AND source=? AND timeframe=? ORDER BY time").bind(asset, source, timeframe).all<CandleRow>();
    return json(request, env, {
      asset,
      source,
      timeframe,
      calculation: "browser",
      candles: result.results.map(row => ({ ...row, complete: Boolean(row.complete) })),
      registry: INDICATOR_SPECS.filter(spec => spec.supportedTimeframes.includes(timeframe)),
    });
  } catch (error) {
    return errorResponse(request, env, error, 400);
  }
};
