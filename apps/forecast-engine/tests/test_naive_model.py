"""Tests for Naive forecast model."""

import numpy as np
import pytest

from src.models.base import BacktestMetrics
from src.models.naive.naive_model import NaiveModel


@pytest.fixture
def naive_model() -> NaiveModel:
    return NaiveModel(lookback=12, seed=42)


@pytest.fixture
def stable_series() -> np.ndarray:
    """Stable series around 100."""
    rng = np.random.default_rng(42)
    return 100.0 + rng.normal(0, 5, 52)


@pytest.fixture
def trending_series() -> np.ndarray:
    """Upward trending series."""
    return np.linspace(50, 150, 52, dtype=np.float64)


class TestNaiveModel:
    def test_name(self, naive_model: NaiveModel) -> None:
        assert naive_model.name == "NAIVE"

    @pytest.mark.asyncio
    async def test_train(
        self, naive_model: NaiveModel, stable_series: np.ndarray
    ) -> None:
        result = await naive_model.train(
            ["p1"], series_by_product={"p1": stable_series}
        )
        assert result.model_name == "NAIVE"
        assert result.version == 1

    @pytest.mark.asyncio
    async def test_predict_returns_quantiles(
        self, naive_model: NaiveModel, stable_series: np.ndarray
    ) -> None:
        await naive_model.train(["p1"], series_by_product={"p1": stable_series})
        results = await naive_model.predict(["p1"], 4)

        assert len(results) == 1
        assert len(results[0].quantiles) == 4
        assert results[0].model_name == "NAIVE"

    @pytest.mark.asyncio
    async def test_predict_p50_equals_last_value(
        self, naive_model: NaiveModel, stable_series: np.ndarray
    ) -> None:
        await naive_model.train(["p1"], series_by_product={"p1": stable_series})
        results = await naive_model.predict(["p1"], 4)

        last_value = round(stable_series[-1], 2)
        for q in results[0].quantiles:
            assert float(q.p50) == last_value

    @pytest.mark.asyncio
    async def test_quantile_ordering(
        self, naive_model: NaiveModel, stable_series: np.ndarray
    ) -> None:
        await naive_model.train(["p1"], series_by_product={"p1": stable_series})
        results = await naive_model.predict(["p1"], 4)

        for q in results[0].quantiles:
            assert q.p10 <= q.p25 <= q.p50 <= q.p75 <= q.p90

    @pytest.mark.asyncio
    async def test_predict_unfitted_returns_empty(
        self, naive_model: NaiveModel
    ) -> None:
        results = await naive_model.predict(["unknown"], 4)
        assert results[0].quantiles == []

    @pytest.mark.asyncio
    async def test_backtest_returns_metrics(
        self, naive_model: NaiveModel, stable_series: np.ndarray
    ) -> None:
        metrics = await naive_model.backtest(
            ["p1"], 8, series_by_product={"p1": stable_series}
        )
        assert "p1" in metrics
        m = metrics["p1"]
        assert isinstance(m, BacktestMetrics)
        assert m.mae >= 0
        assert m.rmse >= 0

    @pytest.mark.asyncio
    async def test_backtest_skips_short_series(
        self, naive_model: NaiveModel
    ) -> None:
        metrics = await naive_model.backtest(
            ["p1"], 13, series_by_product={"p1": np.array([1.0, 2.0])}
        )
        assert "p1" not in metrics

    @pytest.mark.asyncio
    async def test_constant_series_zero_spread(self, naive_model: NaiveModel) -> None:
        constant = np.full(20, 100.0)
        await naive_model.train(["p1"], series_by_product={"p1": constant})
        results = await naive_model.predict(["p1"], 2)

        for q in results[0].quantiles:
            assert q.p10 == q.p50 == q.p90
