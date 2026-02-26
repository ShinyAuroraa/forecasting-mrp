"""Tests for SkuSegmenter — grouping products by forecast model."""

from unittest.mock import MagicMock

import pytest

from src.pipeline.segmentation import SkuSegmenter


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
def segmenter() -> SkuSegmenter:
    return SkuSegmenter()


class TestSegmentation:
    def test_groups_by_primary_model(self, segmenter: SkuSegmenter) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p2", "A", "REGULAR"),
            _make_classification("p3", "C", "REGULAR"),
        ]
        segments = segmenter.segment(classifications)

        assert "TFT" in segments
        assert "ETS" in segments
        assert sorted(segments["TFT"].produto_ids) == ["p1", "p2"]
        assert segments["ETS"].produto_ids == ["p3"]

    def test_intermittent_grouped_together(self, segmenter: SkuSegmenter) -> None:
        classifications = [
            _make_classification("p1", "A", "INTERMITENTE"),
            _make_classification("p2", "C", "INTERMITENTE"),
        ]
        segments = segmenter.segment(classifications)

        assert "CROSTON" in segments
        assert sorted(segments["CROSTON"].produto_ids) == ["p1", "p2"]

    def test_lumpy_grouped_together(self, segmenter: SkuSegmenter) -> None:
        classifications = [
            _make_classification("p1", "B", "LUMPY"),
            _make_classification("p2", "C", "LUMPY"),
        ]
        segments = segmenter.segment(classifications)

        assert "TSB" in segments
        assert len(segments["TSB"].produto_ids) == 2

    def test_user_override_creates_separate_segment(
        self, segmenter: SkuSegmenter
    ) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p2", "A", "REGULAR", modelo_override="CUSTOM"),
        ]
        segments = segmenter.segment(classifications)

        assert "TFT" in segments
        assert "CUSTOM" in segments
        assert segments["TFT"].produto_ids == ["p1"]
        assert segments["CUSTOM"].produto_ids == ["p2"]

    def test_insufficient_data_fallback(self, segmenter: SkuSegmenter) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p2", "A", "REGULAR"),
        ]
        weeks = {"p1": 52, "p2": 20}
        segments = segmenter.segment(classifications, weeks_by_product=weeks)

        assert "TFT" in segments
        assert "ETS" in segments
        assert segments["TFT"].produto_ids == ["p1"]
        assert segments["ETS"].produto_ids == ["p2"]

    def test_empty_classifications(self, segmenter: SkuSegmenter) -> None:
        segments = segmenter.segment([])
        assert segments == {}

    def test_selections_stored_per_product(self, segmenter: SkuSegmenter) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
        ]
        segments = segmenter.segment(classifications)

        selection = segments["TFT"].selections["p1"]
        assert selection.primary == "TFT"
        assert selection.ensemble is True

    def test_mixed_patterns(self, segmenter: SkuSegmenter) -> None:
        classifications = [
            _make_classification("p1", "A", "REGULAR"),
            _make_classification("p2", "C", "ERRATICO"),
            _make_classification("p3", "B", "INTERMITENTE"),
            _make_classification("p4", "A", "LUMPY"),
        ]
        segments = segmenter.segment(classifications)

        assert "TFT" in segments
        assert "ETS" in segments
        assert "CROSTON" in segments
        assert "TSB" in segments
        assert len(segments) == 4
