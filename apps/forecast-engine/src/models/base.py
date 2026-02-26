"""Abstract base model interface for all forecast models."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class ForecastQuantiles:
    """Quantile forecast output for a single period."""

    p10: Decimal
    p25: Decimal
    p50: Decimal
    p75: Decimal
    p90: Decimal


@dataclass(frozen=True)
class ForecastResult:
    """Forecast output for a single product across multiple periods."""

    produto_id: str
    model_name: str
    quantiles: list[ForecastQuantiles] = field(default_factory=list)


@dataclass(frozen=True)
class TrainResult:
    """Training output with metrics."""

    model_name: str
    version: int
    train_loss: float | None = None
    val_loss: float | None = None
    parameters: dict[str, object] | None = None
    artifact_path: str | None = None


@dataclass(frozen=True)
class BacktestMetrics:
    """Backtesting accuracy metrics."""

    mape: float
    mae: float
    rmse: float
    bias: float


class AbstractForecastModel(ABC):
    """Contract that all forecast models must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Model identifier (e.g., 'TFT', 'ETS', 'CROSTON')."""

    @abstractmethod
    async def train(
        self,
        produto_ids: list[str],
        *,
        force_retrain: bool = False,
    ) -> TrainResult:
        """Train the model on historical data for the given products."""

    @abstractmethod
    async def predict(
        self,
        produto_ids: list[str],
        horizonte_semanas: int,
    ) -> list[ForecastResult]:
        """Generate quantile forecasts for the given products."""

    @abstractmethod
    async def backtest(
        self,
        produto_ids: list[str],
        holdout_weeks: int,
        series_by_product: dict[str, object] | None = None,
    ) -> dict[str, BacktestMetrics]:
        """Run backtesting and return metrics per product."""
