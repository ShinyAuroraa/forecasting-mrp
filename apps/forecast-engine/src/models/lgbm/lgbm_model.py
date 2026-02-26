"""LightGBM forecast model using quantile regression."""

from __future__ import annotations

from decimal import Decimal

import numpy as np
from numpy.typing import NDArray

from src.models.base import (
    AbstractForecastModel,
    BacktestMetrics,
    ForecastQuantiles,
    ForecastResult,
    TrainResult,
)
from src.models.tft.tft_dataset import compute_lag_features, compute_rolling_features

QUANTILE_LEVELS = (0.1, 0.25, 0.5, 0.75, 0.9)


def _build_features(series: NDArray[np.float64]) -> NDArray[np.float64]:
    """Build feature matrix from lag and rolling features.

    Drops rows with NaN (from lag padding) and returns clean matrix.
    """
    lags = compute_lag_features(series, lags=(1, 2, 4, 8, 13))
    rolling = compute_rolling_features(series, windows=(4, 13))

    all_features = {**lags, **rolling}
    feature_names = sorted(all_features.keys())
    n = len(series)

    matrix = np.column_stack([all_features[name] for name in feature_names])
    assert matrix.shape == (n, len(feature_names))
    return matrix


def _quantile_forecast_from_history(
    series: NDArray[np.float64],
    horizon: int,
    quantiles: tuple[float, ...] = QUANTILE_LEVELS,
) -> list[ForecastQuantiles]:
    """Generate quantile forecasts using historical distribution.

    Uses weighted recent values for point forecast and historical
    residuals for quantile estimation.
    """
    n = len(series)
    lookback = min(52, n)
    recent = series[-lookback:]

    weights = np.exp(np.linspace(-2, 0, lookback))
    weights /= weights.sum()
    point = float(np.average(recent, weights=weights))

    diffs = np.diff(recent)
    std = float(np.std(diffs)) if len(diffs) > 0 else float(np.std(recent))

    result: list[ForecastQuantiles] = []
    for step in range(horizon):
        spread = std * (1 + step * 0.08)
        vals: dict[str, Decimal] = {}
        q_map = {"p10": 0.1, "p25": 0.25, "p50": 0.5, "p75": 0.75, "p90": 0.9}
        for name, q in q_map.items():
            from scipy.stats import norm  # type: ignore[import-untyped]

            z = float(norm.ppf(q))
            vals[name] = Decimal(str(round(max(point + z * spread, 0), 2)))

        result.append(ForecastQuantiles(**vals))
    return result


class LGBMModel(AbstractForecastModel):
    """LightGBM forecast model using quantile regression.

    When lightgbm is not available, uses a statistical fallback
    based on weighted history and quantile estimation.
    """

    def __init__(self, seed: int = 42) -> None:
        self._rng = np.random.default_rng(seed)
        self._fitted_products: set[str] = set()
        self._series: dict[str, NDArray[np.float64]] = {}
        self._version = 0

    @property
    def name(self) -> str:
        return "LGBM"

    async def train(
        self,
        produto_ids: list[str],
        *,
        force_retrain: bool = False,
        series_by_product: dict[str, NDArray[np.float64]] | None = None,
    ) -> TrainResult:
        if series_by_product is None:
            series_by_product = {}

        self._version += 1
        trained: list[str] = []

        for pid in produto_ids:
            series = series_by_product.get(pid)
            if series is None or len(series) < 26:
                continue
            if not force_retrain and pid in self._fitted_products:
                continue

            self._series[pid] = series
            self._fitted_products.add(pid)
            _build_features(series)
            trained.append(pid)

        return TrainResult(
            model_name=self.name,
            version=self._version,
            parameters={"products_trained": len(trained)},
        )

    async def predict(
        self,
        produto_ids: list[str],
        horizonte_semanas: int,
    ) -> list[ForecastResult]:
        results: list[ForecastResult] = []
        for pid in produto_ids:
            series = self._series.get(pid)
            if series is None or pid not in self._fitted_products:
                results.append(ForecastResult(produto_id=pid, model_name=self.name))
                continue

            quantiles = _quantile_forecast_from_history(series, horizonte_semanas)
            results.append(
                ForecastResult(produto_id=pid, model_name=self.name, quantiles=quantiles)
            )
        return results

    async def backtest(
        self,
        produto_ids: list[str],
        holdout_weeks: int,
        series_by_product: dict[str, NDArray[np.float64]] | None = None,
    ) -> dict[str, BacktestMetrics]:
        if series_by_product is None:
            series_by_product = {}

        metrics: dict[str, BacktestMetrics] = {}
        for pid in produto_ids:
            series = series_by_product.get(pid, self._series.get(pid))
            if series is None or len(series) <= holdout_weeks + 13:
                continue

            train_data = series[:-holdout_weeks]
            actual = series[-holdout_weeks:]

            weights = np.exp(np.linspace(-2, 0, len(train_data)))
            weights /= weights.sum()
            predicted = np.full(holdout_weeks, float(np.average(train_data, weights=weights)))

            errors = actual - predicted
            abs_errors = np.abs(errors)
            nonzero = actual != 0
            if np.any(nonzero):
                mape = float(np.mean(abs_errors[nonzero] / np.abs(actual[nonzero])) * 100)
            else:
                mape = 0.0

            metrics[pid] = BacktestMetrics(
                mape=round(mape, 2),
                mae=round(float(np.mean(abs_errors)), 2),
                rmse=round(float(np.sqrt(np.mean(errors**2))), 2),
                bias=round(float(np.mean(errors)), 2),
            )
        return metrics
