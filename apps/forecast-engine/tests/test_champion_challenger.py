"""Tests for the ChampionChallengerService (Story 5.3, AC-14/AC-15)."""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from src.backtesting.backtester import Backtester, BacktestResult, ModelMetadata
from src.backtesting.champion_challenger import (
    ChampionChallengerService,
    PromotionDecision,
    PromotionLog,
)
from src.db.repositories.forecast_repo import ForecastRepository
from src.models.base import BacktestMetrics


def _make_backtest_result(
    model_name: str, mapes: dict[str, float]
) -> BacktestResult:
    """Build a BacktestResult with synthetic per-product metrics."""
    per_product: dict[str, dict[str, BacktestMetrics]] = {
        model_name: {
            pid: BacktestMetrics(mape=mape, mae=mape * 0.8, rmse=mape * 1.2, bias=0.0)
            for pid, mape in mapes.items()
        },
        "BASELINE": {
            pid: BacktestMetrics(mape=20.0, mae=16.0, rmse=24.0, bias=0.0)
            for pid in mapes
        },
    }
    return BacktestResult(
        per_product=per_product,
        products_tested=len(mapes),
    )


class TestChampionChallengerEvaluate:
    """AC-14: Champion-challenger comparison with seeded data, deterministic."""

    def test_promote_when_better_than_champion(self) -> None:
        """AC-3: New model promoted when MAPE < champion MAPE."""
        repo = MagicMock(spec=ForecastRepository)
        service = ChampionChallengerService(repo)

        bt = _make_backtest_result("TFT", {"p1": 5.0, "p2": 7.0})
        decision = service.evaluate(bt, "TFT", champion_mape=10.0)

        assert decision.promoted is True
        assert decision.new_mape == 6.0  # avg(5,7)
        assert decision.champion_mape == 10.0
        assert "New MAPE" in decision.reason
        assert "Champion" in decision.reason

    def test_no_promote_when_worse_than_champion(self) -> None:
        """AC-3: New model NOT promoted when MAPE >= champion MAPE."""
        repo = MagicMock(spec=ForecastRepository)
        service = ChampionChallengerService(repo)

        bt = _make_backtest_result("TFT", {"p1": 12.0, "p2": 14.0})
        decision = service.evaluate(bt, "TFT", champion_mape=10.0)

        assert decision.promoted is False
        assert decision.new_mape == 13.0
        assert decision.champion_mape == 10.0

    def test_no_promote_when_equal_to_champion(self) -> None:
        """AC-3: Equal MAPE does not trigger promotion."""
        repo = MagicMock(spec=ForecastRepository)
        service = ChampionChallengerService(repo)

        bt = _make_backtest_result("TFT", {"p1": 10.0})
        decision = service.evaluate(bt, "TFT", champion_mape=10.0)

        assert decision.promoted is False

    def test_auto_promote_when_no_champion(self) -> None:
        """AC-4: If no current champion exists, new model is auto-promoted."""
        repo = MagicMock(spec=ForecastRepository)
        service = ChampionChallengerService(repo)

        bt = _make_backtest_result("TFT", {"p1": 15.0})
        decision = service.evaluate(bt, "TFT", champion_mape=None)

        assert decision.promoted is True
        assert decision.champion_mape is None
        assert "auto-promoted" in decision.reason

    def test_no_promote_when_no_metrics(self) -> None:
        """No backtest metrics → no promotion."""
        repo = MagicMock(spec=ForecastRepository)
        service = ChampionChallengerService(repo)

        bt = BacktestResult(per_product={}, products_tested=0)
        decision = service.evaluate(bt, "TFT", champion_mape=5.0)

        assert decision.promoted is False
        assert "No backtest metrics" in decision.reason

    def test_deterministic_with_seeded_data(self) -> None:
        """AC-14: Results are deterministic with seeded data."""
        repo = MagicMock(spec=ForecastRepository)
        service = ChampionChallengerService(repo)

        rng = np.random.default_rng(42)
        mapes = {f"p{i}": round(float(rng.uniform(3, 15)), 2) for i in range(10)}
        bt = _make_backtest_result("ETS", mapes)

        d1 = service.evaluate(bt, "ETS", champion_mape=10.0)
        d2 = service.evaluate(bt, "ETS", champion_mape=10.0)

        assert d1.promoted == d2.promoted
        assert d1.new_mape == d2.new_mape


