"""Tests for Croston and TSB forecast models."""

import numpy as np
import pytest

from src.models.base import BacktestMetrics
from src.models.croston.croston_model import (
    CrostonModel,
    CrostonVariant,
    _croston_fit,
    _tsb_fit,
)


@pytest.fixture
def intermittent_series() -> np.ndarray:
    """Intermittent demand: ~50% zeros."""
    rng = np.random.default_rng(42)
    series = np.zeros(52, dtype=np.float64)
    demand_periods = rng.choice(52, size=26, replace=False)
    series[demand_periods] = rng.uniform(5, 50, size=26)
    return series


@pytest.fixture
def lumpy_series() -> np.ndarray:
    """Lumpy demand: infrequent with high variance."""
    rng = np.random.default_rng(42)
    series = np.zeros(52, dtype=np.float64)
    demand_periods = rng.choice(52, size=10, replace=False)
    series[demand_periods] = rng.uniform(1, 200, size=10)
    return series


@pytest.fixture
def croston_classic() -> CrostonModel:
    return CrostonModel(variant=CrostonVariant.CLASSIC, n_bootstrap_paths=200, seed=42)


@pytest.fixture
def croston_sba() -> CrostonModel:
    return CrostonModel(variant=CrostonVariant.SBA, n_bootstrap_paths=200, seed=42)


@pytest.fixture
def tsb_model() -> CrostonModel:
    return CrostonModel(variant=CrostonVariant.TSB, n_bootstrap_paths=200, seed=42)


class TestCrostonFit:
    def test_classic_returns_positive_values(self, intermittent_series: np.ndarray) -> None:
        z_hat, p_hat = _croston_fit(intermittent_series, 0.1, CrostonVariant.CLASSIC)
        assert z_hat > 0
        assert p_hat >= 1.0

    def test_sba_applies_correction(self, intermittent_series: np.ndarray) -> None:
        z_classic, _ = _croston_fit(intermittent_series, 0.1, CrostonVariant.CLASSIC)
        z_sba, _ = _croston_fit(intermittent_series, 0.1, CrostonVariant.SBA)
        assert z_sba < z_classic  # SBA applies (1 - alpha/2) correction

    def test_handles_all_zeros(self) -> None:
        series = np.zeros(20, dtype=np.float64)
        z_hat, p_hat = _croston_fit(series, 0.1)
        assert z_hat == 0.0

    def test_handles_single_demand(self) -> None:
        series = np.zeros(20, dtype=np.float64)
        series[5] = 10.0
        z_hat, _ = _croston_fit(series, 0.1)
        assert z_hat == 10.0


class TestTSBFit:
    def test_returns_demand_and_probability(self, intermittent_series: np.ndarray) -> None:
        z_hat, p_hat = _tsb_fit(intermittent_series, 0.1, 0.1)
        assert z_hat > 0
        assert 0 < p_hat <= 1.0

    def test_all_zeros_gives_zero_demand(self) -> None:
        series = np.zeros(20, dtype=np.float64)
        z_hat, p_hat = _tsb_fit(series, 0.1, 0.1)
        assert z_hat == 0.0


class TestCrostonModelName:
    def test_classic_name(self, croston_classic: CrostonModel) -> None:
        assert croston_classic.name == "CROSTON"

    def test_sba_name(self, croston_sba: CrostonModel) -> None:
        assert croston_sba.name == "SBA"

    def test_tsb_name(self, tsb_model: CrostonModel) -> None:
        assert tsb_model.name == "TSB"


class TestCrostonTrain:
    @pytest.mark.asyncio
    async def test_train_classic(
        self, croston_classic: CrostonModel, intermittent_series: np.ndarray
    ) -> None:
        result = await croston_classic.train(
            ["p1"], series_by_product={"p1": intermittent_series}
        )
        assert result.model_name == "CROSTON"
        assert result.version == 1

    @pytest.mark.asyncio
    async def test_train_tsb(
        self, tsb_model: CrostonModel, lumpy_series: np.ndarray
    ) -> None:
        result = await tsb_model.train(
            ["p1"], series_by_product={"p1": lumpy_series}
        )
        assert result.model_name == "TSB"

    @pytest.mark.asyncio
    async def test_train_skips_short_series(self, croston_classic: CrostonModel) -> None:
        result = await croston_classic.train(
            ["p1"], series_by_product={"p1": np.array([1.0, 0.0])}
        )
        assert result.version == 1


class TestCrostonPredict:
    @pytest.mark.asyncio
    async def test_predict_classic(
        self, croston_classic: CrostonModel, intermittent_series: np.ndarray
    ) -> None:
        await croston_classic.train(
            ["p1"], series_by_product={"p1": intermittent_series}
        )
        results = await croston_classic.predict(["p1"], 4)

        assert len(results) == 1
        assert results[0].produto_id == "p1"
        assert len(results[0].quantiles) == 4

    @pytest.mark.asyncio
    async def test_predict_tsb(
        self, tsb_model: CrostonModel, lumpy_series: np.ndarray
    ) -> None:
        await tsb_model.train(
            ["p1"], series_by_product={"p1": lumpy_series}
        )
        results = await tsb_model.predict(["p1"], 4)

        assert len(results) == 1
        assert len(results[0].quantiles) == 4

    @pytest.mark.asyncio
    async def test_predict_unfitted_returns_empty(
        self, croston_classic: CrostonModel
    ) -> None:
        results = await croston_classic.predict(["unknown"], 4)
        assert results[0].quantiles == []

    @pytest.mark.asyncio
    async def test_quantiles_non_negative(
        self, croston_classic: CrostonModel, intermittent_series: np.ndarray
    ) -> None:
        await croston_classic.train(
            ["p1"], series_by_product={"p1": intermittent_series}
        )
        results = await croston_classic.predict(["p1"], 8)

        for q in results[0].quantiles:
            assert q.p10 >= 0


class TestCrostonBacktest:
    @pytest.mark.asyncio
    async def test_backtest_returns_metrics(
        self, croston_classic: CrostonModel, intermittent_series: np.ndarray
    ) -> None:
        metrics = await croston_classic.backtest(
            ["p1"], 8, series_by_product={"p1": intermittent_series}
        )
        assert "p1" in metrics
        m = metrics["p1"]
        assert isinstance(m, BacktestMetrics)
        assert m.mae >= 0
        assert m.rmse >= 0

    @pytest.mark.asyncio
    async def test_backtest_tsb(
        self, tsb_model: CrostonModel, lumpy_series: np.ndarray
    ) -> None:
        metrics = await tsb_model.backtest(
            ["p1"], 8, series_by_product={"p1": lumpy_series}
        )
        assert "p1" in metrics

    @pytest.mark.asyncio
    async def test_backtest_skips_short_series(
        self, croston_classic: CrostonModel
    ) -> None:
        metrics = await croston_classic.backtest(
            ["p1"], 13, series_by_product={"p1": np.array([1.0, 0.0, 3.0])}
        )
        assert "p1" not in metrics
