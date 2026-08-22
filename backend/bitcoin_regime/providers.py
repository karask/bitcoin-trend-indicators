from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import Candle, Dataset

DAY_MS = 86_400_000


class DataQualityError(RuntimeError):
    pass


def _json(url: str, headers: dict[str, str] | None = None) -> tuple[object, bytes]:
    request = Request(url, headers=headers or {"User-Agent": "BTC-Regime-Lab/1.0"})
    with urlopen(request, timeout=20) as response:
        raw = response.read()
    return json.loads(raw), raw


def validate(candles: list[Candle], step_ms: int) -> list[Candle]:
    clean: list[Candle] = []
    for candle in sorted(candles, key=lambda item: item.time):
        if min(candle.open, candle.close) < candle.low or max(candle.open, candle.close) > candle.high or candle.low > candle.high:
            raise DataQualityError(f"Malformed OHLC at {candle.time}")
        if clean and candle.time == clean[-1].time:
            raise DataQualityError(f"Duplicate candle at {candle.time}")
        if clean and candle.time - clean[-1].time > step_ms * 1.5:
            raise DataQualityError(f"Gap after {clean[-1].time}")
        clean.append(candle)
    return clean


def aggregate_weekly(daily: list[Candle]) -> list[Candle]:
    groups: dict[int, list[Candle]] = {}
    for candle in daily:
        date = datetime.fromtimestamp(candle.time / 1000, timezone.utc)
        monday = datetime(date.year, date.month, date.day, tzinfo=timezone.utc) - timedelta(days=date.weekday())
        groups.setdefault(int(monday.timestamp() * 1000), []).append(candle)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result: list[Candle] = []
    for monday, rows in sorted(groups.items()):
        rows.sort(key=lambda item: item.time)
        expected = [monday + index * DAY_MS for index in range(7)]
        if len(rows) != 7 or [item.time for item in rows] != expected or datetime.fromtimestamp((monday + 7 * DAY_MS) / 1000, timezone.utc) > today:
            continue
        result.append(Candle(monday, rows[0].open, max(item.high for item in rows), min(item.low for item in rows), rows[-1].close, sum(item.volume for item in rows)))
    return result


def bitstamp() -> Dataset:
    found: dict[int, Candle] = {}; raw_parts: list[bytes] = []
    end = int(datetime.now(timezone.utc).timestamp())
    for _ in range(7):
        url = "https://www.bitstamp.net/api/v2/ohlc/btcusd/?" + urlencode({"step": 86400, "limit": 1000, "end": end, "exclude_current_candle": "true"})
        body, raw = _json(url); raw_parts.append(raw)
        rows = body.get("data", {}).get("ohlc", [])
        for row in rows:
            time = int(row["timestamp"]) * 1000
            found[time] = Candle(time, float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"]), float(row["volume"]))
        if len(rows) < 1000: break
        end = min(int(row["timestamp"]) for row in rows) - 1
    candles = validate(list(found.values()), DAY_MS)
    return Dataset.create("bitstamp", "BTC/USD", "1d", candles, b"".join(raw_parts))


def binance() -> Dataset:
    candles: list[Candle] = []; raw_parts: list[bytes] = []; start = int(datetime(2017, 8, 17, tzinfo=timezone.utc).timestamp() * 1000)
    for _ in range(5):
        body, raw = _json("https://api.binance.com/api/v3/klines?" + urlencode({"symbol": "BTCUSDT", "interval": "1d", "limit": 1000, "startTime": start})); raw_parts.append(raw)
        if not body: break
        candles.extend(Candle(int(row[0]), float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])) for row in body)
        start = int(body[-1][0]) + DAY_MS
        if len(body) < 1000: break
    today = int(datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
    return Dataset.create("binance", "BTC/USDT", "1d", validate([item for item in candles if item.time < today], DAY_MS), b"".join(raw_parts))


def kraken(interval: int = 1440) -> Dataset:
    body, raw = _json(f"https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval={interval}")
    if body.get("error"): raise DataQualityError(", ".join(body["error"]))
    key = next(key for key in body["result"] if key != "last")
    rows = body["result"][key]
    completed, provisional = rows[:-1], rows[-1]
    candles = [Candle(int(row[0]) * 1000, float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[6])) for row in completed]
    pending = Candle(int(provisional[0]) * 1000, float(provisional[1]), float(provisional[2]), float(provisional[3]), float(provisional[4]), float(provisional[6]), False)
    timeframe = "1w" if interval == 10080 else "1d"
    return Dataset.create("kraken", "BTC/USD", timeframe, validate(candles, 7 * DAY_MS if timeframe == "1w" else DAY_MS), raw, pending)


def coinbase() -> Dataset:
    found: dict[int, Candle] = {}; raw_parts: list[bytes] = []; end = datetime.now(timezone.utc) - timedelta(days=1)
    for _ in range(8):
        start = end - timedelta(days=299)
        params = urlencode({"granularity": 86400, "start": start.isoformat(), "end": end.isoformat()})
        body, raw = _json("https://api.exchange.coinbase.com/products/BTC-USD/candles?" + params); raw_parts.append(raw)
        for row in body:
            time = int(row[0]) * 1000; found[time] = Candle(time, float(row[3]), float(row[2]), float(row[1]), float(row[4]), float(row[5]))
        if len(body) < 2: break
        end = datetime.fromtimestamp(min(int(row[0]) for row in body), timezone.utc) - timedelta(days=1)
    return Dataset.create("coinbase", "BTC/USD", "1d", validate(list(found.values()), DAY_MS), b"".join(raw_parts))


PROVIDERS = {"bitstamp": bitstamp, "binance": binance, "kraken": kraken, "coinbase": coinbase}
