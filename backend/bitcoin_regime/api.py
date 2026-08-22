from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio
import json

from fastapi import FastAPI, HTTPException, Query

from .service import ResearchService

service = ResearchService()


@asynccontextmanager
async def lifespan(_: FastAPI):
    refresh = asyncio.create_task(service.refresh_all())
    schedule = asyncio.create_task(service.scheduler())
    yield
    refresh.cancel(); schedule.cancel()


app = FastAPI(title="BTC Regime Lab Research API", version="0.1.0", lifespan=lifespan)


@app.get("/api/v1/registry")
def registry():
    return {"indicators": service.registry()}


@app.get("/api/v1/candles")
def candles(source: str = "bitstamp", timeframe: str = "1w", limit: int = Query(1000, ge=1, le=10000)):
    return {"source": source, "timeframe": timeframe, "candles": service.repository.candles(source, timeframe, limit)}


@app.get("/api/v1/indicators/{indicator_id}")
def indicator_series(indicator_id: str, source: str = "bitstamp", timeframe: str = "1w"):
    series = service.repository.series(source, timeframe, indicator_id)
    if not series: raise HTTPException(404, "No stored series for this source, timeframe, and indicator")
    return {"source": source, "timeframe": timeframe, "indicator": indicator_id, "series": series}


@app.get("/api/v1/states")
def states(source: str = "bitstamp", timeframe: str = "1w"):
    rows = service.repository.matrix(source, timeframe)
    for row in rows:
        row["payload"] = json.loads(row["payload"])
    return {"source": source, "timeframe": timeframe, "states": rows}


@app.get("/api/v1/flips")
def flips(source: str = "bitstamp", timeframe: str = "1w", indicator: str | None = None):
    sql = "SELECT indicator_id,time,prior_state,state,confirmed_at,effective_at FROM indicator_series WHERE source=? AND timeframe=? AND is_flip"
    params: list = [source, timeframe]
    if indicator: sql += " AND indicator_id=?"; params.append(indicator)
    sql += " ORDER BY time"
    return {"flips": service.repository.rows(sql, params)}


@app.get("/api/v1/triggers")
def triggers(source: str = "bitstamp", timeframe: str = "1w"):
    rows = service.repository.rows("SELECT indicator_id,generated_at,payload FROM signal_reports WHERE source=? AND timeframe=? ORDER BY indicator_id", [source, timeframe])
    for row in rows: row["payload"] = json.loads(row["payload"])
    return {"source": source, "timeframe": timeframe, "triggers": rows}


@app.get("/api/v1/health")
def health():
    return {"sources": service.repository.rows("SELECT * FROM source_health ORDER BY source")}


@app.get("/api/v1/reports")
def reports():
    rows = service.repository.rows("SELECT report_id,generated_at,payload FROM research_reports ORDER BY report_id")
    for row in rows: row["payload"] = json.loads(row["payload"])
    return {"reports": rows}


@app.post("/api/v1/refresh")
async def refresh():
    return {"results": await service.refresh_all()}
