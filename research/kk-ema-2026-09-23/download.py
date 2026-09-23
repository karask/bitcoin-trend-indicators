"""Archive daily candles for the 22 September charts analyzed on 23 September."""

import hashlib
import json
import shutil
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
REFERENCES = ROOT / "data/kk-research-2026-09-23/references"
REFERENCES.mkdir(parents=True, exist_ok=True)
DAY = 86_400_000
END = int(datetime(2026, 9, 23, tzinfo=timezone.utc).timestamp() * 1000)
SPECS = {
    "btc": ("image.png", "binance", "BTCUSDT", "2025-02-03", [100575.94, 98007.66]),
    "eth": ("image(1).png", "binance", "ETHUSDT", "2020-08-01", [277.79, 257.39]),
    "sol": ("image(2).png", "coinbase", "SOL-USD", "2023-11-15", [41.24, 34.89]),
    "ray": ("image(3).png", "binance-proxy", "RAYUSDT", "2023-06-07", [0.2098, 0.2178]),
    "doge": ("image(4).png", "coinbase", "DOGE-USD", "2023-05-03", [0.08155, 0.08139]),
    "sui": ("image(5).png", "binance", "SUIUSDC", "2025-01-05", [4.3143, 3.9011]),
    "jup": ("image(6).png", "bitstamp", "jupusd", "2025-05-27", [0.515302, 0.512712]),
}


def get(url):
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def binance(symbol, start):
    rows, urls = [], []
    while start < END:
        url = f"https://data-api.binance.vision/api/v3/klines?symbol={symbol}&interval=1d&startTime={start}&endTime={END-1}&limit=1000"
        batch = get(url)
        urls.append(url)
        if not batch:
            break
        rows.extend(dict(time=int(r[0]), open=float(r[1]), high=float(r[2]), low=float(r[3]), close=float(r[4])) for r in batch)
        start = int(batch[-1][0]) + DAY
        if len(batch) < 1000:
            break
        time.sleep(0.3)
    return rows, urls


def coinbase(symbol, start):
    rows, urls = [], []
    while start < END:
        stop = min(start + 250 * DAY, END)
        a = datetime.fromtimestamp(start / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        b = datetime.fromtimestamp(stop / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        url = f"https://api.exchange.coinbase.com/products/{symbol}/candles?granularity=86400&start={a}&end={b}"
        batch = get(url)
        urls.append(url)
        rows.extend(dict(time=int(r[0])*1000, low=float(r[1]), high=float(r[2]), open=float(r[3]), close=float(r[4])) for r in batch)
        start = stop
        time.sleep(0.3)
    return rows, urls


def bitstamp(symbol):
    start = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    url = f"https://www.bitstamp.net/api/v2/ohlc/{symbol}/?step=86400&limit=1000&start={start}"
    body = get(url)
    rows = [dict(time=int(r["timestamp"])*1000, open=float(r["open"]), high=float(r["high"]), low=float(r["low"]), close=float(r["close"])) for r in body["data"]["ohlc"]]
    return rows, [url]


def main():
    con = sqlite3.connect(f"file:{ROOT / 'data/bitcoin-regime.sqlite'}?mode=ro", uri=True)
    provenance = {}
    for asset, (filename, source, symbol, cross, values) in SPECS.items():
        original = Path("/home/kos/Downloads") / filename
        saved = REFERENCES / f"{asset}.png"
        shutil.copyfile(original, saved)
        image_sha256 = hashlib.sha256(saved.read_bytes()).hexdigest()
        if source in ("binance", "coinbase") and asset != "sui":
            local = [dict(zip(("time", "open", "high", "low", "close"), r)) for r in con.execute(
                "SELECT time,open,high,low,close FROM market_candles WHERE asset=? AND source=? AND timeframe='1d' ORDER BY time", (asset, source))]
            tail_start = local[-1]["time"] + DAY
            tail, urls = (binance(symbol, tail_start) if source == "binance" else coinbase(symbol, tail_start))
            rows = local + tail
        elif asset == "jup":
            rows, urls = bitstamp(symbol)
        else:
            initial = datetime(2023, 5, 1, tzinfo=timezone.utc) if asset == "sui" else datetime(2021, 1, 1, tzinfo=timezone.utc)
            rows, urls = binance(symbol, int(initial.timestamp() * 1000))
        rows = [r for r in rows if r["time"] < END]
        by_time = {r["time"]: r for r in rows}
        rows = [by_time[t] for t in sorted(by_time)]
        (HERE / f"{asset}-daily.json").write_text(json.dumps(rows))
        provenance[asset] = dict(image=str(saved.relative_to(ROOT)), imageSha256=image_sha256, chartLatestCandleDate="2026-09-22", screenshotFileDate="2026-09-23", source=source, symbol=symbol, crosshair=cross, displayed=values, urls=urls, candles=len(rows), first=datetime.fromtimestamp(rows[0]["time"]/1000, timezone.utc).date().isoformat(), last=datetime.fromtimestamp(rows[-1]["time"]/1000, timezone.utc).date().isoformat())
        print(asset, source, len(rows), provenance[asset]["first"], provenance[asset]["last"], flush=True)
    (HERE / "provenance.json").write_text(json.dumps(provenance, indent=2))


if __name__ == "__main__":
    main()
