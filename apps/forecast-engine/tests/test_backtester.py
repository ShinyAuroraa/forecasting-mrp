"""Tests for the Backtester orchestrator."""

import numpy as np
import pytest

from src.backtesting.backtester import Backtester, ModelMetadata
from src.models.ets.ets_model import ETSModel
from src.models.naive.naive_model import NaiveModel


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
        model.train(["p1", "p2"], series_by_product={"p1": long_series, "p2": long_series})
    )
    return model


@pytest.fixture
def trained_ets(long_series: np.ndarray) -> ETSModel:
    import asyncio

    model = ETSModel(seasonal_periods=12, n_sim_paths=50, seed=42)
    asyncio.get_event_loop().run_until_complete(
        model.train(["p1", "p2"], series_by_product={"p1": long_series, "p2": long_series})
    )
    return model


class TestBacktester:
    @pytest.mark.asyncio
    async def test_run_returns_result(
        self, trained_naive: NaiveModel, long_series: np.ndarray
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        assert result.products_tested == 1
        assert "NAIVE" in result.per_product
        assert "BASELINE" in result.per_product

    @pytest.mark.asyncio
    async def test_baseline_always_computed(
        self, trained_naive: NaiveModel, long_series: np.ndarray
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        assert "BASELINE" in result.per_product
        assert "p1" in result.per_product["BASELINE"]
        assert "BASELINE" in result.per_class

    @pytest.mark.asyncio
    async def test_per_class_aggregation(
        self, trained_naive: NaiveModel, long_series: np.ndarray
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1", "p2"],
            series_by_product={"p1": long_series, "p2": long_series},
            class_by_product={"p1": "A", "p2": "B"},
        )

        assert "NAIVE" in result.per_class
        naive_classes = result.per_class["NAIVE"]
        assert "A" in naive_classes
        assert "B" in naive_classes

    @pytest.mark.asyncio
    async def test_baseline_comparisons(
        self, trained_naive: NaiveModel, long_series: np.ndarray
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        assert len(result.baseline_comparisons) >= 1
        comp = result.baseline_comparisons[0]
        assert comp.model_name == "NAIVE"
        assert comp.produto_id == "p1"

    @pytest.mark.asyncio
    async def test_empty_products(self, trained_naive: NaiveModel) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=[],
            series_by_product={},
            class_by_product={},
        )
        assert result.products_tested == 0
        assert len(result.per_product) == 0

    @pytest.mark.asyncio
    async def test_skips_short_series(self, trained_naive: NaiveModel) -> None:
        short_series = np.array([10.0, 20.0, 30.0])
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1"],
            series_by_product={"p1": short_series},
            class_by_product={"p1": "C"},
        )
        assert result.products_tested == 0

    @pytest.mark.asyncio
    async def test_multiple_models(
        self,
        trained_naive: NaiveModel,
        trained_ets: ETSModel,
        long_series: np.ndarray,
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive, "ETS": trained_ets},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        assert "NAIVE" in result.per_product
        assert "ETS" in result.per_product
        assert "BASELINE" in result.per_product
        assert len(result.baseline_comparisons) >= 2


class TestCollectMetadata:
    @pytest.mark.asyncio
    async def test_metadata_collected(
        self, trained_naive: NaiveModel, long_series: np.ndarray
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        metadata = backtester.collect_metadata({"NAIVE": trained_naive}, result)
        assert len(metadata) == 1
        assert isinstance(metadata[0], ModelMetadata)
        assert metadata[0].model_name == "NAIVE"
        assert metadata[0].version == 1

    @pytest.mark.asyncio
    async def test_training_metrics_populated(
        self, trained_naive: NaiveModel, long_series: np.ndarray
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        metadata = backtester.collect_metadata({"NAIVE": trained_naive}, result)
        assert metadata[0].training_metrics is not None
        assert "avg_mape" in metadata[0].training_metrics
        assert "avg_mae" in metadata[0].training_metrics
        assert "products_tested" in metadata[0].training_metrics

    @pytest.mark.asyncio
    async def test_champion_flag(
        self,
        trained_naive: NaiveModel,
        trained_ets: ETSModel,
        long_series: np.ndarray,
    ) -> None:
        backtester = Backtester(holdout_weeks=13)
        result = await backtester.run(
            models={"NAIVE": trained_naive, "ETS": trained_ets},
            produto_ids=["p1"],
            series_by_product={"p1": long_series},
            class_by_product={"p1": "A"},
        )

        metadata = backtester.collect_metadata(
            {"NAIVE": trained_naive, "ETS": trained_ets}, result
        )
        # At least one should be champion (beats baseline)
        champion_flags = [m.is_champion for m in metadata]
        assert isinstance(champion_flags[0], bool)
