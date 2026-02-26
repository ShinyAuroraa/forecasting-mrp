"""Tests for ModelRegistry — model selection based on SKU classification."""

import pytest

from src.db.models import ClasseABC, PadraoDemanda
from src.models.registry import ModelRegistry


@pytest.fixture
def registry() -> ModelRegistry:
    return ModelRegistry()


class TestRegularPattern:
    def test_regular_class_a(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A, padrao_demanda=PadraoDemanda.REGULAR
        )
        assert sel.primary == "TFT"
        assert sel.fallback == "LGBM"
        assert sel.ensemble is True
        assert sel.ensemble_weights == {"TFT": 0.6, "LGBM": 0.4}

    def test_regular_class_b(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.B, padrao_demanda=PadraoDemanda.REGULAR
        )
        assert sel.primary == "TFT"
        assert sel.fallback == "LGBM"
        assert sel.ensemble is False

    def test_regular_class_c(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.C, padrao_demanda=PadraoDemanda.REGULAR
        )
        assert sel.primary == "ETS"
        assert sel.fallback == "NAIVE"
        assert sel.ensemble is False


class TestErraticPattern:
    def test_erratic_class_a(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A, padrao_demanda=PadraoDemanda.ERRATICO
        )
        assert sel.primary == "TFT"
        assert sel.fallback == "ETS"
        assert sel.ensemble is True

    def test_erratic_class_b(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.B, padrao_demanda=PadraoDemanda.ERRATICO
        )
        assert sel.primary == "TFT"
        assert sel.fallback == "ETS"
        assert sel.ensemble is False

    def test_erratic_class_c(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.C, padrao_demanda=PadraoDemanda.ERRATICO
        )
        assert sel.primary == "ETS"
        assert sel.fallback == "NAIVE"


class TestIntermittentPattern:
    def test_intermittent_class_a(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A, padrao_demanda=PadraoDemanda.INTERMITENTE
        )
        assert sel.primary == "CROSTON"
        assert sel.fallback == "SBA"

    def test_intermittent_class_c(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.C, padrao_demanda=PadraoDemanda.INTERMITENTE
        )
        assert sel.primary == "CROSTON"
        assert sel.fallback == "SBA"


class TestLumpyPattern:
    def test_lumpy_class_a(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A, padrao_demanda=PadraoDemanda.LUMPY
        )
        assert sel.primary == "TSB"
        assert sel.fallback == "BOOTSTRAP"

    def test_lumpy_class_c(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.C, padrao_demanda=PadraoDemanda.LUMPY
        )
        assert sel.primary == "TSB"
        assert sel.fallback == "BOOTSTRAP"


class TestOverrides:
    def test_user_override(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A,
            padrao_demanda=PadraoDemanda.REGULAR,
            modelo_override="CUSTOM_MODEL",
        )
        assert sel.primary == "CUSTOM_MODEL"
        assert sel.fallback == "NAIVE"
        assert sel.ensemble is False

    def test_insufficient_data(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A,
            padrao_demanda=PadraoDemanda.REGULAR,
            weeks_of_data=30,
        )
        assert sel.primary == "ETS"
        assert sel.fallback == "NAIVE"

    def test_sufficient_data(self, registry: ModelRegistry) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A,
            padrao_demanda=PadraoDemanda.REGULAR,
            weeks_of_data=52,
        )
        assert sel.primary == "TFT"

    def test_override_takes_precedence_over_insufficient_data(
        self, registry: ModelRegistry
    ) -> None:
        sel = registry.select_model(
            classe_abc=ClasseABC.A,
            padrao_demanda=PadraoDemanda.REGULAR,
            modelo_override="TFT",
            weeks_of_data=10,
        )
        assert sel.primary == "TFT"


class TestGetAllModelNames:
    def test_returns_sorted_list(self, registry: ModelRegistry) -> None:
        names = registry.get_all_model_names()
        assert isinstance(names, list)
        assert names == sorted(names)
        assert "TFT" in names
        assert "ETS" in names
        assert "CROSTON" in names
        assert "ENSEMBLE" in names
        assert "NAIVE" in names
