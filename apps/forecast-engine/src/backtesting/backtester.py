"""Backtesting orchestrator — runs backtest across models and aggregates results (FR-029)."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from src.backtesting.metrics import (
    BaselineComparison,
    ClassMetrics,
    aggregate_by_class,
    compare_against_baseline,
    compute_baseline_metrics,
)
from src.models.base import AbstractForecastModel, BacktestMetrics


@dataclass(frozen=True)
class ModelMetadata:
    """Metadata for a trained model (FR-033)."""

    model_name: str
    version: int
    parameters: dict[str, object] | None = None
    training_metrics: dict[str, float] | None = None
    artifact_path: str | None = None
    is_champion: bool = False


@dataclass
class BacktestResult:
    """Complete backtesting result across all models."""

    per_product: dict[str, dict[str, BacktestMetrics]] = field(default_factory=dict)
    per_class: dict[str, dict[str, ClassMetrics]] = field(default_factory=dict)
    baseline_comparisons: list[BaselineComparison] = field(default_factory=list)
    model_metadata: list[ModelMetadata] = field(default_factory=list)
    products_tested: int = 0


class Backtester:
    """Orchestrates backtesting across all forecast models.

    Runs each model's backtest method, computes baseline (12-week MA),
    aggregates metrics by ABC class, and compares against baseline.
    """

    def __init__(self, holdout_weeks: int = 13, baseline_window: int = 12) -> None:
        self._holdout_weeks = holdout_weeks
        self._baseline_window = baseline_window

    async def run(
        self,
        models: dict[str, AbstractForecastModel],
        produto_ids: list[str],
        series_by_product: dict[str, NDArray[np.float64]],
        class_by_product: dict[str, str],
    ) -> BacktestResult:
        """Run backtesting for all models on the given products.

        Args:
            models: model_name -> trained model instance
            produto_ids: List of product IDs to backtest.
            series_by_product: produto_id -> time series data.
            class_by_product: produto_id -> ABC class ('A', 'B', 'C').

        Returns:
            BacktestResult with per-product, per-class, and baseline comparisons.
        """
        result = BacktestResult()

        valid_pids = [
            pid for pid in produto_ids
            if pid in series_by_product
            and len(series_by_product[pid]) > self._holdout_weeks
        ]
        result.products_tested = len(valid_pids)

        if not valid_pids:
            return result

        # Compute baseline metrics for all valid products
        baseline_metrics: dict[str, BacktestMetrics] = {}
        for pid in valid_pids:
            baseline_metrics[pid] = compute_baseline_metrics(
                series_by_product[pid],
                self._holdout_weeks,
                self._baseline_window,
            )
        result.per_product["BASELINE"] = baseline_metrics
        result.per_class["BASELINE"] = aggregate_by_class(
            baseline_metrics, class_by_product
        )

        # Run backtest for each model
        for model_name, model in models.items():
            model_metrics = await model.backtest(
                valid_pids,
                self._holdout_weeks,
                series_by_product=series_by_product,  # type: ignore[arg-type]
            )

            if not model_metrics:
                continue

            result.per_product[model_name] = model_metrics
            result.per_class[model_name] = aggregate_by_class(
                model_metrics, class_by_product
            )

            comparisons = compare_against_baseline(
                model_metrics, baseline_metrics, model_name
            )
            result.baseline_comparisons.extend(comparisons)

        return result

    def collect_metadata(
        self,
        models: dict[str, AbstractForecastModel],
        backtest_result: BacktestResult,
        champion_mapes: dict[str, float | None] | None = None,
    ) -> list[ModelMetadata]:
        """Collect model metadata from trained models and backtest results.

        AC-7 (Story 5.3): When champion_mapes is provided, uses champion comparison
        instead of baseline-only. Falls back to baseline comparison when champion
        data is not available.

        Args:
            models: model_name -> trained model.
            backtest_result: Completed backtest result.
            champion_mapes: model_name -> current champion avg MAPE (None = no champion).
                If not provided, falls back to baseline-only comparison.

        Returns:
            List of ModelMetadata entries.
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

            is_champion = False
            promotion_log: dict[str, object] | None = None

            if champion_mapes is not None:
                # AC-7: Champion-challenger comparison
                champ_mape = champion_mapes.get(model_name)
                model_avg_mape = (
                    sum(m.mape for m in per_product.values()) / len(per_product)
                    if per_product
                    else 0.0
                )

                if not per_product:
                    is_champion = False
                    reason = "No backtest metrics available"
                elif champ_mape is None:
                    # AC-4: No champion → auto-promote
                    is_champion = True
                    reason = "No existing champion — auto-promoted"
                elif model_avg_mape < champ_mape:
                    # AC-3: New model beats champion
                    is_champion = True
                    reason = f"New MAPE ({model_avg_mape:.2f}%) < Champion ({champ_mape:.2f}%)"
                else:
                    is_champion = False
                    reason = f"New MAPE ({model_avg_mape:.2f}%) >= Champion ({champ_mape:.2f}%)"

                # AC-9: Store promotion_log in training metrics
                promotion_log = {
                    "promoted": is_champion,
                    "new_mape": round(model_avg_mape, 4),
                    "champion_mape": champ_mape,
                    "reason": reason,
                }
            else:
                # Baseline-only comparison (backward compat)
                baseline_per_product = backtest_result.per_product.get("BASELINE", {})
                if per_product and baseline_per_product:
                    model_avg_mape = sum(
                        m.mape for m in per_product.values()
                    ) / len(per_product)
                    baseline_avg_mape = sum(
                        m.mape for m in baseline_per_product.values()
                    ) / len(baseline_per_product)
                    is_champion = model_avg_mape < baseline_avg_mape

            if training_metrics is not None and promotion_log is not None:
                training_metrics["promotion_log"] = promotion_log  # type: ignore[assignment]

            metadata_list.append(
                ModelMetadata(
                    model_name=model_name,
                    version=1,
                    training_metrics=training_metrics,
                    is_champion=is_champion,
                )
            )

        return metadata_list
