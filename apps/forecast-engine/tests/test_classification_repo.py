"""Tests for ClassificationRepository."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.db.repositories.classification_repo import ClassificationRepository


@pytest.fixture
def repo(mock_session: AsyncMock) -> ClassificationRepository:
    return ClassificationRepository(mock_session)


@pytest.mark.asyncio
async def test_get_all(repo: ClassificationRepository, mock_session: AsyncMock) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [MagicMock(), MagicMock()]
    mock_session.execute.return_value = mock_result

    result = await repo.get_all()
    assert len(result) == 2


@pytest.mark.asyncio
async def test_get_by_product_id_found(
    repo: ClassificationRepository, mock_session: AsyncMock
) -> None:
    mock_classification = MagicMock(produto_id="p1", modelo_forecast_sugerido="TFT")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_classification
    mock_session.execute.return_value = mock_result

    result = await repo.get_by_product_id("p1")
    assert result is not None
    assert result.produto_id == "p1"


@pytest.mark.asyncio
async def test_get_by_product_id_not_found(
    repo: ClassificationRepository, mock_session: AsyncMock
) -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    result = await repo.get_by_product_id("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_get_model_suggestions(
    repo: ClassificationRepository, mock_session: AsyncMock
) -> None:
    mock_result = MagicMock()
    mock_result.all.return_value = [
        MagicMock(produto_id="p1", modelo_forecast_sugerido="TFT"),
        MagicMock(produto_id="p2", modelo_forecast_sugerido="ETS"),
        MagicMock(produto_id="p3", modelo_forecast_sugerido=None),
    ]
    mock_session.execute.return_value = mock_result

    result = await repo.get_model_suggestions()
    assert result == {"p1": "TFT", "p2": "ETS", "p3": None}
