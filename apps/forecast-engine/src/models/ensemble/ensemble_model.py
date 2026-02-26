"""Weighted ensemble model — combines TFT and LightGBM forecasts."""

from __future__ import annotations

from decimal import Decimal

from src.models.base import (
    AbstractForecastModel,
    BacktestMetrics,
    ForecastQuantiles,
    ForecastResult,
    TrainResult,
)

DEFAULT_WEIGHTS: dict[str, float] = {"TFT": 0.6, "LGBM": 0.4}


def _weighted_quantile(
    quantiles_a: ForecastQuantiles,
    quantiles_b: ForecastQuantiles,
    weight_a: float,
    weight_b: float,
) -> ForecastQuantiles:
    """Compute weighted average of two quantile forecasts."""

    def _blend(va: Decimal, vb: Decimal) -> Decimal:
        result = float(va) * weight_a + float(vb) * weight_b
        return Decimal(str(round(result, 2)))

    return ForecastQuantiles(
        p10=_blend(quantiles_a.p10, quantiles_b.p10),
        p25=_blend(quantiles_a.p25, quantiles_b.p25),
        p50=_blend(quantiles_a.p50, quantiles_b.p50),
        p75=_blend(quantiles_a.p75, quantiles_b.p75),
        p90=_blend(quantiles_a.p90, quantiles_b.p90),
    )


class EnsembleModel(AbstractForecastModel):
    """Weighted ensemble combining TFT and LightGBM forecasts.

    For Class A SKUs: 0.6 TFT + 0.4 LGBM (default weights).
    Does not train independently — relies on sub-model outputs.
    """

    def __init__(
        self,
        tft_model: AbstractForecastModel,
        lgbm_model: AbstractForecastModel,
        weights: dict[str, float] | None = None,
    ) -> None:
        self._tft = tft_model
        self._lgbm = lgbm_model
        self._weights = weights or DEFAULT_WEIGHTS
        self._version = 0

    @property
    def name(self) -> str:
        return "ENSEMBLE"

    @property
    def weights(self) -> dict[str, float]:
        return dict(self._weights)

    async def train(
        self,
        produto_ids: list[str],
        *,
        force_retrain: bool = False,
    ) -> TrainResult:
        """Train both sub-models."""
        self._version += 1
        await self._tft.train(produto_ids, force_retrain=force_retrain)
        await self._lgbm.train(produto_ids, force_retrain=force_retrain)

        return TrainResult(
            model_name=self.name,
            version=self._version,
            parameters={"weights": self._weights},
        )

    async def predict(
        self,
        produto_ids: list[str],
        horizonte_semanas: int,
    ) -> list[ForecastResult]:
        """Generate weighted ensemble forecasts from sub-models."""
        tft_results = await self._tft.predict(produto_ids, horizonte_semanas)
        lgbm_results = await self._lgbm.predict(produto_ids, horizonte_semanas)

        tft_map = {r.produto_id: r for r in tft_results}
        lgbm_map = {r.produto_id: r for r in lgbm_results}

        w_tft = self._weights.get("TFT", 0.6)
        w_lgbm = self._weights.get("LGBM", 0.4)

        results: list[ForecastResult] = []
        for pid in produto_ids:
            tft_r = tft_map.get(pid)
            lgbm_r = lgbm_map.get(pid)

            if tft_r is None or lgbm_r is None:
                results.append(ForecastResult(produto_id=pid, model_name=self.name))
                continue

            if not tft_r.quantiles or not lgbm_r.quantiles:
                results.append(ForecastResult(produto_id=pid, model_name=self.name))
                continue

            horizon = min(len(tft_r.quantiles), len(lgbm_r.quantiles))
            ensemble_quantiles = [
                _weighted_quantile(tft_r.quantiles[i], lgbm_r.quantiles[i], w_tft, w_lgbm)
                for i in range(horizon)
            ]

            results.append(
                ForecastResult(
                    produto_id=pid,
                    model_name=self.name,
                    quantiles=ensemble_quantiles,
                )
            )
        return results

    async def backtest(
        self,
        produto_ids: list[str],
        holdout_weeks: int,
    ) -> dict[str, BacktestMetrics]:
        """Run backtesting using both sub-models and return combined metrics."""
        tft_metrics = await self._tft.backtest(produto_ids, holdout_weeks)
        lgbm_metrics = await self._lgbm.backtest(produto_ids, holdout_weeks)

        w_tft = self._weights.get("TFT", 0.6)
        w_lgbm = self._weights.get("LGBM", 0.4)

        combined: dict[str, BacktestMetrics] = {}
        for pid in produto_ids:
            tft_m = tft_metrics.get(pid)
            lgbm_m = lgbm_metrics.get(pid)

            if tft_m is None and lgbm_m is None:
                continue
            if tft_m is None:
                combined[pid] = lgbm_m  # type: ignore[assignment]
                continue
            if lgbm_m is None:
                combined[pid] = tft_m
                continue

            combined[pid] = BacktestMetrics(
                mape=round(tft_m.mape * w_tft + lgbm_m.mape * w_lgbm, 2),
                mae=round(tft_m.mae * w_tft + lgbm_m.mae * w_lgbm, 2),
                rmse=round(tft_m.rmse * w_tft + lgbm_m.rmse * w_lgbm, 2),
                bias=round(tft_m.bias * w_tft + lgbm_m.bias * w_lgbm, 2),
            )
        return combined
