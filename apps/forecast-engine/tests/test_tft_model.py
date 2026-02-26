"""Tests for TFT forecast model, config, and dataset preparation."""

import numpy as np
import pytest

from src.models.base import BacktestMetrics
from src.models.tft.tft_config import TFTConfig, TFTRevenueConfig, TFTVolumeConfig
from src.models.tft.tft_dataset import (
    compute_lag_features,
    compute_rolling_features,
    compute_temporal_features,
    prepare_dataset,
)
from src.models.tft.tft_model import TFTModel

# --- Fixtures ---


@pytest.fixture
def volume_config() -> TFTVolumeConfig:
    return TFTVolumeConfig(max_epochs=2, batch_size=16)


@pytest.fixture
def revenue_config() -> TFTRevenueConfig:
    return TFTRevenueConfig(max_epochs=2, batch_size=16)


@pytest.fixture
def long_series() -> np.ndarray:
    """104-week series (2 years) with trend and noise."""
    rng = np.random.default_rng(42)
    t = np.arange(104, dtype=np.float64)
    trend = 200 + 1.5 * t
    noise = rng.normal(0, 10, 104)
    return trend + noise


@pytest.fixture
def short_series() -> np.ndarray:
    """20-week series — too short for TFT."""
    return np.arange(20, dtype=np.float64) + 50


@pytest.fixture
def tft_model(volume_config: TFTVolumeConfig) -> TFTModel:
    return TFTModel(config=volume_config, seed=42)


@pytest.fixture
def revenue_model(revenue_config: TFTRevenueConfig) -> TFTModel:
    return TFTModel(config=revenue_config, seed=42)


# --- Config Tests ---


class TestTFTConfig:
    def test_default_quantiles(self) -> None:
        config = TFTConfig()
        assert config.quantiles == (0.1, 0.25, 0.5, 0.75, 0.9)

    def test_volume_config_target(self) -> None:
        config = TFTVolumeConfig()
        assert config.target_column == "volume"
        assert config.model_prefix == "tft_volume"

    def test_revenue_config_target(self) -> None:
        config = TFTRevenueConfig()
        assert config.target_column == "revenue"
        assert config.model_prefix == "tft_revenue"
        assert config.include_price_features is True

    def test_config_is_frozen(self) -> None:
        config = TFTConfig()
        with pytest.raises(AttributeError):
            config.hidden_size = 128  # type: ignore[misc]


# --- Dataset Tests ---


class TestLagFeatures:
    def test_lag_shape(self) -> None:
        series = np.arange(52, dtype=np.float64)
        lags = compute_lag_features(series, lags=(1, 4))
        assert "lag_1w" in lags
        assert "lag_4w" in lags
        assert len(lags["lag_1w"]) == 52

    def test_lag_values(self) -> None:
        series = np.arange(10, dtype=np.float64)
        lags = compute_lag_features(series, lags=(1,))
        assert np.isnan(lags["lag_1w"][0])
        assert lags["lag_1w"][1] == 0.0
        assert lags["lag_1w"][5] == 4.0

    def test_large_lag_all_nan(self) -> None:
        series = np.arange(5, dtype=np.float64)
        lags = compute_lag_features(series, lags=(10,))
        assert np.all(np.isnan(lags["lag_10w"]))


class TestRollingFeatures:
    def test_rolling_shape(self) -> None:
        series = np.ones(20, dtype=np.float64)
        feats = compute_rolling_features(series, windows=(4,))
        assert "rolling_mean_4w" in feats
        assert "rolling_std_4w" in feats
        assert len(feats["rolling_mean_4w"]) == 20

    def test_rolling_mean_values(self) -> None:
        series = np.arange(10, dtype=np.float64)
        feats = compute_rolling_features(series, windows=(4,))
        assert np.isnan(feats["rolling_mean_4w"][0])
        assert feats["rolling_mean_4w"][3] == pytest.approx(1.5, abs=0.01)

    def test_constant_series_zero_std(self) -> None:
        series = np.full(10, 5.0)
        feats = compute_rolling_features(series, windows=(4,))
        assert feats["rolling_std_4w"][5] == pytest.approx(0.0, abs=0.001)


class TestTemporalFeatures:
    def test_week_of_year_range(self) -> None:
        feats = compute_temporal_features(104)
        assert np.all(feats["week_of_year"] >= 1)
        assert np.all(feats["week_of_year"] <= 52)

    def test_quarter_range(self) -> None:
        feats = compute_temporal_features(52)
        assert np.all(feats["quarter"] >= 1)
        assert np.all(feats["quarter"] <= 4)

    def test_output_length(self) -> None:
        feats = compute_temporal_features(26)
        assert len(feats["week_of_year"]) == 26
        assert len(feats["month"]) == 26


