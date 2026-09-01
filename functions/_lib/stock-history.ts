import { STOCK_DATA_ADJUSTMENT, STOCK_DATA_PROVIDER, STOCK_DATA_PROVIDER_URL, stockDefinition, type StockHistoryResponse } from "../../lib/stocks.ts";
import { StockApiError, stockStartDateFromRequest, stockSymbolFromRequest } from "../../lib/yahoo.ts";
import { xnasDateKey } from "../../lib/xnas-calendar.ts";
import type { Candle } from "../../lib/regimes.ts";
import type { CloudflareEnv } from "./cloudflare.ts";

type CandleRow = { time: number; open: number; high: number; low: number; close: number; volume: number; complete: number };
type SnapshotRow = { retrieved_at: string; last_candle: number | null; candle_count: number };

function privateJson(body: unknown, status = 200, errorCode?: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", Pragma: "no-cache", "X-Content-Type-Options": "nosniff", ...(errorCode ? { "X-Stock-Error": errorCode } : {}) } });
}

export async function storedStockHistory(request: Request, env: CloudflareEnv): Promise<Response> {
  try {
    const symbol = stockSymbolFromRequest(request);
    const stock = stockDefinition(symbol);
    const snapshot = await env.REGIME_DB.prepare("SELECT retrieved_at,last_candle,candle_count FROM provider_snapshots WHERE asset=? AND source='yahoo' AND timeframe='1d'").bind(stock.id).first<SnapshotRow>();
    if (!snapshot?.last_candle || snapshot.candle_count < 1) throw new StockApiError(503, "Stored stock history is not available yet", "stock_not_seeded");
    const latestDate = xnasDateKey(snapshot.last_candle);
    const startDate = stockStartDateFromRequest(request, symbol, latestDate);
    const startEpoch = Date.parse(`${startDate}T00:00:00.000Z`);
    const rows = await env.REGIME_DB.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE asset=? AND source='yahoo' AND timeframe='1d' AND time>=? ORDER BY time").bind(stock.id, startEpoch).all<CandleRow>();
    const candles: Candle[] = rows.results.map(row => ({ ...row, complete: Boolean(row.complete) }));
    if (!candles.length) throw new StockApiError(503, "Stored stock history is not available yet", "stock_not_seeded");
    const history: StockHistoryResponse = {
      stock,
      provider: STOCK_DATA_PROVIDER,
      providerUrl: STOCK_DATA_PROVIDER_URL,
      exchange: stock.exchange,
      timeframe: "1d",
      requestedStart: startDate,
      requiredThrough: xnasDateKey(candles.at(-1)!.time),
      retrievedAt: snapshot.retrieved_at,
      adjustment: STOCK_DATA_ADJUSTMENT,
      candles,
      quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 },
    };
    return privateJson(history);
  } catch (error) {
    const stockError = error instanceof StockApiError ? error : new StockApiError(500, "Stock history is unavailable");
    return privateJson({ error: stockError.message }, stockError.status, stockError.code);
  }
}
