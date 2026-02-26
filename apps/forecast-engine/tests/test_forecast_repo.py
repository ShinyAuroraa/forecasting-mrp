"""Tests for ForecastRepository."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest

from src.db.models import ModeloForecast, TargetType
from src.db.repositories.forecast_repo import ForecastRepository


@pytest.fixture
def repo(mock_session: AsyncMock) -> ForecastRepository:
    return ForecastRepository(mock_session)


@pytest.mark.asyncio
async def test_save_resultado(repo: ForecastRepository, mock_session: AsyncMock) -> None:
    resultado = await repo.save_resultado(
        execucao_id="exec-1",
        produto_id="p1",
        periodo=datetime(2026, 3, 2, tzinfo=UTC),
        horizonte_semanas=13,
        modelo_usado=ModeloForecast.TFT,
        target_type=TargetType.VOLUME,
        p50=Decimal("150.5"),
        p10=Decimal("120.0"),
        p90=Decimal("180.0"),
    )
    assert resultado.execucao_id == "exec-1"
    assert resultado.produto_id == "p1"
    assert resultado.modelo_usado == ModeloForecast.TFT
    assert resultado.p50 == Decimal("150.5")
    mock_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_save_metrica(repo: ForecastRepository, mock_session: AsyncMock) -> None:
    metrica = await repo.save_metrica(
        execucao_id="exec-1",
        produto_id="p1",
        modelo="TFT",
        mape=Decimal("8.5"),
        mae=Decimal("12.3"),
        rmse=Decimal("15.7"),
        bias=Decimal("-0.5"),
        classe_abc="A",
    )
    assert metrica.modelo == "TFT"
    assert metrica.mape == Decimal("8.5")
    assert metrica.classe_abc == "A"
    mock_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_save_modelo(repo: ForecastRepository, mock_session: AsyncMock) -> None:
    modelo = await repo.save_modelo(
        execucao_id="exec-1",
        tipo_modelo="TFT",
        versao=1,
        parametros={"hidden_size": 64, "attention_head_size": 4},
        metricas_treino={"train_loss": 0.05, "val_loss": 0.08},
        arquivo_path="/models/tft_v1.ckpt",
        is_champion=True,
        treinado_em=datetime(2026, 2, 26, tzinfo=UTC),
    )
    assert modelo.tipo_modelo == "TFT"
    assert modelo.versao == 1
    assert modelo.is_champion is True
    assert modelo.arquivo_path == "/models/tft_v1.ckpt"
    mock_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_flush(repo: ForecastRepository, mock_session: AsyncMock) -> None:
    await repo.flush()
    mock_session.flush.assert_called_once()


@pytest.mark.asyncio
async def test_commit(repo: ForecastRepository, mock_session: AsyncMock) -> None:
    await repo.commit()
    mock_session.commit.assert_called_once()
