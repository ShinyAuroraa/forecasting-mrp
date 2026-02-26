"""Job processor — wraps pipeline execution with progress reporting (FR-030)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import numpy as np
from numpy.typing import NDArray

from src.models.base import AbstractForecastModel
from src.pipeline.executor import ForecastPipeline, PipelineConfig, PipelineResult
from src.workers.progress_reporter import (
    InMemoryProgressReporter,
    ProgressEvent,
    ProgressReporter,
)


class JobType(StrEnum):
    """Supported job types."""

    TRAIN_MODEL = "train_model"
    RUN_FORECAST = "run_forecast"
    RUN_BACKTEST = "run_backtest"


@dataclass
class JobData:
    """Deserialized job payload."""

    job_id: str
    job_type: JobType
    produto_ids: list[str] | None = None
    modelo: str | None = None
    horizonte_semanas: int = 13
    holdout_weeks: int = 13
    force_retrain: bool = False


@dataclass
class JobResult:
    """Result of processing a job."""

    job_id: str
    job_type: JobType
    success: bool
    duration_seconds: float
    pipeline_result: PipelineResult | None = None
    error: str | None = None


class JobProcessor:
    """Processes forecast jobs with progress reporting.

    Wraps ForecastPipeline execution and reports progress
    at each pipeline step via a ProgressReporter.
    """

    TOTAL_STEPS = 10

    def __init__(
        self,
        models: dict[str, AbstractForecastModel],
        reporter: ProgressReporter | None = None,
    ) -> None:
        self._models = models
        self._reporter: Any = reporter or InMemoryProgressReporter()

    async def process(
        self,
        job: JobData,
        series_by_product: dict[str, NDArray[np.float64]],
        classifications: list[object] | None = None,
        prices_by_product: dict[str, float] | None = None,
        class_by_product: dict[str, str] | None = None,
        weeks_by_product: dict[str, int] | None = None,
    ) -> JobResult:
        """Process a forecast job with progress reporting.

        Args:
            job: Deserialized job data.
            series_by_product: Time series data per product.
            classifications: SKU classifications (for forecast jobs).
            prices_by_product: Prices for revenue calculation.
            class_by_product: ABC class mapping.
            weeks_by_product: Weeks of data per product.

        Returns:
            JobResult with outcome and pipeline result.
        """
        start_time = time.monotonic()

        try:
            # Report job start
            await self._reporter.report(
                ProgressEvent(
                    job_id=job.job_id,
                    step=0,
                    total_steps=self.TOTAL_STEPS,
                    step_name="initializing",
                    percent=0,
                    products_processed=0,
                    products_total=len(series_by_product),
                )
            )

            if job.job_type == JobType.TRAIN_MODEL:
                result = await self._process_train(
                    job, series_by_product
                )
            elif job.job_type == JobType.RUN_FORECAST:
                result = await self._process_forecast(
                    job,
                    series_by_product,
                    classifications or [],
                    prices_by_product,
                    class_by_product,
                    weeks_by_product,
                )
            elif job.job_type == JobType.RUN_BACKTEST:
                result = await self._process_backtest(
                    job,
                    series_by_product,
                    classifications or [],
                    class_by_product,
                    weeks_by_product,
                )
            else:
                msg = f"Unknown job type: {job.job_type}"
                raise ValueError(msg)

            duration = time.monotonic() - start_time
            await self._reporter.report_completed(job.job_id, duration)

            return JobResult(
                job_id=job.job_id,
                job_type=job.job_type,
                success=True,
                duration_seconds=round(duration, 2),
                pipeline_result=result,
            )

        except Exception as e:
            duration = time.monotonic() - start_time
            await self._reporter.report_failed(job.job_id, str(e), 0)

            return JobResult(
                job_id=job.job_id,
                job_type=job.job_type,
                success=False,
                duration_seconds=round(duration, 2),
                error=str(e),
            )

    async def _process_train(
        self,
        job: JobData,
        series_by_product: dict[str, NDArray[np.float64]],
    ) -> PipelineResult | None:
        """Train specified model(s)."""
        pids = job.produto_ids or list(series_by_product.keys())
        step = 1

        for model_name, model in self._models.items():
            if job.modelo and model_name != job.modelo:
                continue

            await self._reporter.report(
                ProgressEvent(
                    job_id=job.job_id,
                    step=step,
                    total_steps=len(self._models),
                    step_name=f"training_{model_name.lower()}",
                    percent=int(step / len(self._models) * 100),
                    products_processed=0,
                    products_total=len(pids),
                )
            )

            await model.train(
                pids,
                force_retrain=job.force_retrain,
                series_by_product=series_by_product,  # type: ignore[call-arg]
            )
            step += 1

        return None

    async def _process_forecast(
        self,
        job: JobData,
        series_by_product: dict[str, NDArray[np.float64]],
        classifications: list[object],
        prices_by_product: dict[str, float] | None,
        class_by_product: dict[str, str] | None,
        weeks_by_product: dict[str, int] | None,
    ) -> PipelineResult:
        """Run forecast pipeline."""
        config = PipelineConfig(
            horizonte_semanas=job.horizonte_semanas,
            include_backtest=False,
        )
        pipeline = ForecastPipeline(
            models=self._models,
            config=config,
        )

        # Create a progress callback for the pipeline
        async def on_step(step_num: int, step_name: str, products: int) -> None:
            await self._reporter.report(
                ProgressEvent(
                    job_id=job.job_id,
                    step=step_num,
                    total_steps=self.TOTAL_STEPS,
                    step_name=step_name,
                    percent=int(step_num / self.TOTAL_STEPS * 100),
                    products_processed=products,
                    products_total=len(series_by_product),
                )
            )

        return await pipeline.execute(
            classifications,
            series_by_product,  # type: ignore[arg-type]
            prices_by_product=prices_by_product,
            class_by_product=class_by_product,
            weeks_by_product=weeks_by_product,
            progress_callback=on_step,
        )

    async def _process_backtest(
        self,
        job: JobData,
        series_by_product: dict[str, NDArray[np.float64]],
        classifications: list[object],
        class_by_product: dict[str, str] | None,
        weeks_by_product: dict[str, int] | None,
    ) -> PipelineResult:
        """Run backtest pipeline."""
        config = PipelineConfig(
            horizonte_semanas=job.horizonte_semanas,
            holdout_weeks=job.holdout_weeks,
            include_revenue=False,
            include_backtest=True,
        )
        pipeline = ForecastPipeline(
            models=self._models,
            config=config,
        )

        return await pipeline.execute(
            classifications,
            series_by_product,  # type: ignore[arg-type]
            class_by_product=class_by_product,
            weeks_by_product=weeks_by_product,
        )
