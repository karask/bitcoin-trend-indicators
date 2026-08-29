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
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = new Set(tables.map(row => row.name));
  const hasAsset = (table: string) => (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(column => column.name === "asset");
  const legacyTables = ["market_candles", "provider_snapshots", "signal_snapshots"].filter(table => tableNames.has(table) && !hasAsset(table));

  if (legacyTables.length) {
    runTransaction(database, () => {
      for (const table of legacyTables) database.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`);
      createMarketTables(database);
      if (legacyTables.includes("market_candles")) {
        database.exec("INSERT INTO market_candles (asset,source,timeframe,time,market,open,high,low,close,volume,complete) SELECT 'btc',source,timeframe,time,market,open,high,low,close,volume,complete FROM market_candles_legacy");
        database.exec("DROP TABLE market_candles_legacy");
      }
      if (legacyTables.includes("provider_snapshots")) {
        database.exec("INSERT INTO provider_snapshots (asset,source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count) SELECT 'btc',source,timeframe,market,retrieved_at,checksum,warning,first_candle,last_candle,candle_count FROM provider_snapshots_legacy");
        database.exec("DROP TABLE provider_snapshots_legacy");
      }
      if (legacyTables.includes("signal_snapshots")) {
        database.exec("INSERT INTO signal_snapshots (asset,source,timeframe,indicator_id,candle_close,state,prior_state,last_flip,threshold_kind,bull_trigger,bear_trigger,payload,generated_at) SELECT 'btc',source,timeframe,indicator_id,candle_close,state,prior_state,last_flip,threshold_kind,bull_trigger,bear_trigger,payload,generated_at FROM signal_snapshots_legacy");
        database.exec("DROP TABLE signal_snapshots_legacy");
      }
    });
  } else {
    createMarketTables(database);
  }
  createAuthTables(database);
  database.exec("PRAGMA optimize");
}

function createMarketTables(database: LocalDatabase): void {
  database.exec("CREATE TABLE IF NOT EXISTS market_candles (asset TEXT NOT NULL, source TEXT NOT NULL, timeframe TEXT NOT NULL, time INTEGER NOT NULL, market TEXT NOT NULL, open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL, volume REAL NOT NULL, complete INTEGER NOT NULL, PRIMARY KEY (asset, source, timeframe, time))");
  database.exec("CREATE TABLE IF NOT EXISTS provider_snapshots (asset TEXT NOT NULL, source TEXT NOT NULL, timeframe TEXT NOT NULL, market TEXT NOT NULL, retrieved_at TEXT NOT NULL, checksum TEXT NOT NULL, warning TEXT, first_candle INTEGER, last_candle INTEGER, candle_count INTEGER NOT NULL, PRIMARY KEY (asset, source, timeframe))");
  database.exec("CREATE TABLE IF NOT EXISTS signal_snapshots (asset TEXT NOT NULL, source TEXT NOT NULL, timeframe TEXT NOT NULL, indicator_id TEXT NOT NULL, candle_close INTEGER NOT NULL, state TEXT NOT NULL, prior_state TEXT NOT NULL, last_flip INTEGER, threshold_kind TEXT NOT NULL, bull_trigger REAL, bear_trigger REAL, payload TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (asset, source, timeframe, indicator_id))");
}

function createAuthTables(database: LocalDatabase): void {
  database.exec("CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, verified_at INTEGER NOT NULL, last_login_at INTEGER NOT NULL)");
  database.exec("CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at INTEGER)");
  database.exec("CREATE INDEX IF NOT EXISTS auth_challenges_email ON auth_challenges (email, created_at DESC)");
  database.exec("CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER, FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE)");
  database.exec("CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions (user_id, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS auth_sessions_token ON auth_sessions (token_hash)");
  database.exec("CREATE TABLE IF NOT EXISTS auth_rate_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, subject_hash TEXT NOT NULL, created_at INTEGER NOT NULL)");
  database.exec("CREATE INDEX IF NOT EXISTS auth_rate_events_lookup ON auth_rate_events (kind, subject_hash, created_at)");
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
