"""Repository for writing forecast results, metrics, and model metadata."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    ForecastMetrica,
    ForecastModelo,
    ForecastResultado,
    ModeloForecast,
    TargetType,
)


class ForecastRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_resultado(
        self,
        *,
        execucao_id: str,
        produto_id: str,
        periodo: datetime,
        horizonte_semanas: int,
        modelo_usado: ModeloForecast,
        target_type: TargetType,
        p10: Decimal | None = None,
        p25: Decimal | None = None,
        p50: Decimal | None = None,
        p75: Decimal | None = None,
        p90: Decimal | None = None,
        faturamento_p50: Decimal | None = None,
        faturamento_p10: Decimal | None = None,
        faturamento_p90: Decimal | None = None,
    ) -> ForecastResultado:
        """Save a single forecast result row."""
        resultado = ForecastResultado(
            id=str(uuid.uuid4()),
            execucao_id=execucao_id,
            produto_id=produto_id,
            periodo=periodo,
            horizonte_semanas=horizonte_semanas,
            modelo_usado=modelo_usado,
            target_type=target_type,
            p10=p10,
            p25=p25,
            p50=p50,
            p75=p75,
            p90=p90,
            faturamento_p50=faturamento_p50,
            faturamento_p10=faturamento_p10,
            faturamento_p90=faturamento_p90,
        )
        self._session.add(resultado)
        return resultado

    async def save_metrica(
        self,
        *,
        execucao_id: str,
        produto_id: str,
        modelo: str,
        mape: Decimal | None = None,
        mae: Decimal | None = None,
        rmse: Decimal | None = None,
        bias: Decimal | None = None,
        classe_abc: str | None = None,
    ) -> ForecastMetrica:
        """Save accuracy metrics for a product/model."""
        metrica = ForecastMetrica(
            id=str(uuid.uuid4()),
            execucao_id=execucao_id,
            produto_id=produto_id,
            modelo=modelo,
            mape=mape,
            mae=mae,
            rmse=rmse,
            bias=bias,
            classe_abc=classe_abc,
            created_at=datetime.now(UTC),
        )
        self._session.add(metrica)
        return metrica

    async def save_modelo(
        self,
        *,
        execucao_id: str,
        tipo_modelo: str,
        versao: int,
        parametros: dict[str, Any] | None = None,
        metricas_treino: dict[str, Any] | None = None,
        arquivo_path: str | None = None,
        is_champion: bool = False,
        treinado_em: datetime | None = None,
    ) -> ForecastModelo:
        """Save model metadata."""
        modelo = ForecastModelo(
            id=str(uuid.uuid4()),
            execucao_id=execucao_id,
            tipo_modelo=tipo_modelo,
            versao=versao,
            parametros=parametros,
            metricas_treino=metricas_treino,
            arquivo_path=arquivo_path,
            is_champion=is_champion,
            treinado_em=treinado_em,
            created_at=datetime.now(UTC),
        )
        self._session.add(modelo)
        return modelo

    async def find_current_champion(self, tipo_modelo: str) -> ForecastModelo | None:
        """Find the current champion model for a given model type."""
        stmt = (
            select(ForecastModelo)
            .where(
                ForecastModelo.tipo_modelo == tipo_modelo,
                ForecastModelo.is_champion.is_(True),
            )
            .order_by(ForecastModelo.created_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def demote_champion(self, tipo_modelo: str) -> None:
        """Set isChampion=false for all models of a given type."""
        stmt = (
            update(ForecastModelo)
            .where(
                ForecastModelo.tipo_modelo == tipo_modelo,
                ForecastModelo.is_champion.is_(True),
            )
            .values(is_champion=False)
        )
        await self._session.execute(stmt)

    async def promote_champion(self, model_id: str) -> None:
        """Set isChampion=true for a specific model."""
        stmt = (
            update(ForecastModelo)
            .where(ForecastModelo.id == model_id)
            .values(is_champion=True)
        )
        await self._session.execute(stmt)

    async def find_champion_history(
        self, tipo_modelo: str, limit: int = 10
    ) -> list[ForecastModelo]:
        """Find recent models that were or are champions, ordered by creation date."""
        stmt = (
            select(ForecastModelo)
            .where(ForecastModelo.tipo_modelo == tipo_modelo)
            .order_by(ForecastModelo.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def flush(self) -> None:
        """Flush pending changes to the database."""
        await self._session.flush()

    async def commit(self) -> None:
        """Commit the current transaction."""
        await self._session.commit()