class TestPrepareDataset:
    def test_filters_short_series(self, volume_config: TFTVolumeConfig) -> None:
        series = {"p1": np.arange(20, dtype=np.float64)}
        ds = prepare_dataset(series, volume_config)
        assert len(ds.produto_ids) == 0

    def test_includes_long_series(
        self, volume_config: TFTVolumeConfig, long_series: np.ndarray
    ) -> None:
        series = {"p1": long_series}
        ds = prepare_dataset(series, volume_config)
        assert ds.produto_ids == ["p1"]
        assert len(ds.targets) == len(long_series)

    def test_multiple_products(
        self, volume_config: TFTVolumeConfig, long_series: np.ndarray
    ) -> None:
        series = {"p1": long_series, "p2": long_series + 10}
        ds = prepare_dataset(series, volume_config)
        assert len(ds.produto_ids) == 2
        assert len(ds.targets) == 2 * len(long_series)

    def test_lag_features_present(
        self, volume_config: TFTVolumeConfig, long_series: np.ndarray
    ) -> None:
        ds = prepare_dataset({"p1": long_series}, volume_config)
        assert "lag_1w" in ds.time_varying_unknown
        assert "lag_52w" in ds.time_varying_unknown

    def test_temporal_features_present(
        self, volume_config: TFTVolumeConfig, long_series: np.ndarray
    ) -> None:
        ds = prepare_dataset({"p1": long_series}, volume_config)
        assert "week_of_year" in ds.time_varying_known
        assert "quarter" in ds.time_varying_known


# --- Model Tests ---


class TestTFTModelName:
    def test_volume_model_name(self, tft_model: TFTModel) -> None:
        assert tft_model.name == "TFT"

    def test_revenue_model_name(self, revenue_model: TFTModel) -> None:
        assert revenue_model.name == "TFT_REVENUE"


class TestTFTTrain:
    @pytest.mark.asyncio
    async def test_train_returns_result(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        result = await tft_model.train(
            ["p1"], series_by_product={"p1": long_series}
        )
        assert result.model_name == "TFT"
        assert result.version == 1
        assert result.parameters is not None
        assert result.parameters["products_trained"] == 1

    @pytest.mark.asyncio
    async def test_train_skips_short_series(
        self, tft_model: TFTModel, short_series: np.ndarray
    ) -> None:
        result = await tft_model.train(
            ["p1"], series_by_product={"p1": short_series}
        )
        assert result.parameters is not None
        assert result.parameters["products_trained"] == 0

    @pytest.mark.asyncio
    async def test_version_increments(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        await tft_model.train(["p1"], series_by_product={"p1": long_series})
        r2 = await tft_model.train(
            ["p1"], series_by_product={"p1": long_series}, force_retrain=True
        )
        assert r2.version == 2

    @pytest.mark.asyncio
    async def test_no_retrain_without_force(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        await tft_model.train(["p1"], series_by_product={"p1": long_series})
        r2 = await tft_model.train(["p1"], series_by_product={"p1": long_series})
        assert r2.parameters is not None
        assert r2.parameters["products_trained"] == 0


class TestTFTPredict:
    @pytest.mark.asyncio
    async def test_predict_returns_quantiles(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        await tft_model.train(["p1"], series_by_product={"p1": long_series})
        results = await tft_model.predict(["p1"], 13)

        assert len(results) == 1
        assert results[0].produto_id == "p1"
        assert len(results[0].quantiles) == 13

    @pytest.mark.asyncio
    async def test_quantile_ordering(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        await tft_model.train(["p1"], series_by_product={"p1": long_series})
        results = await tft_model.predict(["p1"], 4)

        for q in results[0].quantiles:
            assert q.p10 <= q.p25 <= q.p50 <= q.p75 <= q.p90

    @pytest.mark.asyncio
    async def test_predict_unfitted_empty(self, tft_model: TFTModel) -> None:
        results = await tft_model.predict(["unknown"], 4)
        assert results[0].quantiles == []

    @pytest.mark.asyncio
    async def test_quantiles_spread_increases(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        await tft_model.train(["p1"], series_by_product={"p1": long_series})
        results = await tft_model.predict(["p1"], 8)

        spread_first = float(results[0].quantiles[0].p90 - results[0].quantiles[0].p10)
        spread_last = float(results[0].quantiles[-1].p90 - results[0].quantiles[-1].p10)
        assert spread_last >= spread_first


class TestTFTBacktest:
    @pytest.mark.asyncio
    async def test_backtest_returns_metrics(
        self, tft_model: TFTModel, long_series: np.ndarray
    ) -> None:
        metrics = await tft_model.backtest(
            ["p1"], 13, series_by_product={"p1": long_series}
        )
        assert "p1" in metrics
        m = metrics["p1"]
        assert isinstance(m, BacktestMetrics)
        assert m.mae >= 0
        assert m.rmse >= 0

    @pytest.mark.asyncio
    async def test_backtest_skips_short(
        self, tft_model: TFTModel, short_series: np.ndarray
    ) -> None:
        metrics = await tft_model.backtest(
            ["p1"], 13, series_by_product={"p1": short_series}
        )
        assert "p1" not in metrics
