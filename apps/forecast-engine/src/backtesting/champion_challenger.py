"""Champion-Challenger model selection service (Story 5.3, R-A03).

Compares newly trained models against the current champion and only
promotes a new model if it demonstrably outperforms the incumbent.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from src.backtesting.backtester import BacktestResult, ModelMetadata
from src.db.repositories.forecast_repo import ForecastRepository

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PromotionDecision:
    """Result of a champion-challenger comparison."""

    model_name: str
    promoted: bool
    new_mape: float
    champion_mape: float | None
    reason: str


@dataclass(frozen=True)
class PromotionLog:
    """Audit log entry for a promotion decision."""

    model_name: str
    promoted: bool
    new_mape: float
    champion_mape: float | None
    champion_model_id: str | None
    reason: str
    decided_at: str


class ChampionChallengerService:
    """Compares new models against the current champion per model type.

    AC-1: Loads current champion per model type from ForecastModelo (isChampion=true)
    AC-2: After backtest, compares new model metrics against current champion
    AC-3: Promotion rule: new model promoted only if MAPE < champion MAPE
    AC-4: If no current champion exists, the new model is automatically promoted
    AC-5: On promotion: old champion's isChampion set to false, new model's set to true
    AC-6: Promotion decision logged with before/after MAPE comparison
    """

    def __init__(self, repository: ForecastRepository) -> None:
        self._repo = repository

    def evaluate(
        self,
        backtest_result: BacktestResult,
        model_name: str,
        champion_mape: float | None,
    ) -> PromotionDecision:
        """Evaluate whether a new model should be promoted over the current champion.

        Args:
            backtest_result: Completed backtest result with per-product metrics.
            model_name: Name of the new model being evaluated.
            champion_mape: Average MAPE of the current champion (None if no champion).

        Returns:
            PromotionDecision with the comparison result.
        """
        per_product = backtest_result.per_product.get(model_name, {})

        if not per_product:
            return PromotionDecision(
                model_name=model_name,
                promoted=False,
                new_mape=0.0,
                champion_mape=champion_mape,
                reason="No backtest metrics available for model",
            )

        # AC-2: Compute average MAPE for the new model
        new_avg_mape = round(
            sum(m.mape for m in per_product.values()) / len(per_product), 4
        )

        # AC-4: If no current champion, auto-promote
        if champion_mape is None:
            return PromotionDecision(
                model_name=model_name,
                promoted=True,
                new_mape=new_avg_mape,
                champion_mape=None,
                reason="No existing champion — auto-promoted",
            )

        # AC-3: Promote only if new MAPE < champion MAPE
        if new_avg_mape < champion_mape:
            return PromotionDecision(
                model_name=model_name,
                promoted=True,
                new_mape=new_avg_mape,
                champion_mape=champion_mape,
                reason=f"New MAPE ({new_avg_mape:.2f}%) < Champion MAPE ({champion_mape:.2f}%)",
            )

        return PromotionDecision(
            model_name=model_name,
            promoted=False,
            new_mape=new_avg_mape,
            champion_mape=champion_mape,
            reason=f"New MAPE ({new_avg_mape:.2f}%) >= Champion MAPE ({champion_mape:.2f}%)",
        )

    async def apply_promotion(
        self,
        decision: PromotionDecision,
        new_model_id: str,
    ) -> PromotionLog:
        """Apply the promotion decision to the database.

        AC-5: On promotion, old champion demoted, new model promoted.
        AC-6: Promotion decision logged.

        Args:
            decision: The evaluated promotion decision.
            new_model_id: Database ID of the new model.

        Returns:
            PromotionLog for audit trail.
        """
        champion = await self._repo.find_current_champion(decision.model_name)
        champion_model_id = champion.id if champion else None

        if decision.promoted:
            # AC-5: Demote old champion, promote new one
            await self._repo.demote_champion(decision.model_name)
            await self._repo.promote_champion(new_model_id)

            logger.info(
                "Champion promoted: %s (MAPE: %.2f%%) replaces %s (MAPE: %s)",
                decision.model_name,
                decision.new_mape,
                champion_model_id or "none",
                f"{decision.champion_mape:.2f}%" if decision.champion_mape is not None else "N/A",
            )
        else:
            logger.info(
                "Champion retained for %s: new MAPE %.2f%% did not beat %.2f%%",
                decision.model_name,
                decision.new_mape,
                decision.champion_mape if decision.champion_mape is not None else 0.0,
            )

        # AC-6: Build audit log
        return PromotionLog(
            model_name=decision.model_name,
            promoted=decision.promoted,
            new_mape=decision.new_mape,
            champion_mape=decision.champion_mape,
            champion_model_id=champion_model_id,
            reason=decision.reason,
            decided_at=datetime.now(UTC).isoformat(),
        )

    async def collect_metadata_with_champion(
        self,
        models: dict[str, object],
        backtest_result: BacktestResult,
    ) -> list[ModelMetadata]:
        """Collect model metadata using champion comparison instead of baseline-only.

        AC-7: Uses champion comparison instead of baseline-only.

        Args:
            models: model_name -> trained model instance.
            backtest_result: Completed backtest result.

        Returns:
            List of ModelMetadata with champion-aware is_champion flags.
        """
        metadata_list: list[ModelMetadata] = []

        for model_name in models:
            per_product = backtest_result.per_product.get(model_name, {})

            training_metrics: dict[str, float] | None = None
            if per_product:
                all_mapes = [m.mape for m in per_product.values()]
                all_maes = [m.mae for m in per_product.values()]
                training_metrics = {
                    "avg_mape": round(sum(all_mapes) / len(all_mapes), 2),
                    "avg_mae": round(sum(all_maes) / len(all_maes), 2),
                    "products_tested": float(len(per_product)),
                }

            # AC-1: Load current champion from DB
            current_champion = await self._repo.find_current_champion(model_name)
            champion_mape: float | None = None
            if current_champion and current_champion.metricas_treino:
                champion_mape = current_champion.metricas_treino.get("avg_mape")

            # AC-2/3/4: Evaluate against champion
            decision = self.evaluate(backtest_result, model_name, champion_mape)

            # AC-9: Store promotion_log in training_metrics
            promotion_log: dict[str, object] = {
                "promoted": decision.promoted,
                "new_mape": decision.new_mape,
                "champion_mape": decision.champion_mape,
                "reason": decision.reason,
                "decided_at": datetime.now(UTC).isoformat(),
            }
            if training_metrics is not None:
                training_metrics["promotion_log"] = promotion_log  # type: ignore[assignment]

            metadata_list.append(
                ModelMetadata(
                    model_name=model_name,
                    version=1,
                    training_metrics=training_metrics,
                    is_champion=decision.promoted,
                )
            )

        return metadata_list
