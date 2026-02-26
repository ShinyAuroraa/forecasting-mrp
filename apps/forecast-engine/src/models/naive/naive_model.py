"""Naive forecast model — simplest baseline using last observed values."""

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


class NaiveModel(AbstractForecastModel):
    """Naive forecast model using last-value repetition.

    Uses the last observed value as point forecast for all horizons.
    Quantiles are derived from historical volatility (std of recent values).
    """

    def __init__(self, lookback: int = 12, seed: int = 42) -> None:
        self._lookback = lookback
        self._rng = np.random.default_rng(seed)
        self._fitted: dict[str, tuple[float, float]] = {}
        self._version = 0

    @property
    def name(self) -> str:
        return "NAIVE"

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
            if series is None or len(series) < 1:
                continue

            last_value = float(series[-1])
            recent = series[-self._lookback :] if len(series) >= self._lookback else series
            std = float(np.std(recent))
            self._fitted[pid] = (last_value, std)

        return TrainResult(
            model_name=self.name,
            version=self._version,
            parameters={"lookback": self._lookback},
        )

    async def predict(
        self,
        produto_ids: list[str],
        horizonte_semanas: int,
    ) -> list[ForecastResult]:
        results: list[ForecastResult] = []
        for pid in produto_ids:
            params = self._fitted.get(pid)
            if params is None:
                results.append(ForecastResult(produto_id=pid, model_name=self.name))
                continue

            last_value, std = params
            quantiles: list[ForecastQuantiles] = []
            for _ in range(horizonte_semanas):
                if std > 0:
                    p10 = max(last_value - 1.28 * std, 0.0)
                    p25 = max(last_value - 0.67 * std, 0.0)
                    p75 = last_value + 0.67 * std
                    p90 = last_value + 1.28 * std
                else:
                    p10 = p25 = p75 = p90 = last_value

                quantiles.append(
                    ForecastQuantiles(
                        p10=Decimal(str(round(p10, 2))),
                        p25=Decimal(str(round(p25, 2))),
                        p50=Decimal(str(round(last_value, 2))),
                        p75=Decimal(str(round(p75, 2))),
                        p90=Decimal(str(round(p90, 2))),
                    )
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
            if series is None or len(series) <= holdout_weeks:
                continue

            train_data = series[:-holdout_weeks]
            actual = series[-holdout_weeks:]
            predicted = np.full(holdout_weeks, train_data[-1])

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
