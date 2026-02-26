"""Repository for managing execution planning and step logs."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    ExecucaoPlanejamento,
    ExecucaoStepLog,
    GatilhoExecucao,
    StatusExecucao,
    TipoExecucao,
)


class ExecutionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        tipo: TipoExecucao,
        gatilho: GatilhoExecucao,
        parametros: dict[str, Any] | None = None,
        created_by: str | None = None,
    ) -> ExecucaoPlanejamento:
        """Create a new execution record."""
        execucao = ExecucaoPlanejamento(
            id=str(uuid.uuid4()),
            tipo=tipo,
            status=StatusExecucao.PENDENTE,
            gatilho=gatilho,
            parametros=parametros,
            created_by=created_by,
            created_at=datetime.now(UTC),
        )
        self._session.add(execucao)
        await self._session.flush()
        return execucao

    async def get_by_id(self, execucao_id: str) -> ExecucaoPlanejamento | None:
        """Get an execution by ID."""
        stmt = select(ExecucaoPlanejamento).where(
            ExecucaoPlanejamento.id == execucao_id
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        execucao_id: str,
        status: StatusExecucao,
        *,
        error_message: str | None = None,
        resultado_resumo: dict[str, Any] | None = None,
    ) -> None:
        """Update execution status and optional fields."""
        values: dict[str, Any] = {"status": status}
        if status == StatusExecucao.EXECUTANDO:
            values["started_at"] = datetime.now(UTC)
        if status in (StatusExecucao.CONCLUIDO, StatusExecucao.ERRO):
            values["completed_at"] = datetime.now(UTC)
        if error_message is not None:
            values["error_message"] = error_message
        if resultado_resumo is not None:
            values["resultado_resumo"] = resultado_resumo

        stmt = (
            update(ExecucaoPlanejamento)
            .where(ExecucaoPlanejamento.id == execucao_id)
            .values(**values)
        )
        await self._session.execute(stmt)

    async def add_step_log(
        self,
        *,
        execucao_id: str,
        step_name: str,
        step_order: int,
        status: str,
        records_processed: int | None = None,
        duration_ms: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> ExecucaoStepLog:
        """Add a step log entry to an execution."""
        log = ExecucaoStepLog(
            execucao_id=execucao_id,
            step_name=step_name,
            step_order=step_order,
            status=status,
            records_processed=records_processed,
            duration_ms=duration_ms,
            details=details,
            started_at=datetime.now(UTC),
        )
        self._session.add(log)
        await self._session.flush()
        return log

    async def complete_step_log(
        self,
        log_id: int,
        *,
        status: str,
        records_processed: int | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Mark a step log as completed."""
        stmt = (
            update(ExecucaoStepLog)
            .where(ExecucaoStepLog.id == log_id)
            .values(
                status=status,
                records_processed=records_processed,
                duration_ms=duration_ms,
                completed_at=datetime.now(UTC),
            )
        )
        await self._session.execute(stmt)

    async def commit(self) -> None:
        """Commit the current transaction."""
        await self._session.commit()
