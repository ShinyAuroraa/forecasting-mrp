"""Tests for the forecast execution pipeline."""

from unittest.mock import MagicMock

import numpy as np
import pytest

from src.models.ets.ets_model import ETSModel
from src.models.naive.naive_model import NaiveModel
from src.models.tft.tft_config import TFTVolumeConfig
from src.models.tft.tft_model import TFTModel
from src.pipeline.executor import (
    ForecastPipeline,
    PipelineConfig,
    StepStatus,
)


def _make_classification(
    produto_id: str,
    classe_abc: str,
    padrao_demanda: str,
    modelo_override: str | None = None,
) -> MagicMock:
    mock = MagicMock()
    mock.produto_id = produto_id
    mock.classe_abc = classe_abc
    mock.padrao_demanda = padrao_demanda
    mock.modelo_forecast_sugerido = modelo_override
    return mock


@pytest.fixture
def long_series() -> np.ndarray:
    rng = np.random.default_rng(42)
    t = np.arange(104, dtype=np.float64)
    return 200 + 1.5 * t + rng.normal(0, 10, 104)


@pytest.fixture
def trained_models(long_series: np.ndarray) -> dict:
    """Pre-trained models dict for pipeline."""
    import asyncio

    tft = TFTModel(config=TFTVolumeConfig(max_epochs=2), seed=42)
    ets = ETSModel(seasonal_periods=12, n_sim_paths=50, seed=42)
    naive = NaiveModel(seed=42)

    asyncio.get_event_loop().run_until_complete(
        tft.train(["p1", "p2"], series_by_product={"p1": long_series, "p2": long_series})
    )
    asyncio.get_event_loop().run_until_complete(
        ets.train(["p3"], series_by_product={"p3": long_series})
    )
    asyncio.get_event_loop().run_until_complete(
        naive.train(["p4"], series_by_product={"p4": long_series})
    )

    return {"TFT": tft, "ETS": ets, "NAIVE": naive}


@pytest.fixture
def pipeline(trained_models: dict) -> ForecastPipeline:
    return ForecastPipeline(
        models=trained_models,
        config=PipelineConfig(horizonte_semanas=4),
    )


class TestPipelineExecution:
    @pytest.mark.asyncio
    async def test_basic_execution(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p3", "C", "REGULAR"),
        ]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series, "p3": long_series},
        )

        assert result.status == StepStatus.COMPLETED
        assert len(result.steps) == 10
        assert result.total_products > 0

    @pytest.mark.asyncio
    async def test_step_1_loads_data(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [_make_classification("p1", "A", "REGULAR")]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series},
        )

        step1 = result.steps[0]
        assert step1.step_name == "load_data"
        assert step1.status == StepStatus.COMPLETED
        assert step1.products_processed == 1

    @pytest.mark.asyncio
    async def test_step_2_segments_skus(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p3", "C", "REGULAR"),
        ]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series, "p3": long_series},
        )

        step2 = result.steps[1]
        assert step2.step_name == "segment_skus"
        assert step2.status == StepStatus.COMPLETED
        assert step2.products_processed == 2

    @pytest.mark.asyncio
    async def test_forecast_results_generated(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p3", "C", "REGULAR"),
        ]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series, "p3": long_series},
        )

        assert len(result.forecast_results) >= 1
        for fr in result.forecast_results:
            assert len(fr.quantiles) == 4  # horizonte_semanas=4

    @pytest.mark.asyncio
    async def test_revenue_calculation(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [_make_classification("p1", "A", "REGULAR")]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series},
            prices_by_product={"p1": 25.0},
        )

        assert len(result.revenue_results) >= 1
        rev = result.revenue_results[0]
        assert "_REVENUE" in rev.model_name
        assert len(rev.quantiles) == 4

    @pytest.mark.asyncio
    async def test_revenue_skipped_without_prices(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [_make_classification("p1", "A", "REGULAR")]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series},
        )

        step7 = [s for s in result.steps if s.step_name == "calculate_revenue"][0]
        assert step7.status == StepStatus.SKIPPED

    @pytest.mark.asyncio
    async def test_empty_classifications(self, pipeline: ForecastPipeline) -> None:
        result = await pipeline.execute([], series_by_product={})
        assert result.status == StepStatus.COMPLETED
        assert result.total_products == 0

    @pytest.mark.asyncio
    async def test_all_10_steps_logged(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [_make_classification("p1", "A", "REGULAR")]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series},
        )

        step_names = [s.step_name for s in result.steps]
        assert "load_data" in step_names
        assert "segment_skus" in step_names
        assert "execute_tft" in step_names
        assert "execute_ets" in step_names
        assert "execute_croston_tsb" in step_names
        assert "execute_lgbm_ensemble" in step_names
        assert "calculate_revenue" in step_names
        assert "finalize" in step_names

    @pytest.mark.asyncio
    async def test_insufficient_data_fallback(
        self, pipeline: ForecastPipeline, long_series: np.ndarray
    ) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
        ]
        result = await pipeline.execute(
            classifications,
            series_by_product={"p1": long_series},
            weeks_by_product={"p1": 20},
        )

        # With 20 weeks, falls back to ETS
        assert result.status == StepStatus.COMPLETED
