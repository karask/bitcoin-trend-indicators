import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type LocalDatabase = DatabaseSync;

const globalDatabase = globalThis as typeof globalThis & {
  __btcRegimeDatabase?: { path: string; database: LocalDatabase };
};

export function localDatabasePath(): string {
  const configured = process.env.REGIME_SQLITE;
  return configured ? path.resolve(/* turbopackIgnore: true */ configured) : path.join(process.cwd(), "data", "bitcoin-regime.sqlite");
}

export function getDatabase(): LocalDatabase {
  const databasePath = localDatabasePath();
  const existing = globalDatabase.__btcRegimeDatabase;
  if (existing?.path === databasePath && existing.database.isOpen) return existing.database;

  if (existing?.database.isOpen) existing.database.close();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec("PRAGMA busy_timeout = 5000");
  ensureMarketSchema(database);
  globalDatabase.__btcRegimeDatabase = { path: databasePath, database };
  return database;
}

export function ensureMarketSchema(database = getDatabase()): void {
  database.exec("CREATE TABLE IF NOT EXISTS market_candles (source TEXT NOT NULL, timeframe TEXT NOT NULL, time INTEGER NOT NULL, market TEXT NOT NULL, open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL, volume REAL NOT NULL, complete INTEGER NOT NULL, PRIMARY KEY (source, timeframe, time))");
  database.exec("CREATE TABLE IF NOT EXISTS provider_snapshots (source TEXT NOT NULL, timeframe TEXT NOT NULL, market TEXT NOT NULL, retrieved_at TEXT NOT NULL, checksum TEXT NOT NULL, warning TEXT, first_candle INTEGER, last_candle INTEGER, candle_count INTEGER NOT NULL, PRIMARY KEY (source, timeframe))");
  database.exec("CREATE TABLE IF NOT EXISTS signal_snapshots (source TEXT NOT NULL, timeframe TEXT NOT NULL, indicator_id TEXT NOT NULL, candle_close INTEGER NOT NULL, state TEXT NOT NULL, prior_state TEXT NOT NULL, last_flip INTEGER, threshold_kind TEXT NOT NULL, bull_trigger REAL, bear_trigger REAL, payload TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (source, timeframe, indicator_id))");
  database.exec("PRAGMA optimize");
}

export function runTransaction<T>(database: LocalDatabase, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
