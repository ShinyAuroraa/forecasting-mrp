"""Predict route — triggers forecast generation."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.db.models import GatilhoExecucao, TipoExecucao
from src.db.repositories.execution_repo import ExecutionRepository

router = APIRouter()


class PredictRequest(BaseModel):
    produto_ids: list[str] | None = None
    horizonte_semanas: int = 13


class PredictResponse(BaseModel):
    execucao_id: str
    status: str
    message: str


@router.post("/predict", status_code=202, response_model=PredictResponse)
async def predict(
    request: PredictRequest,
    session: AsyncSession = Depends(get_session),
) -> PredictResponse:
    """Trigger forecast prediction. Returns 202 with execution ID."""
    repo = ExecutionRepository(session)
    execucao = await repo.create(
        tipo=TipoExecucao.FORECAST,
        gatilho=GatilhoExecucao.MANUAL,
        parametros={
            "produto_ids": request.produto_ids,
            "horizonte_semanas": request.horizonte_semanas,
        },
    )
    await repo.commit()
    return PredictResponse(
        execucao_id=execucao.id,
        status="PENDENTE",
        message="Prediction job queued",
    )
