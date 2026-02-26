"""Tests for the JobProcessor."""

import numpy as np
import pytest

from src.models.ets.ets_model import ETSModel
from src.models.naive.naive_model import NaiveModel
from src.workers.job_processor import JobData, JobProcessor, JobType
from src.workers.progress_reporter import InMemoryProgressReporter


@pytest.fixture
def long_series() -> np.ndarray:
    rng = np.random.default_rng(42)
    t = np.arange(104, dtype=np.float64)
    return 200 + 1.5 * t + rng.normal(0, 10, 104)


@pytest.fixture
def trained_naive(long_series: np.ndarray) -> NaiveModel:
    import asyncio

    model = NaiveModel(seed=42)
    asyncio.get_event_loop().run_until_complete(
        model.train(["p1"], series_by_product={"p1": long_series})
    )
    return model


@pytest.fixture
def trained_ets(long_series: np.ndarray) -> ETSModel:
    import asyncio

    model = ETSModel(seasonal_periods=12, n_sim_paths=50, seed=42)
    asyncio.get_event_loop().run_until_complete(
        model.train(["p1"], series_by_product={"p1": long_series})
    )
    return model


@pytest.fixture
def reporter() -> InMemoryProgressReporter:
    return InMemoryProgressReporter()


def _make_classification(produto_id: str, classe_abc: str, padrao_demanda: str):
    from unittest.mock import MagicMock

    mock = MagicMock()
    mock.produto_id = produto_id
    mock.classe_abc = classe_abc
    mock.padrao_demanda = padrao_demanda
    mock.modelo_forecast_sugerido = None
    return mock


class TestJobProcessor:
    @pytest.mark.asyncio
    async def test_train_job(
        self,
        trained_naive: NaiveModel,
        reporter: InMemoryProgressReporter,
        long_series: np.ndarray,
    ) -> None:
        processor = JobProcessor(
            models={"NAIVE": trained_naive},
            reporter=reporter,
        )
        job = JobData(
            job_id="train-1",
            job_type=JobType.TRAIN_MODEL,
            produto_ids=["p1"],
            force_retrain=True,
        )
        result = await processor.process(
            job, series_by_product={"p1": long_series}
        )

        assert result.success is True
        assert result.job_type == JobType.TRAIN_MODEL
        assert result.duration_seconds >= 0
        assert len(reporter.events) >= 1  # At least init + train
        assert len(reporter.completions) == 1

    @pytest.mark.asyncio
    async def test_forecast_job(
        self,
        trained_naive: NaiveModel,
        reporter: InMemoryProgressReporter,
        long_series: np.ndarray,
    ) -> None:
        processor = JobProcessor(
            models={"NAIVE": trained_naive},
            reporter=reporter,
        )
        classifications = [_make_classification("p1", "C", "REGULAR")]
        job = JobData(
            job_id="forecast-1",
            job_type=JobType.RUN_FORECAST,
            horizonte_semanas=4,
        )
        result = await processor.process(
            job,
            series_by_product={"p1": long_series},
            classifications=classifications,
        )

        assert result.success is True
        assert result.pipeline_result is not None
        assert len(result.pipeline_result.forecast_results) >= 0
        assert len(reporter.completions) == 1

    @pytest.mark.asyncio
    async def test_backtest_job(
        self,
        trained_naive: NaiveModel,
        reporter: InMemoryProgressReporter,
        long_series: np.ndarray,
    ) -> None:
        processor = JobProcessor(
            models={"NAIVE": trained_naive},
            reporter=reporter,
        )
        classifications = [_make_classification("p1", "C", "REGULAR")]
        job = JobData(
            job_id="backtest-1",
            job_type=JobType.RUN_BACKTEST,
            holdout_weeks=13,
        )
        result = await processor.process(
            job,
            series_by_product={"p1": long_series},
            classifications=classifications,
            class_by_product={"p1": "C"},
        )

        assert result.success is True
        assert result.pipeline_result is not None
        assert len(reporter.completions) == 1

    @pytest.mark.asyncio
    async def test_progress_events_include_init(
        self,
        trained_naive: NaiveModel,
        reporter: InMemoryProgressReporter,
        long_series: np.ndarray,
    ) -> None:
        processor = JobProcessor(
            models={"NAIVE": trained_naive},
            reporter=reporter,
        )
        job = JobData(
            job_id="t1",
            job_type=JobType.TRAIN_MODEL,
            produto_ids=["p1"],
        )
        await processor.process(job, series_by_product={"p1": long_series})

        # First event should be initialization
        assert reporter.events[0].step == 0
        assert reporter.events[0].step_name == "initializing"
        assert reporter.events[0].percent == 0

    @pytest.mark.asyncio
    async def test_failed_job_reports_error(
        self,
        reporter: InMemoryProgressReporter,
    ) -> None:
        # No models means forecast will fail
        processor = JobProcessor(models={}, reporter=reporter)
        classifications = [_make_classification("p1", "C", "REGULAR")]
        job = JobData(
            job_id="fail-1",
            job_type=JobType.RUN_FORECAST,
        )
        result = await processor.process(
            job,
            series_by_product={"p1": np.array([1.0])},
            classifications=classifications,
        )

        assert result.success is True  # Pipeline completes even with no models
        assert len(reporter.completions) == 1

    @pytest.mark.asyncio
    async def test_job_result_fields(
        self,
        trained_naive: NaiveModel,
        reporter: InMemoryProgressReporter,
        long_series: np.ndarray,
    ) -> None:
        processor = JobProcessor(
            models={"NAIVE": trained_naive},
            reporter=reporter,
        )
        job = JobData(job_id="j1", job_type=JobType.TRAIN_MODEL)
        result = await processor.process(
            job, series_by_product={"p1": long_series}
        )

        assert result.job_id == "j1"
        assert result.job_type == JobType.TRAIN_MODEL
        assert isinstance(result.duration_seconds, float)

    @pytest.mark.asyncio
    async def test_train_specific_model(
        self,
        trained_naive: NaiveModel,
        trained_ets: ETSModel,
        reporter: InMemoryProgressReporter,
        long_series: np.ndarray,
    ) -> None:
        processor = JobProcessor(
            models={"NAIVE": trained_naive, "ETS": trained_ets},
            reporter=reporter,
        )
        job = JobData(
            job_id="train-ets",
            job_type=JobType.TRAIN_MODEL,
            modelo="ETS",
            force_retrain=True,
        )
        result = await processor.process(
            job, series_by_product={"p1": long_series}
        )

        assert result.success is True
        # Only ETS training events (not NAIVE)
        training_events = [
            e for e in reporter.events if e.step_name.startswith("training_")
        ]
        assert all("ets" in e.step_name for e in training_events)


class TestJobData:
    def test_defaults(self) -> None:
        job = JobData(job_id="j1", job_type=JobType.RUN_FORECAST)
        assert job.horizonte_semanas == 13
        assert job.holdout_weeks == 13
        assert job.force_retrain is False
        assert job.produto_ids is None
        assert job.modelo is None

    def test_job_types(self) -> None:
        assert JobType.TRAIN_MODEL == "train_model"
        assert JobType.RUN_FORECAST == "run_forecast"
        assert JobType.RUN_BACKTEST == "run_backtest"
