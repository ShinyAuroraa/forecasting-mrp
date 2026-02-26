"""Tests for ETS (Holt-Winters) forecast model."""

import numpy as np
import pytest

from src.models.base import BacktestMetrics
from src.models.ets.ets_model import ETSModel, _select_variant


@pytest.fixture
def ets_model() -> ETSModel:
    return ETSModel(seasonal_periods=12, n_sim_paths=200, seed=42)


@pytest.fixture
def seasonal_series() -> np.ndarray:
    """52-week seasonal series with trend."""
    rng = np.random.default_rng(42)
    t = np.arange(104, dtype=np.float64)
    trend = 100 + 0.5 * t
    seasonal = 10 * np.sin(2 * np.pi * t / 12)
    noise = rng.normal(0, 3, 104)
    return trend + seasonal + noise


@pytest.fixture
def short_series() -> np.ndarray:
    """Short non-seasonal series."""
    rng = np.random.default_rng(42)
    return 50.0 + rng.normal(0, 5, 20)


class TestSelectVariant:
    def test_returns_dict_with_keys(self, seasonal_series: np.ndarray) -> None:
        config = _select_variant(seasonal_series, 12)
        assert "trend" in config
        assert "seasonal" in config
        assert "seasonal_periods" in config

    def test_seasonal_with_enough_data(self, seasonal_series: np.ndarray) -> None:
        config = _select_variant(seasonal_series, 12)
        assert config["seasonal"] in ("add", "mul")
        assert config["seasonal_periods"] == 12

    def test_no_seasonal_with_short_data(self, short_series: np.ndarray) -> None:
        config = _select_variant(short_series, 52)
        assert config["seasonal"] is None
        assert config["seasonal_periods"] is None


class TestETSTrain:
    @pytest.mark.asyncio
    async def test_train_returns_result(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        result = await ets_model.train(
            ["p1"], series_by_product={"p1": seasonal_series}
        )
        assert result.model_name == "ETS"
        assert result.version == 1

    @pytest.mark.asyncio
    async def test_train_skips_missing_product(self, ets_model: ETSModel) -> None:
        result = await ets_model.train(["p1"], series_by_product={})
        assert result.model_name == "ETS"

    @pytest.mark.asyncio
    async def test_train_skips_too_short_series(self, ets_model: ETSModel) -> None:
        result = await ets_model.train(
            ["p1"], series_by_product={"p1": np.array([1.0, 2.0])}
        )
        assert result.version == 1

    @pytest.mark.asyncio
    async def test_version_increments(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        await ets_model.train(["p1"], series_by_product={"p1": seasonal_series})
        result2 = await ets_model.train(
            ["p1"], series_by_product={"p1": seasonal_series}, force_retrain=True
        )
        assert result2.version == 2


class TestETSPredict:
    @pytest.mark.asyncio
    async def test_predict_returns_quantiles(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        await ets_model.train(["p1"], series_by_product={"p1": seasonal_series})
        results = await ets_model.predict(["p1"], 4)

        assert len(results) == 1
        assert results[0].produto_id == "p1"
        assert results[0].model_name == "ETS"
        assert len(results[0].quantiles) == 4

    @pytest.mark.asyncio
    async def test_quantile_ordering(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        await ets_model.train(["p1"], series_by_product={"p1": seasonal_series})
        results = await ets_model.predict(["p1"], 4)

        for q in results[0].quantiles:
            assert q.p10 <= q.p25 <= q.p50 <= q.p75 <= q.p90

    @pytest.mark.asyncio
    async def test_predict_unfitted_returns_empty(self, ets_model: ETSModel) -> None:
        results = await ets_model.predict(["unknown"], 4)
        assert len(results) == 1
        assert results[0].quantiles == []

    @pytest.mark.asyncio
    async def test_quantiles_are_non_negative(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        await ets_model.train(["p1"], series_by_product={"p1": seasonal_series})
        results = await ets_model.predict(["p1"], 8)

        for q in results[0].quantiles:
            assert q.p10 >= 0


class TestETSBacktest:
    @pytest.mark.asyncio
    async def test_backtest_returns_metrics(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        metrics = await ets_model.backtest(
            ["p1"], 13, series_by_product={"p1": seasonal_series}
        )
        assert "p1" in metrics
        m = metrics["p1"]
        assert isinstance(m, BacktestMetrics)
        assert m.mape >= 0
        assert m.mae >= 0
        assert m.rmse >= 0

    @pytest.mark.asyncio
    async def test_backtest_skips_short_series(self, ets_model: ETSModel) -> None:
        metrics = await ets_model.backtest(
            ["p1"], 13, series_by_product={"p1": np.array([1.0, 2.0, 3.0])}
        )
        assert "p1" not in metrics

    @pytest.mark.asyncio
    async def test_backtest_reasonable_mape(
        self, ets_model: ETSModel, seasonal_series: np.ndarray
    ) -> None:
        metrics = await ets_model.backtest(
            ["p1"], 13, series_by_product={"p1": seasonal_series}
        )
        assert metrics["p1"].mape < 50  # reasonable for synthetic data
