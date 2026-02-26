"""Model registry — maps SKU classification to optimal forecast model."""

from dataclasses import dataclass

from src.db.models import ClasseABC, PadraoDemanda


@dataclass(frozen=True)
class ModelSelection:
    """Selected models for a SKU."""

    primary: str
    fallback: str
    ensemble: bool = False
    ensemble_weights: dict[str, float] | None = None


# Classification → (primary, fallback) mapping per FR-022
_MODEL_MATRIX: dict[tuple[PadraoDemanda, str], tuple[str, str]] = {
    # REGULAR (SMOOTH) patterns
    (PadraoDemanda.REGULAR, "AB"): ("TFT", "LGBM"),
    (PadraoDemanda.REGULAR, "C"): ("ETS", "NAIVE"),
    # ERRATIC patterns
    (PadraoDemanda.ERRATICO, "AB"): ("TFT", "ETS"),
    (PadraoDemanda.ERRATICO, "C"): ("ETS", "NAIVE"),
    # INTERMITTENT patterns (any ABC class)
    (PadraoDemanda.INTERMITENTE, "ANY"): ("CROSTON", "SBA"),
    # LUMPY patterns (any ABC class)
    (PadraoDemanda.LUMPY, "ANY"): ("TSB", "BOOTSTRAP"),
}

# Ensemble config for class A SKUs
_ENSEMBLE_WEIGHTS: dict[str, float] = {"TFT": 0.6, "LGBM": 0.4}

# Minimum weeks of historical data for TFT/complex models
MIN_WEEKS_FOR_COMPLEX = 40


class ModelRegistry:
    """Resolves the optimal forecast model for a SKU based on its classification."""

    def select_model(
        self,
        *,
        classe_abc: ClasseABC,
        padrao_demanda: PadraoDemanda,
        modelo_override: str | None = None,
        weeks_of_data: int | None = None,
    ) -> ModelSelection:
        """Select the best model for a SKU.

        Args:
            classe_abc: ABC classification (A, B, C)
            padrao_demanda: Demand pattern (REGULAR, INTERMITENTE, ERRATICO, LUMPY)
            modelo_override: User-specified model override (from modelo_forecast_sugerido)
            weeks_of_data: Number of weeks of historical data available

        Returns:
            ModelSelection with primary, fallback, and optional ensemble config
        """
        # User override takes precedence
        if modelo_override is not None:
            return ModelSelection(primary=modelo_override, fallback="NAIVE")

        # Insufficient data fallback
        if weeks_of_data is not None and weeks_of_data < MIN_WEEKS_FOR_COMPLEX:
            return ModelSelection(primary="ETS", fallback="NAIVE")

        # Intermittent and Lumpy use ANY abc class
        if padrao_demanda in (PadraoDemanda.INTERMITENTE, PadraoDemanda.LUMPY):
            primary, fallback = _MODEL_MATRIX[(padrao_demanda, "ANY")]
            return ModelSelection(primary=primary, fallback=fallback)

        # Regular and Erratic depend on ABC class
        abc_group = "AB" if classe_abc in (ClasseABC.A, ClasseABC.B) else "C"
        key = (padrao_demanda, abc_group)
        primary, fallback = _MODEL_MATRIX.get(key, ("ETS", "NAIVE"))

        # Class A additionally gets ensemble
        ensemble = classe_abc == ClasseABC.A and primary == "TFT"
        return ModelSelection(
            primary=primary,
            fallback=fallback,
            ensemble=ensemble,
            ensemble_weights=_ENSEMBLE_WEIGHTS if ensemble else None,
        )

    def get_all_model_names(self) -> list[str]:
        """Return all model names known to the registry."""
        models: set[str] = set()
        for primary, fallback in _MODEL_MATRIX.values():
            models.add(primary)
            models.add(fallback)
        models.add("ENSEMBLE")
        models.add("NAIVE")
        return sorted(models)
