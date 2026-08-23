from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import json
from threading import RLock

import duckdb

from .models import Dataset


SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
  asset VARCHAR, source VARCHAR, market VARCHAR, timeframe VARCHAR, retrieved_at TIMESTAMPTZ,
  normalized_checksum VARCHAR, raw_checksum VARCHAR, warning VARCHAR,
  first_candle BIGINT, last_candle BIGINT, candle_count INTEGER,
  PRIMARY KEY (asset, source, market, timeframe)
);
CREATE TABLE IF NOT EXISTS candles (
  asset VARCHAR, source VARCHAR, market VARCHAR, timeframe VARCHAR, time BIGINT,
  open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume DOUBLE,
  complete BOOLEAN, retrieved_at TIMESTAMPTZ, raw_checksum VARCHAR,
  PRIMARY KEY (asset, source, market, timeframe, time)
);
CREATE TABLE IF NOT EXISTS indicator_series (
  asset VARCHAR, source VARCHAR, market VARCHAR, timeframe VARCHAR, indicator_id VARCHAR, time BIGINT,
  state VARCHAR, prior_state VARCHAR, is_flip BOOLEAN, confirmed_at BIGINT,
  effective_at BIGINT, threshold_kind VARCHAR, values JSON,
  PRIMARY KEY (asset, source, market, timeframe, indicator_id, time)
);
CREATE TABLE IF NOT EXISTS signal_reports (
  asset VARCHAR, source VARCHAR, market VARCHAR, timeframe VARCHAR, indicator_id VARCHAR,
  generated_at TIMESTAMPTZ DEFAULT current_timestamp, payload JSON,
  PRIMARY KEY (asset, source, market, timeframe, indicator_id)
);
CREATE TABLE IF NOT EXISTS research_reports (
  report_id VARCHAR PRIMARY KEY, generated_at TIMESTAMPTZ DEFAULT current_timestamp, payload JSON
);
CREATE TABLE IF NOT EXISTS source_health (
  asset VARCHAR, source VARCHAR, checked_at TIMESTAMPTZ DEFAULT current_timestamp,
  status VARCHAR, message VARCHAR, daily_last BIGINT, weekly_last BIGINT
  , PRIMARY KEY (asset, source)
);
"""


class Repository:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        with self.connect() as connection:
            self._migrate_asset_schema(connection)
            connection.execute(SCHEMA)

    @staticmethod
    def _migrate_asset_schema(connection) -> None:
        tables = {row[0] for row in connection.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()}
        if "datasets" not in tables:
            return
        columns = {row[0] for row in connection.execute("SELECT column_name FROM information_schema.columns WHERE table_name='datasets'").fetchall()}
        if "asset" in columns:
            return
        migrated = [name for name in ("datasets", "candles", "indicator_series", "signal_reports", "source_health") if name in tables]
        connection.execute("BEGIN TRANSACTION")
        try:
            for table in migrated:
                connection.execute(f"ALTER TABLE {table} RENAME TO {table}_legacy")
            connection.execute(SCHEMA)
            if "datasets" in migrated:
                connection.execute("INSERT INTO datasets SELECT 'btc',source,market,timeframe,retrieved_at,normalized_checksum,raw_checksum,warning,first_candle,last_candle,candle_count FROM datasets_legacy")
            if "candles" in migrated:
                connection.execute("INSERT INTO candles SELECT 'btc',source,market,timeframe,time,open,high,low,close,volume,complete,retrieved_at,raw_checksum FROM candles_legacy")
            if "indicator_series" in migrated:
                connection.execute("INSERT INTO indicator_series SELECT 'btc',source,market,timeframe,indicator_id,time,state,prior_state,is_flip,confirmed_at,effective_at,threshold_kind,values FROM indicator_series_legacy")
            if "signal_reports" in migrated:
                connection.execute("INSERT INTO signal_reports (asset,source,market,timeframe,indicator_id,generated_at,payload) SELECT 'btc',source,market,timeframe,indicator_id,generated_at,payload FROM signal_reports_legacy")
            if "source_health" in migrated:
                connection.execute("INSERT INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) SELECT 'btc',source,checked_at,status,message,daily_last,weekly_last FROM source_health_legacy")
            for table in migrated:
                connection.execute(f"DROP TABLE {table}_legacy")
            connection.execute("COMMIT")
        except Exception:
            connection.execute("ROLLBACK")
            raise

    @contextmanager
    def connect(self):
        with self._lock:
            connection = duckdb.connect(str(self.path))
            try:
                yield connection
            finally:
                connection.close()

    def replace_dataset(self, dataset: Dataset) -> None:
        key = [dataset.asset, dataset.source, dataset.market, dataset.timeframe]
        with self.connect() as db:
            existing = db.execute("SELECT time, open, high, low, close FROM candles WHERE asset=? AND source=? AND market=? AND timeframe=?", key).fetchall()
            previous = {int(row[0]): tuple(float(value) for value in row[1:]) for row in existing}
            revisions = [candle.time for candle in dataset.candles if candle.time in previous and previous[candle.time] != (candle.open, candle.high, candle.low, candle.close)]
            if revisions:
                raise RuntimeError(f"Provider revision detected in {len(revisions)} completed candle(s); first={revisions[0]}")
            db.execute("BEGIN TRANSACTION")
            try:
                db.execute("DELETE FROM candles WHERE asset=? AND source=? AND market=? AND timeframe=?", key)
                db.executemany("INSERT INTO candles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [(dataset.asset, dataset.source, dataset.market, dataset.timeframe, c.time, c.open, c.high, c.low, c.close, c.volume, c.complete, dataset.retrieved_at, dataset.raw_checksum) for c in dataset.candles])
                db.execute("DELETE FROM datasets WHERE asset=? AND source=? AND market=? AND timeframe=?", key)
                db.execute("INSERT INTO datasets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [dataset.asset, dataset.source, dataset.market, dataset.timeframe, dataset.retrieved_at, dataset.checksum, dataset.raw_checksum, dataset.warning, dataset.candles[0].time if dataset.candles else None, dataset.candles[-1].time if dataset.candles else None, len(dataset.candles)])
                db.execute("COMMIT")
            except Exception:
                db.execute("ROLLBACK")
                raise

    def replace_engine_output(self, dataset: Dataset, output: dict) -> None:
        key = [dataset.asset, dataset.source, dataset.market, dataset.timeframe]
        times = [candle.time for candle in dataset.candles]
        with self.connect() as db:
            db.execute("BEGIN TRANSACTION")
            try:
                db.execute("DELETE FROM indicator_series WHERE asset=? AND source=? AND market=? AND timeframe=?", key)
                db.execute("DELETE FROM signal_reports WHERE asset=? AND source=? AND market=? AND timeframe=?", key)
                rows = []
                for snapshot in output["snapshots"]:
                    overlay_values: dict[int, dict[str, float]] = {}
                    for overlay in snapshot.get("overlays", []):
                        for point in overlay.get("points", []):
                            overlay_values.setdefault(int(point["time"]), {})[overlay["name"]] = point["value"]
                    prior = None
                    for index, state in enumerate(snapshot["states"]):
                        if state is None: continue
                        flip = prior is not None and state != prior
                        values = overlay_values.get(times[index], {})
                        if index == len(times) - 1: values = {**values, **snapshot.get("values", {})}
                        rows.append((dataset.asset, dataset.source, dataset.market, dataset.timeframe, snapshot["id"], times[index], state, prior, flip, times[index], times[index + 1] if index + 1 < len(times) else None, snapshot["thresholdKind"], json.dumps(values)))
                        prior = state
                    report = {key: value for key, value in snapshot.items() if key not in {"states", "overlays"}}
                    db.execute("INSERT INTO signal_reports (asset,source,market,timeframe,indicator_id,payload) VALUES (?,?,?,?,?,?)", [*key, snapshot["id"], json.dumps(report)])
                if rows: db.executemany("INSERT INTO indicator_series VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
                db.execute("INSERT OR REPLACE INTO research_reports (report_id,payload) VALUES (?,?)", [f"backtests:{dataset.asset}:{dataset.source}:{dataset.timeframe}", json.dumps({"asset": dataset.asset, "source": dataset.source, "market": dataset.market, "timeframe": dataset.timeframe, "costSensitivity": output["backtests"], "familyAgreement": output["familyAgreement"], "buyAndHold": output["buyAndHold"], "rollingFourYear": output["rollingFourYear"]})])
                db.execute("COMMIT")
            except Exception:
                db.execute("ROLLBACK")
                raise

    def health(self, asset: str, source: str, status: str, message: str, daily_last: int | None = None, weekly_last: int | None = None) -> None:
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO source_health (asset,source,checked_at,status,message,daily_last,weekly_last) VALUES (?,?,current_timestamp,?,?,?,?)", [asset, source, status, message, daily_last, weekly_last])

    def save_report(self, report_id: str, payload: dict) -> None:
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO research_reports (report_id,payload) VALUES (?,?)", [report_id, json.dumps(payload)])

    def rows(self, query: str, parameters: list | None = None) -> list[dict]:
        with self.connect() as db:
            cursor = db.execute(query, parameters or [])
            names = [item[0] for item in cursor.description]
            return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]

    def candles(self, asset: str, source: str, timeframe: str, limit: int = 1000) -> list[dict]:
        return list(reversed(self.rows("SELECT time,open,high,low,close,volume,complete,retrieved_at,raw_checksum FROM candles WHERE asset=? AND source=? AND timeframe=? ORDER BY time DESC LIMIT ?", [asset, source, timeframe, limit])))

    def series(self, asset: str, source: str, timeframe: str, indicator: str) -> list[dict]:
        return self.rows("SELECT time,state,prior_state,is_flip,confirmed_at,effective_at,threshold_kind,values FROM indicator_series WHERE asset=? AND source=? AND timeframe=? AND indicator_id=? ORDER BY time", [asset, source, timeframe, indicator])

    def matrix(self, asset: str, source: str, timeframe: str) -> list[dict]:
        return self.rows("SELECT s.indicator_id,s.state,s.prior_state,s.time AS candle_close,r.payload FROM indicator_series s JOIN signal_reports r USING(asset,source,market,timeframe,indicator_id) WHERE s.asset=? AND s.source=? AND s.timeframe=? QUALIFY row_number() OVER(PARTITION BY s.indicator_id ORDER BY s.time DESC)=1 ORDER BY s.indicator_id", [asset, source, timeframe])
