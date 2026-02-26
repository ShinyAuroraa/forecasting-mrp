"""Tests for Ensemble model — weighted TFT + LightGBM combination."""

from decimal import Decimal

import numpy as np
import pytest

from src.models.base import BacktestMetrics, ForecastQuantiles
from src.models.ensemble.ensemble_model import EnsembleModel, _weighted_quantile
from src.models.lgbm.lgbm_model import LGBMModel
from src.models.tft.tft_config import TFTVolumeConfig
from src.models.tft.tft_model import TFTModel


@pytest.fixture
def long_series() -> np.ndarray:
    """104-week series for training."""
    rng = np.random.default_rng(42)
    t = np.arange(104, dtype=np.float64)
    return 200 + 1.5 * t + rng.normal(0, 10, 104)


@pytest.fixture
def tft_model() -> TFTModel:
    return TFTModel(config=TFTVolumeConfig(max_epochs=2), seed=42)


@pytest.fixture
def lgbm_model() -> LGBMModel:
    return LGBMModel(seed=42)


@pytest.fixture
def ensemble(tft_model: TFTModel, lgbm_model: LGBMModel) -> EnsembleModel:
    return EnsembleModel(tft_model, lgbm_model)


class TestWeightedQuantile:
    def test_blended_values(self) -> None:
        q_a = ForecastQuantiles(
            p10=Decimal("80"), p25=Decimal("90"), p50=Decimal("100"),
            p75=Decimal("110"), p90=Decimal("120"),
        )
        q_b = ForecastQuantiles(
            p10=Decimal("70"), p25=Decimal("80"), p50=Decimal("90"),
            p75=Decimal("100"), p90=Decimal("110"),
        )
        result = _weighted_quantile(q_a, q_b, 0.6, 0.4)
        # 0.6 * 100 + 0.4 * 90 = 96
        assert result.p50 == Decimal("96.0")

    def test_equal_weights(self) -> None:
        q_a = ForecastQuantiles(
            p10=Decimal("80"), p25=Decimal("90"), p50=Decimal("100"),
            p75=Decimal("110"), p90=Decimal("120"),
        )
        q_b = ForecastQuantiles(
            p10=Decimal("60"), p25=Decimal("70"), p50=Decimal("80"),
            p75=Decimal("90"), p90=Decimal("100"),
        )
        result = _weighted_quantile(q_a, q_b, 0.5, 0.5)
        assert result.p50 == Decimal("90.0")


class TestEnsembleModel:
    def test_name(self, ensemble: EnsembleModel) -> None:
        assert ensemble.name == "ENSEMBLE"

    def test_default_weights(self, ensemble: EnsembleModel) -> None:
        assert ensemble.weights == {"TFT": 0.6, "LGBM": 0.4}

    def test_custom_weights(
        self, tft_model: TFTModel, lgbm_model: LGBMModel
    ) -> None:
        custom = EnsembleModel(tft_model, lgbm_model, weights={"TFT": 0.7, "LGBM": 0.3})
        assert custom.weights == {"TFT": 0.7, "LGBM": 0.3}

    @pytest.mark.asyncio
    async def test_train_delegates_to_submodels(
        self, ensemble: EnsembleModel, long_series: np.ndarray
    ) -> None:
        # Pre-load series into sub-models
        await ensemble._tft.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        await ensemble._lgbm.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        result = await ensemble.train(["p1"], force_retrain=True)
        assert result.model_name == "ENSEMBLE"
        assert result.version == 1

    @pytest.mark.asyncio
    async def test_predict_returns_blended_quantiles(
        self, ensemble: EnsembleModel, long_series: np.ndarray
    ) -> None:
        await ensemble._tft.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        await ensemble._lgbm.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        results = await ensemble.predict(["p1"], 4)

        assert len(results) == 1
        assert results[0].model_name == "ENSEMBLE"
        assert len(results[0].quantiles) == 4

    @pytest.mark.asyncio
    async def test_quantile_ordering(
        self, ensemble: EnsembleModel, long_series: np.ndarray
    ) -> None:
        await ensemble._tft.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        await ensemble._lgbm.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        results = await ensemble.predict(["p1"], 4)

        for q in results[0].quantiles:
            assert q.p10 <= q.p25 <= q.p50 <= q.p75 <= q.p90

    @pytest.mark.asyncio
    async def test_predict_unfitted_empty(self, ensemble: EnsembleModel) -> None:
        results = await ensemble.predict(["unknown"], 4)
        assert results[0].quantiles == []

    @pytest.mark.asyncio
    async def test_backtest(
        self, ensemble: EnsembleModel, long_series: np.ndarray
    ) -> None:
        metrics = await ensemble.backtest(
            ["p1"], 13
        )
        # No series loaded, so no metrics
        assert "p1" not in metrics

    @pytest.mark.asyncio
    async def test_backtest_with_data(
        self, ensemble: EnsembleModel, long_series: np.ndarray
    ) -> None:
        await ensemble._tft.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        await ensemble._lgbm.train(  # type: ignore[call-arg]
            ["p1"], series_by_product={"p1": long_series}
        )
        metrics = await ensemble.backtest(["p1"], 13)
        assert "p1" in metrics
        m = metrics["p1"]
        assert isinstance(m, BacktestMetrics)
        assert m.mae >= 0
