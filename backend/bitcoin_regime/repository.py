from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import json
from threading import RLock

import duckdb

from .models import Dataset


SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
  source VARCHAR, market VARCHAR, timeframe VARCHAR, retrieved_at TIMESTAMPTZ,
  normalized_checksum VARCHAR, raw_checksum VARCHAR, warning VARCHAR,
  first_candle BIGINT, last_candle BIGINT, candle_count INTEGER,
  PRIMARY KEY (source, market, timeframe)
);
CREATE TABLE IF NOT EXISTS candles (
  source VARCHAR, market VARCHAR, timeframe VARCHAR, time BIGINT,
  open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume DOUBLE,
  complete BOOLEAN, retrieved_at TIMESTAMPTZ, raw_checksum VARCHAR,
  PRIMARY KEY (source, market, timeframe, time)
);
CREATE TABLE IF NOT EXISTS indicator_series (
  source VARCHAR, market VARCHAR, timeframe VARCHAR, indicator_id VARCHAR, time BIGINT,
  state VARCHAR, prior_state VARCHAR, is_flip BOOLEAN, confirmed_at BIGINT,
  effective_at BIGINT, threshold_kind VARCHAR, values JSON,
  PRIMARY KEY (source, market, timeframe, indicator_id, time)
);
CREATE TABLE IF NOT EXISTS signal_reports (
  source VARCHAR, market VARCHAR, timeframe VARCHAR, indicator_id VARCHAR,
  generated_at TIMESTAMPTZ DEFAULT current_timestamp, payload JSON,
  PRIMARY KEY (source, market, timeframe, indicator_id)
);
CREATE TABLE IF NOT EXISTS research_reports (
  report_id VARCHAR PRIMARY KEY, generated_at TIMESTAMPTZ DEFAULT current_timestamp, payload JSON
);
CREATE TABLE IF NOT EXISTS source_health (
  source VARCHAR PRIMARY KEY, checked_at TIMESTAMPTZ DEFAULT current_timestamp,
  status VARCHAR, message VARCHAR, daily_last BIGINT, weekly_last BIGINT
);
"""


class Repository:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        with self.connect() as connection:
            connection.execute(SCHEMA)

    @contextmanager
    def connect(self):
        with self._lock:
            connection = duckdb.connect(str(self.path))
            try:
                yield connection
            finally:
                connection.close()

    def replace_dataset(self, dataset: Dataset) -> None:
        key = [dataset.source, dataset.market, dataset.timeframe]
        with self.connect() as db:
            existing = db.execute("SELECT time, open, high, low, close FROM candles WHERE source=? AND market=? AND timeframe=?", key).fetchall()
            previous = {int(row[0]): tuple(float(value) for value in row[1:]) for row in existing}
            revisions = [candle.time for candle in dataset.candles if candle.time in previous and previous[candle.time] != (candle.open, candle.high, candle.low, candle.close)]
            if revisions:
                raise RuntimeError(f"Provider revision detected in {len(revisions)} completed candle(s); first={revisions[0]}")
            db.execute("BEGIN TRANSACTION")
            try:
                db.execute("DELETE FROM candles WHERE source=? AND market=? AND timeframe=?", key)
                db.executemany("INSERT INTO candles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [(dataset.source, dataset.market, dataset.timeframe, c.time, c.open, c.high, c.low, c.close, c.volume, c.complete, dataset.retrieved_at, dataset.raw_checksum) for c in dataset.candles])
                db.execute("DELETE FROM datasets WHERE source=? AND market=? AND timeframe=?", key)
                db.execute("INSERT INTO datasets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [dataset.source, dataset.market, dataset.timeframe, dataset.retrieved_at, dataset.checksum, dataset.raw_checksum, dataset.warning, dataset.candles[0].time if dataset.candles else None, dataset.candles[-1].time if dataset.candles else None, len(dataset.candles)])
                db.execute("COMMIT")
            except Exception:
                db.execute("ROLLBACK")
                raise

    def replace_engine_output(self, dataset: Dataset, output: dict) -> None:
        key = [dataset.source, dataset.market, dataset.timeframe]
        times = [candle.time for candle in dataset.candles]
        with self.connect() as db:
            db.execute("BEGIN TRANSACTION")
            try:
                db.execute("DELETE FROM indicator_series WHERE source=? AND market=? AND timeframe=?", key)
                db.execute("DELETE FROM signal_reports WHERE source=? AND market=? AND timeframe=?", key)
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
                        rows.append((dataset.source, dataset.market, dataset.timeframe, snapshot["id"], times[index], state, prior, flip, times[index], times[index + 1] if index + 1 < len(times) else None, snapshot["thresholdKind"], json.dumps(values)))
                        prior = state
                    report = {key: value for key, value in snapshot.items() if key not in {"states", "overlays"}}
                    db.execute("INSERT INTO signal_reports (source,market,timeframe,indicator_id,payload) VALUES (?,?,?,?,?)", [*key, snapshot["id"], json.dumps(report)])
                if rows: db.executemany("INSERT INTO indicator_series VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
                db.execute("INSERT OR REPLACE INTO research_reports (report_id,payload) VALUES (?,?)", [f"backtests:{dataset.source}:{dataset.timeframe}", json.dumps({"source": dataset.source, "market": dataset.market, "timeframe": dataset.timeframe, "costSensitivity": output["backtests"], "familyAgreement": output["familyAgreement"], "buyAndHold": output["buyAndHold"], "rollingFourYear": output["rollingFourYear"]})])
                db.execute("COMMIT")
            except Exception:
                db.execute("ROLLBACK")
                raise

    def health(self, source: str, status: str, message: str, daily_last: int | None = None, weekly_last: int | None = None) -> None:
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO source_health (source,checked_at,status,message,daily_last,weekly_last) VALUES (?,current_timestamp,?,?,?,?)", [source, status, message, daily_last, weekly_last])

    def save_report(self, report_id: str, payload: dict) -> None:
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO research_reports (report_id,payload) VALUES (?,?)", [report_id, json.dumps(payload)])

    def rows(self, query: str, parameters: list | None = None) -> list[dict]:
        with self.connect() as db:
            cursor = db.execute(query, parameters or [])
            names = [item[0] for item in cursor.description]
            return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]

    def candles(self, source: str, timeframe: str, limit: int = 1000) -> list[dict]:
        return list(reversed(self.rows("SELECT time,open,high,low,close,volume,complete,retrieved_at,raw_checksum FROM candles WHERE source=? AND timeframe=? ORDER BY time DESC LIMIT ?", [source, timeframe, limit])))

    def series(self, source: str, timeframe: str, indicator: str) -> list[dict]:
        return self.rows("SELECT time,state,prior_state,is_flip,confirmed_at,effective_at,threshold_kind,values FROM indicator_series WHERE source=? AND timeframe=? AND indicator_id=? ORDER BY time", [source, timeframe, indicator])

    def matrix(self, source: str, timeframe: str) -> list[dict]:
        return self.rows("SELECT s.indicator_id,s.state,s.prior_state,s.time AS candle_close,r.payload FROM indicator_series s JOIN signal_reports r USING(source,market,timeframe,indicator_id) WHERE s.source=? AND s.timeframe=? QUALIFY row_number() OVER(PARTITION BY s.indicator_id ORDER BY s.time DESC)=1 ORDER BY s.indicator_id", [source, timeframe])
