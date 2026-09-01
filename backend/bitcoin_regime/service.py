from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import asyncio
import json
import os
import subprocess
from statistics import median

from .models import Candle, Dataset
from .providers import MARKETS, PROVIDERS, aggregate_weekly, kraken
from .repository import Repository

ROOT = Path(__file__).resolve().parents[2]


class ResearchService:
    def __init__(self, database: str | Path | None = None):
        self.repository = Repository(database or os.getenv("REGIME_DB", ROOT / "data" / "regimes.duckdb"))
        self._refresh_lock = asyncio.Lock()

    def registry(self) -> list[dict]:
        process = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "scripts" / "registry.ts")], cwd=ROOT, check=True, capture_output=True, text=True)
        return json.loads(process.stdout)

    def _engine(self, dataset: Dataset) -> dict:
        payload = json.dumps({"asset": dataset.asset, "timeframe": dataset.timeframe, "candles": [candle.as_dict() for candle in dataset.candles], "costs": [5, 15, 30]}, separators=(",", ":"))
        process = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "scripts" / "calculate-signals.ts")], cwd=ROOT, input=payload, check=True, capture_output=True, text=True)
        return json.loads(process.stdout)

    def _persist(self, dataset: Dataset) -> None:
        self.repository.replace_dataset(dataset)
        self.repository.replace_engine_output(dataset, self._engine(dataset))

    def refresh_source(self, asset: str, source: str) -> dict:
        try:
            daily = PROVIDERS[source](asset)
            self._persist(daily)
            weekly = Dataset.create(asset, daily.source, daily.market, "1w", aggregate_weekly(daily.candles), b"aggregate:" + daily.checksum.encode())
            self._persist(weekly)
            message = "Completed daily data and Monday-Sunday UTC aggregates refreshed"
            if source == "kraken":
                native = kraken(asset, 10080)
                if weekly.candles and native.candles and abs(weekly.candles[-1].close - native.candles[-1].close) > 0.01:
                    raise RuntimeError("Aggregated and native Kraken weekly closes disagree")
                message += "; native weekly cross-check passed"
            self.repository.health(asset, source, "healthy", message, daily.candles[-1].time, weekly.candles[-1].time)
            return {"asset": asset, "source": source, "status": "healthy", "daily": len(daily.candles), "weekly": len(weekly.candles)}
        except Exception as error:
            self.repository.health(asset, source, "failed", str(error))
            return {"asset": asset, "source": source, "status": "failed", "error": str(error)}

    async def refresh_all(self) -> list[dict]:
        async with self._refresh_lock:
            results = []
            for asset in MARKETS:
                for source in MARKETS[asset]:
                    results.append(await asyncio.to_thread(self.refresh_source, asset, source))
            for asset in MARKETS:
                for timeframe in ("1d", "1w"):
                    await asyncio.to_thread(self._cross_venue_report, asset, timeframe)
            return results

    def _cross_venue_report(self, asset: str, timeframe: str) -> None:
        datasets = self.repository.rows("SELECT source,market,first_candle,last_candle FROM datasets WHERE asset=? AND timeframe=? ORDER BY source", [asset, timeframe])
        if len(datasets) < 2: return
        common_start = max(int(row["first_candle"]) for row in datasets)
        common_end = min(int(row["last_candle"]) for row in datasets)
        venues: dict[str, list[dict]] = {}
        for metadata in datasets:
            rows = self.repository.rows("SELECT time,open,high,low,close,volume,complete FROM candles WHERE asset=? AND source=? AND timeframe=? AND time BETWEEN ? AND ? ORDER BY time", [asset, metadata["source"], timeframe, common_start, common_end])
            candles = [Candle(int(row["time"]), float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"]), float(row["volume"]), bool(row["complete"])) for row in rows]
            if len(candles) < 100: continue
            dataset = Dataset.create(asset, metadata["source"], metadata["market"], timeframe, candles, b"equal-date")
            venues[metadata["source"]] = self._engine(dataset)["backtests"]["15"]
        grouped: dict[str, list[dict]] = {}
        for results in venues.values():
            for row in results: grouped.setdefault(row["indicatorId"], []).append(row)
        ranking = []
        for indicator, rows in grouped.items():
            ranking.append({"indicatorId": indicator, "displayName": rows[0]["displayName"], "venues": len(rows), "medianCalmar": median(row["calmar"] for row in rows if row["calmar"] is not None) if any(row["calmar"] is not None for row in rows) else None, "medianCagr": median(row["cagr"] for row in rows), "medianMaxDrawdown": median(row["maxDrawdown"] for row in rows)})
        ranking.sort(key=lambda row: row["medianCalmar"] if row["medianCalmar"] is not None else float("-inf"), reverse=True)
        pareto = [row["indicatorId"] for row in ranking if not any(other["medianCagr"] >= row["medianCagr"] and abs(other["medianMaxDrawdown"]) <= abs(row["medianMaxDrawdown"]) and (other["medianCagr"] > row["medianCagr"] or abs(other["medianMaxDrawdown"]) < abs(row["medianMaxDrawdown"])) for other in ranking)]
        self.repository.save_report(f"cross-venue:{asset}:{timeframe}", {"asset": asset, "timeframe": timeframe, "equalDate": {"start": common_start, "end": common_end}, "costBps": 15, "rankingMethod": "Median cross-venue Calmar", "ranking": ranking, "paretoSet": pareto, "universalWinnerDeclared": False})

    async def scheduler(self) -> None:
        while True:
            now = datetime.now(timezone.utc)
            target = now.replace(hour=0, minute=15, second=0, microsecond=0)
            if target <= now: target += timedelta(days=1)
            await asyncio.sleep((target - now).total_seconds())
            await self.refresh_all()
