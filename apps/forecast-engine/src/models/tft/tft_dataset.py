"""TFT dataset preparation — transforms raw data into model-ready format."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from src.models.tft.tft_config import TFTConfig


@dataclass
class TFTDataset:
    """Prepared dataset for TFT training/inference.

    Converts raw time series into windowed input/target pairs with features.
    """

    produto_ids: list[str] = field(default_factory=list)
    time_idx: NDArray[np.int64] = field(default_factory=lambda: np.array([], dtype=np.int64))
    targets: NDArray[np.float64] = field(default_factory=lambda: np.array([], dtype=np.float64))
    group_ids: NDArray[np.int64] = field(default_factory=lambda: np.array([], dtype=np.int64))
    static_categoricals: dict[str, NDArray[np.int64]] = field(default_factory=dict)
    time_varying_known: dict[str, NDArray[np.float64]] = field(default_factory=dict)
    time_varying_unknown: dict[str, NDArray[np.float64]] = field(default_factory=dict)


def compute_lag_features(
    series: NDArray[np.float64],
    lags: tuple[int, ...] = (1, 2, 4, 8, 13, 26, 52),
) -> dict[str, NDArray[np.float64]]:
    """Compute lag features for a single time series.

    Returns dict of lag_name -> lagged values (NaN-padded at start).
    """
    features: dict[str, NDArray[np.float64]] = {}
    n = len(series)
    for lag in lags:
        lagged = np.full(n, np.nan, dtype=np.float64)
        if lag < n:
            lagged[lag:] = series[:-lag]
        features[f"lag_{lag}w"] = lagged
    return features


def compute_rolling_features(
    series: NDArray[np.float64],
    windows: tuple[int, ...] = (4, 13),
) -> dict[str, NDArray[np.float64]]:
    """Compute rolling mean and std features.

    Returns dict of feature_name -> rolling values (NaN-padded at start).
    """
    features: dict[str, NDArray[np.float64]] = {}
    n = len(series)
    for w in windows:
        mean_arr = np.full(n, np.nan, dtype=np.float64)
        std_arr = np.full(n, np.nan, dtype=np.float64)
        for i in range(w - 1, n):
            window_data = series[i - w + 1 : i + 1]
            mean_arr[i] = float(np.mean(window_data))
            std_arr[i] = float(np.std(window_data))
        features[f"rolling_mean_{w}w"] = mean_arr
        features[f"rolling_std_{w}w"] = std_arr
    return features


def compute_temporal_features(
    n_weeks: int,
    start_week: int = 1,
) -> dict[str, NDArray[np.float64]]:
    """Compute calendar-based temporal features.

    Returns week_of_year, month, quarter encodings.
    """
    weeks = np.arange(start_week, start_week + n_weeks, dtype=np.float64)
    week_of_year = (weeks - 1) % 52 + 1
    month = np.ceil(week_of_year / 4.33).clip(1, 12)
    quarter = np.ceil(month / 3)
    return {
        "week_of_year": week_of_year,
        "month": month,
        "quarter": quarter,
    }


def prepare_dataset(
    series_by_product: dict[str, NDArray[np.float64]],
    config: TFTConfig,
    *,
    prices_by_product: dict[str, NDArray[np.float64]] | None = None,
) -> TFTDataset:
    """Prepare a TFTDataset from raw time series.

    Filters products with insufficient data, computes features,
    and assembles into a format suitable for TFT training.
    """
    dataset = TFTDataset()
    all_time_idx: list[NDArray[np.int64]] = []
    all_targets: list[NDArray[np.float64]] = []
    all_group_ids: list[NDArray[np.int64]] = []
    all_lag_features: dict[str, list[NDArray[np.float64]]] = {}
    all_rolling_features: dict[str, list[NDArray[np.float64]]] = {}
    all_temporal_features: dict[str, list[NDArray[np.float64]]] = {}

    min_length = config.input_length + config.forecast_horizon
    group_id = 0

    for pid, series in series_by_product.items():
        if len(series) < min_length:
            continue

        n = len(series)
        dataset.produto_ids.append(pid)
        all_time_idx.append(np.arange(n, dtype=np.int64))
        all_targets.append(series)
        all_group_ids.append(np.full(n, group_id, dtype=np.int64))

        lag_feats = compute_lag_features(series)
        for k, v in lag_feats.items():
            all_lag_features.setdefault(k, []).append(v)

        rolling_feats = compute_rolling_features(series)
        for k, v in rolling_feats.items():
            all_rolling_features.setdefault(k, []).append(v)

        temporal_feats = compute_temporal_features(n)
        for k, v in temporal_feats.items():
            all_temporal_features.setdefault(k, []).append(v)

        group_id += 1

    if not dataset.produto_ids:
        return dataset

    dataset.time_idx = np.concatenate(all_time_idx)
    dataset.targets = np.concatenate(all_targets)
    dataset.group_ids = np.concatenate(all_group_ids)

    for k, arrays in all_lag_features.items():
        dataset.time_varying_unknown[k] = np.concatenate(arrays)

    for k, arrays in all_rolling_features.items():
        dataset.time_varying_unknown[k] = np.concatenate(arrays)

    for k, arrays in all_temporal_features.items():
        dataset.time_varying_known[k] = np.concatenate(arrays)

    return dataset
