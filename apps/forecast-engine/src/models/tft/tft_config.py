"""TFT hyperparameter configuration."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TFTConfig:
    """Hyperparameters for TFT model training and inference.

    Defaults tuned for weekly demand forecasting with 52-week history.
    """

    # Data windows
    input_length: int = 52
    forecast_horizon: int = 13

    # Architecture
    hidden_size: int = 64
    attention_head_size: int = 4
    num_attention_heads: int = 4
    dropout: float = 0.1
    hidden_continuous_size: int = 16

    # Training
    batch_size: int = 64
    max_epochs: int = 50
    learning_rate: float = 0.001
    gradient_clip_val: float = 0.1
    early_stop_patience: int = 5

    # Quantile targets
    quantiles: tuple[float, ...] = (0.1, 0.25, 0.5, 0.75, 0.9)

    # Model management
    max_versions: int = 5
    min_mape_improvement: float = 1.0

    # Retraining triggers
    mape_degrade_threshold: float = 5.0


@dataclass(frozen=True)
class TFTVolumeConfig(TFTConfig):
    """Config for TFT Volume model."""

    target_column: str = "volume"
    model_prefix: str = "tft_volume"


@dataclass(frozen=True)
class TFTRevenueConfig(TFTConfig):
    """Config for TFT Revenue model — includes price as observed variable."""

    target_column: str = "revenue"
    model_prefix: str = "tft_revenue"
    include_price_features: bool = True
