from pathlib import Path

from backend.bitcoin_regime.models import Candle, Dataset
from backend.bitcoin_regime.providers import DAY_MS, DataQualityError, aggregate_weekly, validate
from backend.bitcoin_regime.repository import Repository
from backend.bitcoin_regime.service import ResearchService


def candles(count: int = 420) -> list[Candle]:
    monday = 1_704_067_200_000
    return [Candle(monday + index * DAY_MS, 100 + index, 103 + index, 99 + index, 102 + index, 10) for index in range(count)]


def test_weekly_aggregation_and_incomplete_exclusion():
    weekly = aggregate_weekly(candles(10))
    assert len(weekly) == 1
    assert weekly[0].open == 100
    assert weekly[0].close == 108
    assert weekly[0].volume == 70


def test_quality_failures_are_not_forward_filled():
    rows = candles(3)
    rows[2] = Candle(rows[2].time + DAY_MS, rows[2].open, rows[2].high, rows[2].low, rows[2].close, rows[2].volume)
    try:
        validate(rows, DAY_MS)
    except DataQualityError as error:
        assert "Gap" in str(error)
    else:
        raise AssertionError("Gap should be a hard failure")


def test_duckdb_provenance_and_signal_round_trip(tmp_path: Path):
    repository = Repository(tmp_path / "test.duckdb")
    dataset = Dataset.create("test", "BTC/USD", "1d", candles(), b"raw response")
    repository.replace_dataset(dataset)
    stored = repository.candles("test", "1d", 2)
    assert len(stored) == 2
    assert stored[-1]["raw_checksum"] == dataset.raw_checksum

    service = ResearchService(tmp_path / "engine.duckdb")
    output = service._engine(dataset)
    assert len(output["snapshots"]) >= 15
    assert {"5", "15", "30"} == set(output["backtests"])
    assert output["buyAndHold"]["maxDrawdown"] <= 0
    service.repository.replace_dataset(dataset)
    service.repository.replace_engine_output(dataset, output)
    assert service.repository.matrix("test", "1d")
