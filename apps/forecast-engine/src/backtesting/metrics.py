"""Metrics aggregation — per-class and baseline comparison (FR-029, FR-032)."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from src.models.base import BacktestMetrics


class AggregationLevel(StrEnum):
    """Level at which metrics are aggregated."""

    SKU = "SKU"
    CLASS = "CLASS"
    GLOBAL = "GLOBAL"


@dataclass(frozen=True)
class ClassMetrics:
    """Aggregated backtest metrics for an ABC class."""

    classe_abc: str
    avg_mape: float
    avg_mae: float
    avg_rmse: float
    avg_bias: float
    product_count: int


@dataclass(frozen=True)
class BaselineComparison:
    """Comparison of a model's metrics against the 12-week moving average baseline."""

    produto_id: str
    model_name: str
    model_mape: float
    baseline_mape: float
    mape_improvement: float
    model_beats_baseline: bool


def moving_average_forecast(
    series: NDArray[np.float64],
    holdout_weeks: int,
    window: int = 12,
) -> NDArray[np.float64]:
    """Generate baseline forecast using 12-week moving average.

    Args:
        series: Full time series (train + holdout).
        holdout_weeks: Number of weeks held out for evaluation.
        window: Moving average window size.

    Returns:
        Array of predicted values for the holdout period.
    """
    train = series[:-holdout_weeks]
    effective_window = min(window, len(train))
    ma_value = float(np.mean(train[-effective_window:]))
    return np.full(holdout_weeks, ma_value)


def compute_baseline_metrics(
    series: NDArray[np.float64],
    holdout_weeks: int,
    window: int = 12,
) -> BacktestMetrics:
    """Compute backtest metrics for the moving average baseline.

    Args:
        series: Full time series.
        holdout_weeks: Holdout period length.
        window: Moving average window.

    Returns:
        BacktestMetrics for the baseline forecast.
    """
    actual = series[-holdout_weeks:]
    predicted = moving_average_forecast(series, holdout_weeks, window)

    errors = actual - predicted
    abs_errors = np.abs(errors)
    nonzero = actual != 0

    if np.any(nonzero):
        mape = float(np.mean(abs_errors[nonzero] / np.abs(actual[nonzero])) * 100)
    else:
        mape = 0.0

    return BacktestMetrics(
        mape=round(mape, 2),
        mae=round(float(np.mean(abs_errors)), 2),
        rmse=round(float(np.sqrt(np.mean(errors**2))), 2),
        bias=round(float(np.mean(errors)), 2),
    )


def aggregate_by_class(
    per_product_metrics: dict[str, BacktestMetrics],
    class_by_product: dict[str, str],
) -> dict[str, ClassMetrics]:
    """Aggregate per-product metrics by ABC class.

    Args:
        per_product_metrics: produto_id -> BacktestMetrics
        class_by_product: produto_id -> classe_abc ('A', 'B', 'C')

    Returns:
        Dictionary of classe_abc -> ClassMetrics
    """
    buckets: dict[str, list[BacktestMetrics]] = {}

    for pid, m in per_product_metrics.items():
        cls = class_by_product.get(pid, "C")
        if cls not in buckets:
            buckets[cls] = []
        buckets[cls].append(m)

    result: dict[str, ClassMetrics] = {}
    for cls, metrics_list in sorted(buckets.items()):
        n = len(metrics_list)
        result[cls] = ClassMetrics(
            classe_abc=cls,
            avg_mape=round(sum(m.mape for m in metrics_list) / n, 2),
            avg_mae=round(sum(m.mae for m in metrics_list) / n, 2),
            avg_rmse=round(sum(m.rmse for m in metrics_list) / n, 2),
            avg_bias=round(sum(m.bias for m in metrics_list) / n, 2),
            product_count=n,
        )

    return result


def compare_against_baseline(
    model_metrics: dict[str, BacktestMetrics],
    baseline_metrics: dict[str, BacktestMetrics],
    model_name: str,
) -> list[BaselineComparison]:
    """Compare model metrics against baseline per product.

    Args:
        model_metrics: produto_id -> model BacktestMetrics
        baseline_metrics: produto_id -> baseline BacktestMetrics
        model_name: Name of the model being compared.

    Returns:
        List of BaselineComparison results.
    """
    comparisons: list[BaselineComparison] = []

    for pid in model_metrics:
        m = model_metrics[pid]
        b = baseline_metrics.get(pid)
        if b is None:
            continue

        improvement = b.mape - m.mape
        comparisons.append(
            BaselineComparison(
                produto_id=pid,
                model_name=model_name,
                model_mape=m.mape,
                baseline_mape=b.mape,
                mape_improvement=round(improvement, 2),
                model_beats_baseline=improvement > 0,
            )
        )

    return comparisons
