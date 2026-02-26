"""Tests for TimeSeriesRepository."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.db.repositories.time_series_repo import TimeSeriesRepository


@pytest.fixture
def repo(mock_session: AsyncMock) -> TimeSeriesRepository:
    return TimeSeriesRepository(mock_session)


@pytest.mark.asyncio
async def test_get_by_product(repo: TimeSeriesRepository, mock_session: AsyncMock) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [MagicMock(produto_id="p1")]
    mock_session.execute.return_value = mock_result

    result = await repo.get_by_product("p1")
    assert len(result) == 1
    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_get_by_product_with_date_range(
    repo: TimeSeriesRepository, mock_session: AsyncMock
) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result

    result = await repo.get_by_product(
        "p1", date_from=date(2025, 1, 1), date_to=date(2025, 12, 31)
    )
    assert result == []


@pytest.mark.asyncio
async def test_get_all_weekly(repo: TimeSeriesRepository, mock_session: AsyncMock) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [MagicMock(), MagicMock()]
    mock_session.execute.return_value = mock_result

    result = await repo.get_all_weekly()
    assert len(result) == 2


@pytest.mark.asyncio
async def test_get_all_weekly_with_product_filter(
    repo: TimeSeriesRepository, mock_session: AsyncMock
) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [MagicMock()]
    mock_session.execute.return_value = mock_result

    result = await repo.get_all_weekly(produto_ids=["p1", "p2"])
    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_product_ids_with_data(
    repo: TimeSeriesRepository, mock_session: AsyncMock
) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["p1", "p2", "p3"]
    mock_session.execute.return_value = mock_result

    result = await repo.get_product_ids_with_data()
    assert len(result) == 3
