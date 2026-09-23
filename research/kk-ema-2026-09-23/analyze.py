"""Compare the seven printed Larsson Line values with candidate daily EMAs."""

import json
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
META = json.loads((HERE / "provenance.json").read_text())
DECIMALS = {"btc": 2, "eth": 2, "sol": 2, "ray": 4, "doge": 5, "sui": 4, "jup": 6}


def ema(values, length):
    result = values[0]
    alpha = 2 / (length + 1)
    for value in values[1:]:
        result += alpha * (value - result)
    return result


def values_through(rows, date):
    end = int(datetime.fromisoformat(date).replace(tzinfo=timezone.utc).timestamp() * 1000)
    filtered = [row for row in rows if row["time"] <= end]
    assert filtered and filtered[-1]["time"] == end, date
    return filtered


def src(row, name):
    if name == "hl2":
        return (row["high"] + row["low"]) / 2
    if name == "hlc3":
        return (row["high"] + row["low"] + row["close"]) / 3
    if name == "ohlc4":
        return (row["open"] + row["high"] + row["low"] + row["close"]) / 4
    return row[name]


def main():
    result = {}
    pooled = {0: {}, 1: {}}
    for asset, spec in META.items():
        rows = values_through(json.loads((HERE / f"{asset}-daily.json").read_text()), spec["crosshair"])
        resolution = 10 ** -DECIMALS[asset]
        expected = spec["displayed"]
        all_sources = {}
        for source in ("close", "open", "high", "low", "hl2", "hlc3", "ohlc4"):
            prices = [src(r, source) for r in rows]
            actual = [ema(prices, n) for n in (32, 58)]
            alternatives = []
            for boundary, target in enumerate(expected):
                ranked = sorted(((n, ema(prices, n)) for n in range(20, 76)), key=lambda x: abs(x[1] - target))
                alternatives.append([dict(length=n, value=v, errorTicks=abs(v-target)/resolution) for n, v in ranked[:5]])
            all_sources[source] = dict(values=actual, errorTicks=[(v-x)/resolution for v, x in zip(actual, expected)], nearestLengths=alternatives)
        closes = [row["close"] for row in rows]
        ordering = [ema(closes, n) for n in (32, 34, 48, 58)]
        state = "gold" if all(a > b for a, b in zip(ordering, ordering[1:])) else "purple" if all(a < b for a, b in zip(ordering, ordering[1:])) else "grey"
        if asset not in ("sol", "ray"):
            for edge in (0, 1):
                pooled[edge][asset] = [(n, abs(ema(closes, n)-expected[edge])/expected[edge]) for n in range(20, 76)]
        dates = [r["time"] for r in rows]
        continuity = sum(b-a != 86_400_000 for a,b in zip(dates, dates[1:]))
        result[asset] = dict(crosshair=spec["crosshair"], expected=expected, quote=spec["symbol"], source=spec["source"], rowsToCrosshair=len(rows), discontinuitiesToCrosshair=continuity, currentFourEma=ordering, currentColor=state, sources=all_sources)
        print(asset, "n", len(rows), "close32/58", all_sources["close"]["values"], "ticks", all_sources["close"]["errorTicks"], "closest", [[x["length"] for x in pair[:3]] for pair in all_sources["close"]["nearestLengths"]], flush=True)
    ranking = {}
    for edge, label in ((0, "fast"), (1, "slow")):
        scores = [(n, sum(dict(pooled[edge][asset])[n] for asset in pooled[edge]) / len(pooled[edge])) for n in range(20, 76)]
        ranking[label] = sorted((dict(length=n, meanRelativeError=score) for n, score in scores), key=lambda x: x["meanRelativeError"])
    (HERE / "results.json").write_text(json.dumps(dict(assets=result, pooledExactVenueLengthRanking=ranking), indent=2))


if __name__ == "__main__":
    main()