class TestPromotionScenarios:
    """AC-15: Promotion and no-promotion scenarios."""

    @pytest.mark.asyncio
    async def test_apply_promotion_demotes_old_champion(self) -> None:
        """AC-5: On promotion, old champion demoted, new champion promoted."""
        mock_repo = AsyncMock(spec=ForecastRepository)
        mock_champion = MagicMock()
        mock_champion.id = "old-champion-id"
        mock_repo.find_current_champion.return_value = mock_champion
        mock_repo.demote_champion = AsyncMock()
        mock_repo.promote_champion = AsyncMock()

        service = ChampionChallengerService(mock_repo)
        decision = PromotionDecision(
            model_name="TFT",
            promoted=True,
            new_mape=5.0,
            champion_mape=10.0,
            reason="New MAPE (5.00%) < Champion (10.00%)",
        )

        log = await service.apply_promotion(decision, "new-model-id")

        mock_repo.demote_champion.assert_awaited_once_with("TFT")
        mock_repo.promote_champion.assert_awaited_once_with("new-model-id")
        assert log.promoted is True
        assert log.champion_model_id == "old-champion-id"

    @pytest.mark.asyncio
    async def test_apply_no_promotion_keeps_champion(self) -> None:
        """AC-5: When not promoted, no DB changes occur."""
        mock_repo = AsyncMock(spec=ForecastRepository)
        mock_champion = MagicMock()
        mock_champion.id = "existing-champion-id"
        mock_repo.find_current_champion.return_value = mock_champion

        service = ChampionChallengerService(mock_repo)
        decision = PromotionDecision(
            model_name="TFT",
            promoted=False,
            new_mape=12.0,
            champion_mape=10.0,
            reason="New MAPE (12.00%) >= Champion (10.00%)",
        )

        log = await service.apply_promotion(decision, "new-model-id")

        mock_repo.demote_champion.assert_not_awaited()
        mock_repo.promote_champion.assert_not_awaited()
        assert log.promoted is False

    @pytest.mark.asyncio
    async def test_apply_promotion_no_existing_champion(self) -> None:
        """AC-4 + AC-5: Auto-promote when no champion exists."""
        mock_repo = AsyncMock(spec=ForecastRepository)
        mock_repo.find_current_champion.return_value = None
        mock_repo.demote_champion = AsyncMock()
        mock_repo.promote_champion = AsyncMock()

        service = ChampionChallengerService(mock_repo)
        decision = PromotionDecision(
            model_name="ETS",
            promoted=True,
            new_mape=8.0,
            champion_mape=None,
            reason="No existing champion — auto-promoted",
        )

        log = await service.apply_promotion(decision, "first-model-id")

        mock_repo.demote_champion.assert_awaited_once_with("ETS")
        mock_repo.promote_champion.assert_awaited_once_with("first-model-id")
        assert log.promoted is True
        assert log.champion_model_id is None

    @pytest.mark.asyncio
    async def test_promotion_log_has_audit_fields(self) -> None:
        """AC-6: Promotion log includes before/after MAPE comparison."""
        mock_repo = AsyncMock(spec=ForecastRepository)
        mock_champion = MagicMock()
        mock_champion.id = "champ-id"
        mock_repo.find_current_champion.return_value = mock_champion
        mock_repo.demote_champion = AsyncMock()
        mock_repo.promote_champion = AsyncMock()

        service = ChampionChallengerService(mock_repo)
        decision = PromotionDecision(
            model_name="TFT",
            promoted=True,
            new_mape=4.5,
            champion_mape=8.0,
            reason="New MAPE (4.50%) < Champion (8.00%)",
        )

        log = await service.apply_promotion(decision, "new-id")

        assert log.model_name == "TFT"
        assert log.new_mape == 4.5
        assert log.champion_mape == 8.0
        assert log.champion_model_id == "champ-id"
        assert log.decided_at  # ISO timestamp present
        assert "New MAPE" in log.reason


class TestBacktesterChampionIntegration:
    """Test that Backtester.collect_metadata works with champion_mapes."""

    def test_collect_metadata_with_champion_mapes(self) -> None:
        """AC-7: Uses champion comparison when champion_mapes is provided."""
        bt_result = _make_backtest_result("TFT", {"p1": 5.0, "p2": 7.0})
        backtester = Backtester()

        # Champion has MAPE 10.0, new model avg is 6.0 → should be promoted
        metadata = backtester.collect_metadata(
            {"TFT": MagicMock()},
            bt_result,
            champion_mapes={"TFT": 10.0},
        )

        assert len(metadata) == 1
        assert metadata[0].is_champion is True
        assert metadata[0].training_metrics is not None
        assert "promotion_log" in metadata[0].training_metrics

    def test_collect_metadata_no_champion_auto_promote(self) -> None:
        """AC-4: No champion → auto-promote via collect_metadata."""
        bt_result = _make_backtest_result("ETS", {"p1": 8.0})
        backtester = Backtester()

        metadata = backtester.collect_metadata(
            {"ETS": MagicMock()},
            bt_result,
            champion_mapes={"ETS": None},
        )

        assert metadata[0].is_champion is True
        log = metadata[0].training_metrics["promotion_log"]
        assert log["promoted"] is True
        assert "auto-promoted" in log["reason"]

    def test_collect_metadata_no_promotion(self) -> None:
        """AC-3: No promotion when MAPE >= champion."""
        bt_result = _make_backtest_result("TFT", {"p1": 12.0})
        backtester = Backtester()

        metadata = backtester.collect_metadata(
            {"TFT": MagicMock()},
            bt_result,
            champion_mapes={"TFT": 10.0},
        )

        assert metadata[0].is_champion is False

    def test_collect_metadata_backward_compat(self) -> None:
        """Backward compatibility: without champion_mapes, uses baseline."""
        bt_result = _make_backtest_result("TFT", {"p1": 5.0})
        backtester = Backtester()

        metadata = backtester.collect_metadata(
            {"TFT": MagicMock()},
            bt_result,
        )

        # Without champion_mapes, falls back to baseline comparison
        assert isinstance(metadata[0].is_champion, bool)
        # TFT with MAPE 5.0 beats baseline with MAPE 20.0
        assert metadata[0].is_champion is True

    def test_promotion_log_stored_in_training_metrics(self) -> None:
        """AC-9: promotion_log stored as JSON in training metrics."""
        bt_result = _make_backtest_result("TFT", {"p1": 5.0})
        backtester = Backtester()

        metadata = backtester.collect_metadata(
            {"TFT": MagicMock()},
            bt_result,
            champion_mapes={"TFT": 10.0},
        )

        log = metadata[0].training_metrics["promotion_log"]
        assert isinstance(log, dict)
        assert "promoted" in log
        assert "new_mape" in log
        assert "champion_mape" in log
        assert "reason" in log
