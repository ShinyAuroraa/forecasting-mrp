"""ETS (Holt-Winters) forecast model using statsmodels ExponentialSmoothing."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import numpy as np
from numpy.typing import NDArray
from statsmodels.tsa.holtwinters import ExponentialSmoothing  # type: ignore[import-untyped]

from src.models.base import (
    AbstractForecastModel,
    BacktestMetrics,
    ForecastQuantiles,
    ForecastResult,
    TrainResult,
)

# Number of Monte Carlo simulation paths for quantile estimation
N_SIMULATION_PATHS = 1000


def _select_variant(
    series: NDArray[np.float64],
    seasonal_periods: int,
) -> dict[str, str | int | None]:
    """Select best ETS variant via AIC comparison.

    Compares additive vs multiplicative trend and seasonality.
    Returns the config dict with best (lowest) AIC.
    """
    candidates: list[dict[str, str | int | None]] = []

    has_enough_for_seasonal = len(series) >= 2 * seasonal_periods

    if has_enough_for_seasonal:
        candidates = [
            {"trend": "add", "seasonal": "add", "seasonal_periods": seasonal_periods},
            {"trend": "add", "seasonal": "mul", "seasonal_periods": seasonal_periods},
        ]
    else:
        candidates = [
            {"trend": "add", "seasonal": None, "seasonal_periods": None},
        ]

    best_aic = float("inf")
    best_config = candidates[0]

    for config in candidates:
        try:
            model = ExponentialSmoothing(
                series,
                trend=config["trend"],
                seasonal=config["seasonal"],
                seasonal_periods=config["seasonal_periods"],
                initialization_method="estimated",
            )
            fit = model.fit()
            if fit.aic < best_aic:
                best_aic = fit.aic
                best_config = config
        except (ValueError, np.linalg.LinAlgError):
            continue

    return best_config


def _simulate_quantiles(
    fitted_model: Any,
    horizon: int,
    n_paths: int,
    rng: np.random.Generator,
) -> list[ForecastQuantiles]:
    """Generate quantile forecasts via Monte Carlo simulation.

    Uses residual resampling to create n_paths future scenarios,
    then extracts quantiles from the distribution at each step.
    """
    forecast = fitted_model.forecast(horizon)
    residuals = fitted_model.resid
    residuals_clean = residuals[np.isfinite(residuals)]

    if len(residuals_clean) == 0:
        return [
            ForecastQuantiles(
                p10=Decimal(str(round(v, 2))),
                p25=Decimal(str(round(v, 2))),
                p50=Decimal(str(round(v, 2))),
                p75=Decimal(str(round(v, 2))),
                p90=Decimal(str(round(v, 2))),
            )
            for v in forecast
        ]

    simulated = np.zeros((n_paths, horizon))
    for i in range(n_paths):
        noise = rng.choice(residuals_clean, size=horizon, replace=True)
        simulated[i, :] = forecast + noise

    simulated = np.maximum(simulated, 0.0)

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


class ETSModel(AbstractForecastModel):
    """ETS (Error-Trend-Seasonality / Holt-Winters) forecast model.

    Uses statsmodels ExponentialSmoothing with automatic AIC-based
    variant selection (additive vs multiplicative).
    Quantile intervals are computed via residual-bootstrap simulation.
    """

    def __init__(
        self,
        seasonal_periods: int = 52,
        n_sim_paths: int = N_SIMULATION_PATHS,
        seed: int = 42,
    ) -> None:
        self._seasonal_periods = seasonal_periods
        self._n_sim_paths = n_sim_paths
        self._rng = np.random.default_rng(seed)
        self._fitted: dict[str, Any] = {}
        self._version = 0

    @property
    def name(self) -> str:
        return "ETS"

    async def train(
        self,
        produto_ids: list[str],
        *,
        force_retrain: bool = False,
        series_by_product: dict[str, NDArray[np.float64]] | None = None,
    ) -> TrainResult:
        """Fit ETS model per product.

        Args:
            produto_ids: Product IDs to train.
            force_retrain: Force refit even if already fitted.
            series_by_product: Mapping of produto_id -> weekly demand array.
        """
        if series_by_product is None:
            series_by_product = {}

        self._version += 1

        for pid in produto_ids:
            if not force_retrain and pid in self._fitted:
                continue

            series = series_by_product.get(pid)
            if series is None or len(series) < 4:
                continue

            config = _select_variant(series, self._seasonal_periods)
            model = ExponentialSmoothing(
                series,
                trend=config["trend"],
                seasonal=config["seasonal"],
                seasonal_periods=config["seasonal_periods"],
                initialization_method="estimated",
            )
            self._fitted[pid] = model.fit()

        return TrainResult(
            model_name=self.name,
            version=self._version,
            parameters={"seasonal_periods": self._seasonal_periods},
        )

    async def predict(
        self,
        produto_ids: list[str],
        horizonte_semanas: int,
    ) -> list[ForecastResult]:
        results: list[ForecastResult] = []
        for pid in produto_ids:
            fitted = self._fitted.get(pid)
            if fitted is None:
                results.append(ForecastResult(produto_id=pid, model_name=self.name))
                continue

            quantiles = _simulate_quantiles(
                fitted, horizonte_semanas, self._n_sim_paths, self._rng
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

            config = _select_variant(train_data, self._seasonal_periods)
            model = ExponentialSmoothing(
                train_data,
                trend=config["trend"],
                seasonal=config["seasonal"],
                seasonal_periods=config["seasonal_periods"],
                initialization_method="estimated",
            )
            fit = model.fit()
            predicted = fit.forecast(holdout_weeks)

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
