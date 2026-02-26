"""Tests for backtesting metrics aggregation and baseline comparison."""

import numpy as np
import pytest

from src.backtesting.metrics import (
    ClassMetrics,
    aggregate_by_class,
    compare_against_baseline,
    compute_baseline_metrics,
    moving_average_forecast,
)
from src.models.base import BacktestMetrics


@pytest.fixture
def trend_series() -> np.ndarray:
    """Series with upward trend for testing."""
    rng = np.random.default_rng(42)
    t = np.arange(52, dtype=np.float64)
    return 100 + 2.0 * t + rng.normal(0, 5, 52)


class TestMovingAverageForecast:
    def test_returns_correct_length(self, trend_series: np.ndarray) -> None:
        result = moving_average_forecast(trend_series, holdout_weeks=13)
        assert len(result) == 13

    def test_uses_last_n_values(self) -> None:
        series = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
        result = moving_average_forecast(series, holdout_weeks=2, window=3)
        expected = np.mean([10.0, 20.0, 30.0])
        assert np.allclose(result, expected)

    def test_window_larger_than_train(self) -> None:
        series = np.array([10.0, 20.0, 30.0])
        result = moving_average_forecast(series, holdout_weeks=1, window=12)
        expected = np.mean([10.0, 20.0])
        assert np.allclose(result, expected)

    def test_constant_forecast(self) -> None:
        series = np.full(26, 50.0)
        result = moving_average_forecast(series, holdout_weeks=4, window=12)
        assert np.allclose(result, 50.0)


class TestComputeBaselineMetrics:
    def test_perfect_forecast(self) -> None:
        series = np.full(26, 100.0)
        metrics = compute_baseline_metrics(series, holdout_weeks=4, window=12)
        assert metrics.mape == 0.0
        assert metrics.mae == 0.0
        assert metrics.rmse == 0.0
        assert metrics.bias == 0.0

    def test_returns_backtest_metrics(self, trend_series: np.ndarray) -> None:
        metrics = compute_baseline_metrics(trend_series, holdout_weeks=13)
        assert isinstance(metrics, BacktestMetrics)
        assert metrics.mape >= 0
        assert metrics.mae >= 0
        assert metrics.rmse >= 0

    def test_positive_bias_for_underforecast(self) -> None:
        series = np.concatenate([np.full(20, 50.0), np.full(6, 100.0)])
        metrics = compute_baseline_metrics(series, holdout_weeks=6, window=12)
        # Predicted 50, actual 100 → error = actual - predicted = 50 (positive bias)
        assert metrics.bias > 0

    def test_handles_zero_actuals(self) -> None:
        series = np.concatenate([np.full(20, 10.0), np.zeros(5)])
        metrics = compute_baseline_metrics(series, holdout_weeks=5, window=12)
        assert metrics.mape == 0.0  # No nonzero actuals in holdout


class TestAggregateByClass:
    def test_single_class(self) -> None:
        metrics = {
            "p1": BacktestMetrics(mape=10.0, mae=5.0, rmse=6.0, bias=1.0),
            "p2": BacktestMetrics(mape=20.0, mae=10.0, rmse=12.0, bias=-1.0),
        }
        class_map = {"p1": "A", "p2": "A"}
        result = aggregate_by_class(metrics, class_map)

        assert "A" in result
        assert result["A"].product_count == 2
        assert result["A"].avg_mape == 15.0
        assert result["A"].avg_mae == 7.5

    def test_multiple_classes(self) -> None:
        metrics = {
            "p1": BacktestMetrics(mape=10.0, mae=5.0, rmse=6.0, bias=1.0),
            "p2": BacktestMetrics(mape=30.0, mae=15.0, rmse=18.0, bias=-3.0),
        }
        class_map = {"p1": "A", "p2": "C"}
        result = aggregate_by_class(metrics, class_map)

        assert len(result) == 2
        assert result["A"].avg_mape == 10.0
        assert result["C"].avg_mape == 30.0

    def test_defaults_to_class_c(self) -> None:
        metrics = {"p1": BacktestMetrics(mape=10.0, mae=5.0, rmse=6.0, bias=0.0)}
        result = aggregate_by_class(metrics, {})
        assert "C" in result
        assert result["C"].product_count == 1

    def test_returns_class_metrics_type(self) -> None:
        metrics = {"p1": BacktestMetrics(mape=10.0, mae=5.0, rmse=6.0, bias=0.0)}
        result = aggregate_by_class(metrics, {"p1": "B"})
        assert isinstance(result["B"], ClassMetrics)
        assert result["B"].classe_abc == "B"


class TestCompareAgainstBaseline:
    def test_model_beats_baseline(self) -> None:
        model = {"p1": BacktestMetrics(mape=5.0, mae=3.0, rmse=4.0, bias=0.0)}
        baseline = {"p1": BacktestMetrics(mape=15.0, mae=8.0, rmse=10.0, bias=0.0)}

        comps = compare_against_baseline(model, baseline, "TFT")
        assert len(comps) == 1
        assert comps[0].model_beats_baseline is True
        assert comps[0].mape_improvement == 10.0

    def test_model_worse_than_baseline(self) -> None:
        model = {"p1": BacktestMetrics(mape=20.0, mae=10.0, rmse=12.0, bias=0.0)}
        baseline = {"p1": BacktestMetrics(mape=10.0, mae=5.0, rmse=6.0, bias=0.0)}

        comps = compare_against_baseline(model, baseline, "ETS")
        assert comps[0].model_beats_baseline is False
        assert comps[0].mape_improvement == -10.0

    def test_skips_missing_baseline(self) -> None:
        model = {"p1": BacktestMetrics(mape=5.0, mae=3.0, rmse=4.0, bias=0.0)}
        comps = compare_against_baseline(model, {}, "TFT")
        assert len(comps) == 0

    def test_multiple_products(self) -> None:
        model = {
            "p1": BacktestMetrics(mape=5.0, mae=3.0, rmse=4.0, bias=0.0),
            "p2": BacktestMetrics(mape=8.0, mae=4.0, rmse=5.0, bias=0.0),
        }
        baseline = {
            "p1": BacktestMetrics(mape=10.0, mae=5.0, rmse=6.0, bias=0.0),
            "p2": BacktestMetrics(mape=12.0, mae=6.0, rmse=7.0, bias=0.0),
        }
        comps = compare_against_baseline(model, baseline, "TFT")
        assert len(comps) == 2
        assert all(c.model_name == "TFT" for c in comps)
