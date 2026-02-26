"""Backtest route — triggers backtesting pipeline."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.db.models import GatilhoExecucao, TipoExecucao
from src.db.repositories.execution_repo import ExecutionRepository

router = APIRouter()


class BacktestRequest(BaseModel):
    produto_ids: list[str] | None = None
    holdout_weeks: int = 13


class BacktestResponse(BaseModel):
    execucao_id: str
    status: str
    message: str


@router.post("/backtest", status_code=202, response_model=BacktestResponse)
async def backtest(
    request: BacktestRequest,
    session: AsyncSession = Depends(get_session),
) -> BacktestResponse:
    """Trigger backtesting pipeline. Returns 202 with execution ID."""
    repo = ExecutionRepository(session)
    execucao = await repo.create(
        tipo=TipoExecucao.FORECAST,
        gatilho=GatilhoExecucao.MANUAL,
        parametros={
            "produto_ids": request.produto_ids,
            "holdout_weeks": request.holdout_weeks,
        },
    )
    await repo.commit()
    return BacktestResponse(
        execucao_id=execucao.id,
        status="PENDENTE",
        message="Backtest job queued",
    )
