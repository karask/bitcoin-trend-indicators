import { getDatabase, runTransaction } from "../db/index.ts";
import type { MarketDataset, SourceId } from "./market-data.ts";
import { SOURCES } from "./market-data.ts";
import type { SignalSnapshot, Timeframe } from "./regimes.ts";
import { completedBoundary } from "./confirmation-clock.ts";

type StoredCandle = { time: number; open: number; high: number; low: number; close: number; volume: number; complete: number };
type StoredSnapshot = { market: string; retrieved_at: string; checksum: string; warning: string | null; first_candle: number | null; last_candle: number | null; candle_count: number };

export async function readStoredDataset(source: SourceId, timeframe: Timeframe): Promise<MarketDataset | null> {
  const database = getDatabase();
  const metadata = database.prepare("SELECT market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count FROM provider_snapshots WHERE source=? AND timeframe=?").get(source, timeframe) as StoredSnapshot | undefined;
  if (!metadata || metadata.last_candle == null || metadata.last_candle < completedBoundary(timeframe)) return null;
  const rows = database.prepare("SELECT time,open,high,low,close,volume,complete FROM market_candles WHERE source=? AND timeframe=? ORDER BY time").all(source, timeframe) as StoredCandle[];
  if (!rows.length || rows.length !== metadata.candle_count) return null;
  const sourceDef = SOURCES.find(item => item.id === source) ?? SOURCES[0];
  return {
    source,
    sourceLabel: sourceDef.label,
    market: metadata.market,
    timeframe,
    candles: rows.map(row => ({ ...row, complete: Boolean(row.complete) })),
    retrievedAt: metadata.retrieved_at,
    checksum: metadata.checksum,
    provisional: null,
    stale: false,
    demo: false,
    storage: "sqlite",
    warning: metadata.warning,
    quality: { gaps: 0, duplicates: 0, malformed: 0 },
  };
}

export async function persistDataset(dataset: MarketDataset): Promise<void> {
  if (dataset.demo || dataset.stale || dataset.quality.gaps || dataset.quality.duplicates || dataset.quality.malformed) return;
  const database = getDatabase();
  const upsertCandle = database.prepare("INSERT INTO market_candles (source,timeframe,time,market,open,high,low,close,volume,complete) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source,timeframe,time) DO UPDATE SET market=excluded.market,open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,complete=excluded.complete");
  const upsertSnapshot = database.prepare("INSERT INTO provider_snapshots (source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(source,timeframe) DO UPDATE SET market=excluded.market,retrieved_at=excluded.retrieved_at,checksum=excluded.checksum,warning=excluded.warning,first_candle=excluded.first_candle,last_candle=excluded.last_candle,candle_count=excluded.candle_count");
  runTransaction(database, () => {
    for (const candle of dataset.candles) upsertCandle.run(dataset.source, dataset.timeframe, candle.time, dataset.market, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.complete ? 1 : 0);
    upsertSnapshot.run(dataset.source, dataset.timeframe, dataset.market, dataset.retrievedAt, dataset.checksum, dataset.warning, dataset.candles[0]?.time ?? null, dataset.candles.at(-1)?.time ?? null, dataset.candles.length);
  });
}

export async function persistSignalSnapshots(source: SourceId, timeframe: Timeframe, candleClose: number | null, snapshots: SignalSnapshot[]): Promise<void> {
  if (candleClose == null) return;
  const database = getDatabase();
  const generatedAt = new Date().toISOString();
  const upsert = database.prepare("INSERT INTO signal_snapshots (source,timeframe,indicator_id,candle_close,state,prior_state,last_flip,threshold_kind,bull_trigger,bear_trigger,payload,generated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source,timeframe,indicator_id) DO UPDATE SET candle_close=excluded.candle_close,state=excluded.state,prior_state=excluded.prior_state,last_flip=excluded.last_flip,threshold_kind=excluded.threshold_kind,bull_trigger=excluded.bull_trigger,bear_trigger=excluded.bear_trigger,payload=excluded.payload,generated_at=excluded.generated_at");
  runTransaction(database, () => {
    for (const snapshot of snapshots) upsert.run(source, timeframe, snapshot.id, candleClose, snapshot.state, snapshot.previousState, snapshot.lastFlip, snapshot.thresholdKind, snapshot.bullTrigger, snapshot.bearTrigger, JSON.stringify(snapshot.values), generatedAt);
  });
}
