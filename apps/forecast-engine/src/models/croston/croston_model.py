"""Croston and TSB forecast models for intermittent/lumpy demand."""

from decimal import Decimal
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from src.models.base import (
    AbstractForecastModel,
    BacktestMetrics,
    ForecastQuantiles,
    ForecastResult,
    TrainResult,
)

N_BOOTSTRAP_PATHS = 1000


class CrostonVariant(StrEnum):
    CLASSIC = "CLASSIC"
    SBA = "SBA"
    TSB = "TSB"


def _croston_fit(
    series: NDArray[np.float64],
    alpha: float = 0.1,
    variant: CrostonVariant = CrostonVariant.CLASSIC,
) -> tuple[float, float]:
    """Fit Croston decomposition: inter-demand interval and demand size.

    Returns (demand_estimate, interval_estimate).
    """
    demand_times: list[int] = []
    demand_sizes: list[float] = []

    for i, val in enumerate(series):
        if val > 0:
            demand_times.append(i)
            demand_sizes.append(float(val))

    if len(demand_sizes) < 2:
        mean_demand = float(np.mean(series[series > 0])) if np.any(series > 0) else 0.0
        return mean_demand, float(len(series))

    intervals = np.diff(demand_times).astype(float)

    z_hat = float(demand_sizes[0])
    p_hat = float(intervals[0]) if len(intervals) > 0 else 1.0

    for i in range(len(intervals)):
        z_hat = alpha * demand_sizes[i + 1] + (1 - alpha) * z_hat
        p_hat = alpha * intervals[i] + (1 - alpha) * p_hat

    if variant == CrostonVariant.SBA:
        z_hat = z_hat * (1 - alpha / 2)

    return z_hat, max(p_hat, 1.0)


def _tsb_fit(
    series: NDArray[np.float64],
    alpha_d: float = 0.1,
    alpha_p: float = 0.1,
) -> tuple[float, float]:
    """Fit TSB (Teunter-Syntetos-Babai) model with probability of demand.

    Returns (demand_estimate, probability_estimate).
    """
    demand_sizes: list[float] = []
    for val in series:
        if val > 0:
            demand_sizes.append(float(val))

    if len(demand_sizes) < 2:
        mean_d = float(np.mean(series[series > 0])) if np.any(series > 0) else 0.0
        prob = float(np.mean(series > 0))
        return mean_d, prob

    z_hat = demand_sizes[0]
    p_hat = 1.0

    for val in series[1:]:
        if val > 0:
            z_hat = alpha_d * float(val) + (1 - alpha_d) * z_hat
            p_hat = alpha_p * 1.0 + (1 - alpha_p) * p_hat
        else:
            p_hat = alpha_p * 0.0 + (1 - alpha_p) * p_hat

    return z_hat, max(p_hat, 0.001)


def _bootstrap_quantiles(
    series: NDArray[np.float64],
    point_forecast: float,
    horizon: int,
    n_paths: int,
    rng: np.random.Generator,
) -> list[ForecastQuantiles]:
    """Generate quantile forecasts via bootstrap resampling.

    Resamples from historical non-zero demands and zero/non-zero
    occurrence pattern to create simulated future paths.
    """
    nonzero_values = series[series > 0]
    zero_fraction = float(np.mean(series == 0))

    if len(nonzero_values) == 0:
        zero_q = ForecastQuantiles(
            p10=Decimal("0"), p25=Decimal("0"), p50=Decimal("0"),
            p75=Decimal("0"), p90=Decimal("0"),
        )
        return [zero_q] * horizon

    simulated = np.zeros((n_paths, horizon))
    for i in range(n_paths):
        occurrences = rng.random(horizon) >= zero_fraction
        demands = rng.choice(nonzero_values, size=horizon, replace=True)
        simulated[i, :] = occurrences * demands

    quantiles_list: list[ForecastQuantiles] = []
    for step in range(horizon):
        col = simulated[:, step]
        quantiles_list.append(
            ForecastQuantiles(
                p10=Decimal(str(round(float(np.percentile(col, 10)), 2))),
                p25=Decimal(str(round(float(np.percentile(col, 25)), 2))),
                p50=Decimal(str(round(float(np.percentile(col, 50)), 2))),
                p75=Decimal(str(round(float(np.percentile(col, 75)), 2))),
                p90=Decimal(str(round(float(np.percentile(col, 90)), 2))),
            )
        )
    return quantiles_list


class CrostonModel(AbstractForecastModel):
    """Croston's method for intermittent demand forecasting.

    Decomposes demand into inter-demand intervals and demand sizes,
    applying separate exponential smoothing to each component.
    Supports CLASSIC, SBA, and TSB variants.
    """

    def __init__(
        self,
        variant: CrostonVariant = CrostonVariant.CLASSIC,
        alpha: float = 0.1,
        n_bootstrap_paths: int = N_BOOTSTRAP_PATHS,
        seed: int = 42,
    ) -> None:
        self._variant = variant
        self._alpha = alpha
        self._n_bootstrap_paths = n_bootstrap_paths
        self._rng = np.random.default_rng(seed)
        self._fitted: dict[str, tuple[float, float]] = {}
        self._series: dict[str, NDArray[np.float64]] = {}
        self._version = 0

    @property
    def name(self) -> str:
        if self._variant == CrostonVariant.TSB:
            return "TSB"
        if self._variant == CrostonVariant.SBA:
            return "SBA"
        return "CROSTON"

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

        for pid in produto_ids:
            if not force_retrain and pid in self._fitted:
                continue

            series = series_by_product.get(pid)
            if series is None or len(series) < 4:
                continue

            self._series[pid] = series

            if self._variant == CrostonVariant.TSB:
                z_hat, p_hat = _tsb_fit(series, self._alpha, self._alpha)
            else:
                z_hat, p_hat = _croston_fit(series, self._alpha, self._variant)

            self._fitted[pid] = (z_hat, p_hat)

        return TrainResult(
            model_name=self.name,
            version=self._version,
            parameters={"variant": self._variant, "alpha": self._alpha},
        )

    async def predict(
        self,
        produto_ids: list[str],
        horizonte_semanas: int,
    ) -> list[ForecastResult]:
        results: list[ForecastResult] = []
        for pid in produto_ids:
            fit_params = self._fitted.get(pid)
            series = self._series.get(pid)

            if fit_params is None or series is None:
                results.append(ForecastResult(produto_id=pid, model_name=self.name))
                continue

            z_hat, p_hat = fit_params
            if self._variant == CrostonVariant.TSB:
                point_forecast = z_hat * p_hat
            else:
                point_forecast = z_hat / p_hat

            quantiles = _bootstrap_quantiles(
                series, point_forecast, horizonte_semanas,
                self._n_bootstrap_paths, self._rng,
            )
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
            series = series_by_product.get(pid)
            if series is None or len(series) <= holdout_weeks + 4:
                continue

            train_data = series[:-holdout_weeks]
            actual = series[-holdout_weeks:]

            if self._variant == CrostonVariant.TSB:
                z_hat, p_hat = _tsb_fit(train_data, self._alpha, self._alpha)
                point = z_hat * p_hat
            else:
                z_hat, p_hat = _croston_fit(train_data, self._alpha, self._variant)
                point = z_hat / p_hat

            predicted = np.full(holdout_weeks, point)
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
