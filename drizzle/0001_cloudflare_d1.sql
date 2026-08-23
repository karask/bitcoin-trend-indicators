CREATE TABLE IF NOT EXISTS market_candles (
  asset TEXT NOT NULL,
  source TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  time INTEGER NOT NULL,
  market TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  complete INTEGER NOT NULL DEFAULT 1,
  retrieved_at TEXT NOT NULL,
  raw_checksum TEXT NOT NULL,
  PRIMARY KEY (asset, source, timeframe, time)
);

CREATE INDEX IF NOT EXISTS market_candles_lookup
  ON market_candles (asset, source, timeframe, time);

CREATE TABLE IF NOT EXISTS provider_snapshots (
  asset TEXT NOT NULL,
  source TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  market TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  checksum TEXT NOT NULL,
  warning TEXT,
  first_candle INTEGER,
  last_candle INTEGER,
  candle_count INTEGER NOT NULL,
  PRIMARY KEY (asset, source, timeframe)
);

CREATE TABLE IF NOT EXISTS source_health (
  asset TEXT NOT NULL,
  source TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  daily_last INTEGER,
  weekly_last INTEGER,
  PRIMARY KEY (asset, source)
);
