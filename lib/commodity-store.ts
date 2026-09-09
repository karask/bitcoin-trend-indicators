import { COMMODITY_ADJUSTMENT, COMMODITY_PROVIDER, commodityDefinition, commodityDateKey, latestRequiredCommodityDate, type CommodityHistoryResponse, type CommoditySymbol } from "./commodities.ts";
import { commodityIncrementalStartDate } from "./commodity-cache.ts";
import { commodityStartDate, commoditySymbolFromRequest, fetchCommodityHistory } from "./yahoo-commodities.ts";
import { StockApiError } from "./yahoo.ts";
import type { Candle } from "./regimes.ts";

export type Statement = { sql: string; values: unknown[] };
export interface CommoditySql {
  first<T>(sql: string, values: unknown[]): Promise<T | null>;
  all<T>(sql: string, values: unknown[]): Promise<T[]>;
  batch(statements: Statement[]): Promise<void>;
}
type Snapshot = { retrieved_at: string; last_candle: number; candle_count: number; warning: string | null };
type CandleRow = Omit<Candle, "complete"> & { complete: number };
const WHERE = "asset=? AND source='yahoo' AND timeframe='1d'";
export class CommodityStore {
  private sql: CommoditySql;
  constructor(sql: CommoditySql) { this.sql = sql; }
  snapshot(symbol: CommoditySymbol) { return this.sql.first<Snapshot>(`SELECT retrieved_at,last_candle,candle_count,warning FROM provider_snapshots WHERE ${WHERE}`, [commodityDefinition(symbol).id]); }
  async read(request: Request): Promise<CommodityHistoryResponse> {
    const symbol = commoditySymbolFromRequest(request), commodity = commodityDefinition(symbol);
    const snapshot = await this.snapshot(symbol);
    if (!snapshot?.candle_count) throw new StockApiError(503, "Stored futures history is not available yet");
    const requiredThrough = commodityDateKey(snapshot.last_candle);
    const start = commodityStartDate(request, symbol, requiredThrough);
    const rows = await this.sql.all<CandleRow>(`SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE ${WHERE} AND time>=? AND time<=? ORDER BY time`, [commodity.id, Date.parse(`${start}T00:00:00Z`), snapshot.last_candle]);
    let contractLabel: string = commodity.label;
    try { contractLabel = JSON.parse(snapshot.warning ?? "{}").contractLabel ?? contractLabel; } catch { /* Old snapshots retain the generic symbol label. */ }
    return { commodity, provider: COMMODITY_PROVIDER, providerUrl: "https://finance.yahoo.com/", exchange: "COMEX", timeframe: "1d", requestedStart: start, requiredThrough, retrievedAt: snapshot.retrieved_at, adjustment: COMMODITY_ADJUSTMENT, contractLabel, candles: rows.map(row => ({ ...row, complete: Boolean(row.complete) })), quality: { gaps: 0, duplicates: 0, malformed: 0, unexpectedSessions: 0 } };
  }
  async refresh(symbol: CommoditySymbol, fetcher: typeof fetch = fetch, now = Date.now(), allowSeed = false) {
    const commodity = commodityDefinition(symbol), prior = await this.snapshot(symbol);
    if (!prior?.candle_count && !allowSeed) throw new StockApiError(503, "Full futures history must be seeded first");
    const required = latestRequiredCommodityDate(now);
    if (prior && required && commodityDateKey(prior.last_candle) >= required) return { status: "current", updated: 0 };
    const start = prior ? commodityIncrementalStartDate(symbol, [{ time: prior.last_candle } as Candle]) : commodity.historyStart;
    let history = await fetchCommodityHistory(symbol, fetcher, now, start);
    let rebased = false;
    if (prior && start !== commodity.historyStart) {
      const existing = await this.sql.all<CandleRow>(`SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE ${WHERE} AND time>=? ORDER BY time`, [commodity.id, Date.parse(`${start}T00:00:00Z`)]);
      const incoming = new Map(history.candles.map(row => [row.time, row]));
      if (existing.some(row => { const other = incoming.get(row.time); return !other || (["open", "high", "low", "close", "volume"] as const).some(key => Math.abs(row[key] - other[key]) > Math.max(1, Math.abs(row[key])) * 1e-10); })) {
        history = await fetchCommodityHistory(symbol, fetcher, now, commodity.historyStart);
        rebased = true;
      }
    }
    const market = `COMEX:${symbol}`;
    const statements: Statement[] = [];
    // One atomic batch: readers never observe half a correction or new snapshot.
    if (rebased) statements.push({ sql: `DELETE FROM market_candles WHERE ${WHERE}`, values: [commodity.id] });
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(history.candles)))), byte => byte.toString(16).padStart(2, "0")).join("");
    // One JSON-bound insert keeps even a full rebase below D1 Free's query and
    // bound-parameter limits. Do not issue one statement per historical candle.
    const candleJson = JSON.stringify(history.candles.map(row => [row.time, row.open, row.high, row.low, row.close, row.volume]));
    statements.push({ sql: "INSERT INTO market_candles (asset,source,timeframe,time,market,open,high,low,close,volume,complete,retrieved_at,raw_checksum) SELECT ?,'yahoo','1d',json_extract(value,'$[0]'),?,json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]'),1,?,? FROM json_each(?) WHERE true ON CONFLICT(asset,source,timeframe,time) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,complete=1,retrieved_at=excluded.retrieved_at,raw_checksum=excluded.raw_checksum", values: [commodity.id, market, history.retrievedAt, checksum, candleJson] });
    const metadata = JSON.stringify({ adjustment: history.adjustment, contractLabel: history.contractLabel, terms: "personal-research" });
    statements.push({ sql: `INSERT INTO provider_snapshots (asset,source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) SELECT ?,'yahoo','1d',?,?,?, ?,min(time),max(time),count(*) FROM market_candles WHERE ${WHERE} ON CONFLICT(asset,source,timeframe) DO UPDATE SET retrieved_at=excluded.retrieved_at,checksum=excluded.checksum,warning=excluded.warning,first_candle=excluded.first_candle,last_candle=excluded.last_candle,candle_count=excluded.candle_count`, values: [commodity.id, market, history.retrievedAt, checksum, metadata, commodity.id] });
    await this.sql.batch(statements);
    return { status: "healthy", updated: history.candles.length, rebased };
  }
}
