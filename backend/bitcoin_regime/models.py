from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json


@dataclass(frozen=True, slots=True)
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    complete: bool = True

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class Dataset:
    asset: str
    source: str
    market: str
    timeframe: str
    candles: list[Candle]
    retrieved_at: str
    checksum: str
    raw_checksum: str
    provisional: Candle | None = None
    warning: str | None = None

    @classmethod
    def create(cls, asset: str, source: str, market: str, timeframe: str, candles: list[Candle], raw: bytes, provisional: Candle | None = None) -> "Dataset":
        normalized = json.dumps([c.as_dict() for c in candles], sort_keys=True, separators=(",", ":")).encode()
        return cls(asset, source, market, timeframe, candles, datetime.now(timezone.utc).isoformat(), sha256(normalized).hexdigest(), sha256(raw).hexdigest(), provisional)
