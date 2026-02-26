"""Forecast execution pipeline — orchestrates the 10-step forecast flow."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum

from src.backtesting.backtester import Backtester, BacktestResult
from src.models.base import (
    AbstractForecastModel,
    ForecastQuantiles,
    ForecastResult,
)
from src.pipeline.segmentation import SkuSegmenter


class StepStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


@dataclass
class StepLog:
    """Log entry for a pipeline step."""

    step_number: int
    step_name: str
    status: StepStatus = StepStatus.PENDING
    products_processed: int = 0
    error_message: str | None = None


@dataclass
class PipelineResult:
    """Result of a full pipeline execution."""

    steps: list[StepLog] = field(default_factory=list)
    forecast_results: list[ForecastResult] = field(default_factory=list)
    revenue_results: list[ForecastResult] = field(default_factory=list)
    backtest_result: BacktestResult | None = None
    total_products: int = 0
    status: StepStatus = StepStatus.PENDING


@dataclass
class PipelineConfig:
    """Configuration for the forecast pipeline."""

    horizonte_semanas: int = 13
    include_revenue: bool = True
    include_backtest: bool = True
    holdout_weeks: int = 13


class ForecastPipeline:
    """10-step forecast execution pipeline.

    Steps:
    1. Load time series data
    2. Segment SKUs by classification
    3. Execute TFT models
    4. Execute ETS models
    5. Execute Croston/TSB models
    6. Execute LightGBM + Ensemble (Class A)
    7. Calculate revenue forecasts
    8. Calculate metrics (delegated to backtesting)
    9. Collect results
    10. Finalize
    """

    def __init__(
        self,
        models: dict[str, AbstractForecastModel],
        segmenter: SkuSegmenter | None = None,
        config: PipelineConfig | None = None,
    ) -> None:
        self._models = models
        self._segmenter = segmenter or SkuSegmenter()
        self._config = config or PipelineConfig()

    async def execute(
        self,
        classifications: list[object],
        series_by_product: dict[str, object],
        prices_by_product: dict[str, float] | None = None,
        weeks_by_product: dict[str, int] | None = None,
        class_by_product: dict[str, str] | None = None,
        progress_callback: Callable[[int, str, int], Awaitable[None]] | None = None,
    ) -> PipelineResult:
        """Execute the full forecast pipeline.

        Args:
            classifications: SKU classification records
            series_by_product: produto_id -> time series data
            prices_by_product: produto_id -> unit price (for revenue)
            weeks_by_product: produto_id -> weeks of data available
        """
        result = PipelineResult()
        result.status = StepStatus.RUNNING

        # Step 1: Load data (already provided as args)
        step1 = StepLog(1, "load_data", StepStatus.COMPLETED, len(series_by_product))
        result.steps.append(step1)
        if progress_callback:
            await progress_callback(1, "load_data", len(series_by_product))

        # Step 2: Segment SKUs
        step2 = StepLog(2, "segment_skus")
        try:
            segments = self._segmenter.segment(
                classifications,  # type: ignore[arg-type]
                weeks_by_product=weeks_by_product,
            )
            step2.status = StepStatus.COMPLETED
            step2.products_processed = sum(len(s.produto_ids) for s in segments.values())
            result.total_products = step2.products_processed
        except Exception as e:
            step2.status = StepStatus.FAILED
            step2.error_message = str(e)
            result.steps.append(step2)
            result.status = StepStatus.FAILED
            return result
        result.steps.append(step2)
        if progress_callback:
            await progress_callback(2, "segment_skus", step2.products_processed)

        # Steps 3-6: Execute models per segment
        model_steps = [
            (3, "execute_tft", ["TFT", "TFT_REVENUE"]),
            (4, "execute_ets", ["ETS"]),
            (5, "execute_croston_tsb", ["CROSTON", "TSB", "SBA"]),
            (6, "execute_lgbm_ensemble", ["LGBM", "ENSEMBLE"]),
        ]

        for step_num, step_name, model_names in model_steps:
            step = StepLog(step_num, step_name)
            products_in_step = 0

            for model_name in model_names:
                segment = segments.get(model_name)
                if segment is None:
                    continue

                model = self._models.get(model_name)
                if model is None:
                    continue

                try:
                    forecasts = await model.predict(
                        segment.produto_ids, self._config.horizonte_semanas
                    )
                    result.forecast_results.extend(forecasts)
                    products_in_step += len(segment.produto_ids)
                except Exception as e:
                    step.status = StepStatus.FAILED
                    step.error_message = str(e)
                    break

            if step.status != StepStatus.FAILED:
                step.status = StepStatus.COMPLETED if products_in_step > 0 else StepStatus.SKIPPED
            step.products_processed = products_in_step
            result.steps.append(step)
            if progress_callback:
                await progress_callback(step_num, step_name, products_in_step)

        # Step 7: Revenue forecast (Volume P50 x Price)
        step7 = StepLog(7, "calculate_revenue")
        if self._config.include_revenue and prices_by_product:
            revenue_count = 0
            for fr in result.forecast_results:
                price = prices_by_product.get(fr.produto_id)
                if price is None or not fr.quantiles:
                    continue

                revenue_quantiles = [
                    ForecastQuantiles(
                        p10=Decimal(str(round(float(q.p10) * price, 2))),
                        p25=Decimal(str(round(float(q.p25) * price, 2))),
                        p50=Decimal(str(round(float(q.p50) * price, 2))),
                        p75=Decimal(str(round(float(q.p75) * price, 2))),
                        p90=Decimal(str(round(float(q.p90) * price, 2))),
                    )
                    for q in fr.quantiles
                ]
                result.revenue_results.append(
                    ForecastResult(
                        produto_id=fr.produto_id,
                        model_name=f"{fr.model_name}_REVENUE",
                        quantiles=revenue_quantiles,
                    )
                )
                revenue_count += 1

            step7.status = StepStatus.COMPLETED
            step7.products_processed = revenue_count
        else:
            step7.status = StepStatus.SKIPPED
        result.steps.append(step7)

        # Step 8: Calculate metrics via backtesting
        step8 = StepLog(8, "calculate_metrics")
        if self._config.include_backtest and series_by_product and result.total_products > 0:
            try:
                backtester = Backtester(
                    holdout_weeks=self._config.holdout_weeks,
                )
                all_pids = []
                for seg in segments.values():
                    all_pids.extend(seg.produto_ids)

                cls_map = class_by_product or {}

                bt_result = await backtester.run(
                    models=self._models,
                    produto_ids=all_pids,
                    series_by_product=series_by_product,  # type: ignore[arg-type]
                    class_by_product=cls_map,
                )
                bt_result.model_metadata = backtester.collect_metadata(
                    self._models, bt_result
                )
                result.backtest_result = bt_result
                step8.status = StepStatus.COMPLETED
                step8.products_processed = bt_result.products_tested
            except Exception as e:
                step8.status = StepStatus.FAILED
                step8.error_message = str(e)
        else:
            step8.status = StepStatus.SKIPPED
        result.steps.append(step8)

        step9 = StepLog(9, "collect_results", StepStatus.COMPLETED, len(result.forecast_results))
        result.steps.append(step9)

        # Step 10: Finalize
        step10 = StepLog(10, "finalize", StepStatus.COMPLETED)
        result.steps.append(step10)

        result.status = StepStatus.COMPLETED
        return result
