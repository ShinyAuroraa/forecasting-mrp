"""Tests for LightGBM forecast model."""

import numpy as np
import pytest

from src.models.base import BacktestMetrics
from src.models.lgbm.lgbm_model import LGBMModel, _build_features


@pytest.fixture
def lgbm_model() -> LGBMModel:
    return LGBMModel(seed=42)


@pytest.fixture
def regular_series() -> np.ndarray:
    """104-week regular demand series."""
    rng = np.random.default_rng(42)
    t = np.arange(104, dtype=np.float64)
    return 150 + 2 * t + rng.normal(0, 10, 104)


class TestBuildFeatures:
    def test_feature_matrix_shape(self) -> None:
        series = np.arange(52, dtype=np.float64)
        matrix = _build_features(series)
        assert matrix.shape[0] == 52
        assert matrix.shape[1] > 0

    def test_has_lag_and_rolling(self) -> None:
        series = np.arange(52, dtype=np.float64)
        matrix = _build_features(series)
        # 5 lags + 2 windows * 2 (mean/std) = 9 features
        assert matrix.shape[1] == 9


class TestLGBMModel:
    def test_name(self, lgbm_model: LGBMModel) -> None:
        assert lgbm_model.name == "LGBM"

    @pytest.mark.asyncio
    async def test_train(
        self, lgbm_model: LGBMModel, regular_series: np.ndarray
    ) -> None:
        result = await lgbm_model.train(
            ["p1"], series_by_product={"p1": regular_series}
        )
        assert result.model_name == "LGBM"
        assert result.version == 1
        assert result.parameters is not None
        assert result.parameters["products_trained"] == 1

    @pytest.mark.asyncio
    async def test_train_skips_short(self, lgbm_model: LGBMModel) -> None:
        result = await lgbm_model.train(
            ["p1"], series_by_product={"p1": np.arange(10, dtype=np.float64)}
        )
        assert result.parameters is not None
        assert result.parameters["products_trained"] == 0

    @pytest.mark.asyncio
    async def test_predict_returns_quantiles(
        self, lgbm_model: LGBMModel, regular_series: np.ndarray
    ) -> None:
        await lgbm_model.train(["p1"], series_by_product={"p1": regular_series})
        results = await lgbm_model.predict(["p1"], 8)

        assert len(results) == 1
        assert len(results[0].quantiles) == 8
        assert results[0].model_name == "LGBM"

    @pytest.mark.asyncio
    async def test_quantile_ordering(
        self, lgbm_model: LGBMModel, regular_series: np.ndarray
    ) -> None:
        await lgbm_model.train(["p1"], series_by_product={"p1": regular_series})
        results = await lgbm_model.predict(["p1"], 4)

        for q in results[0].quantiles:
            assert q.p10 <= q.p25 <= q.p50 <= q.p75 <= q.p90

    @pytest.mark.asyncio
    async def test_predict_unfitted_empty(self, lgbm_model: LGBMModel) -> None:
        results = await lgbm_model.predict(["unknown"], 4)
        assert results[0].quantiles == []

    @pytest.mark.asyncio
    async def test_backtest(
        self, lgbm_model: LGBMModel, regular_series: np.ndarray
    ) -> None:
        metrics = await lgbm_model.backtest(
            ["p1"], 13, series_by_product={"p1": regular_series}
        )
        assert "p1" in metrics
        m = metrics["p1"]
        assert isinstance(m, BacktestMetrics)
        assert m.mae >= 0

    @pytest.mark.asyncio
    async def test_backtest_skips_short(self, lgbm_model: LGBMModel) -> None:
        metrics = await lgbm_model.backtest(
            ["p1"], 13, series_by_product={"p1": np.arange(10, dtype=np.float64)}
        )
        assert "p1" not in metrics
