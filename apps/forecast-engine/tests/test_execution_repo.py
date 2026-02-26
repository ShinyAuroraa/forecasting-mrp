"""Tests for ExecutionRepository."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.db.models import GatilhoExecucao, StatusExecucao, TipoExecucao
from src.db.repositories.execution_repo import ExecutionRepository


@pytest.fixture
def repo(mock_session: AsyncMock) -> ExecutionRepository:
    return ExecutionRepository(mock_session)


@pytest.mark.asyncio
async def test_create_execution(repo: ExecutionRepository, mock_session: AsyncMock) -> None:
    execucao = await repo.create(
        tipo=TipoExecucao.FORECAST,
        gatilho=GatilhoExecucao.MANUAL,
        parametros={"horizonte": 13},
    )
    assert execucao.tipo == TipoExecucao.FORECAST
    assert execucao.status == StatusExecucao.PENDENTE
    assert execucao.gatilho == GatilhoExecucao.MANUAL
    assert execucao.parametros == {"horizonte": 13}
    mock_session.add.assert_called_once()
    mock_session.flush.assert_called_once()


@pytest.mark.asyncio
async def test_get_by_id_found(repo: ExecutionRepository, mock_session: AsyncMock) -> None:
    mock_exec = MagicMock(id="exec-1")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_exec
    mock_session.execute.return_value = mock_result

    result = await repo.get_by_id("exec-1")
    assert result is not None
    assert result.id == "exec-1"


@pytest.mark.asyncio
async def test_get_by_id_not_found(repo: ExecutionRepository, mock_session: AsyncMock) -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    result = await repo.get_by_id("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_update_status(repo: ExecutionRepository, mock_session: AsyncMock) -> None:
    await repo.update_status("exec-1", StatusExecucao.EXECUTANDO)
    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_update_status_with_error(
    repo: ExecutionRepository, mock_session: AsyncMock
) -> None:
    await repo.update_status(
        "exec-1", StatusExecucao.ERRO, error_message="Pipeline failed"
    )
    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_add_step_log(repo: ExecutionRepository, mock_session: AsyncMock) -> None:
    log = await repo.add_step_log(
        execucao_id="exec-1",
        step_name="load_data",
        step_order=1,
        status="running",
    )
    assert log.step_name == "load_data"
    assert log.step_order == 1
    mock_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_complete_step_log(repo: ExecutionRepository, mock_session: AsyncMock) -> None:
    await repo.complete_step_log(
        1, status="completed", records_processed=100, duration_ms=5000
    )
    mock_session.execute.assert_called_once()
