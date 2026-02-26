"""Train route — triggers model training."""


from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.db.models import GatilhoExecucao, TipoExecucao
from src.db.repositories.execution_repo import ExecutionRepository

router = APIRouter()


class TrainRequest(BaseModel):
    produto_ids: list[str] | None = None
    modelo: str | None = None
    force_retrain: bool = False


class TrainResponse(BaseModel):
    execucao_id: str
    status: str
    message: str


@router.post("/train", status_code=202, response_model=TrainResponse)
async def train(
    request: TrainRequest,
    session: AsyncSession = Depends(get_session),
) -> TrainResponse:
    """Trigger model training. Returns 202 with execution ID."""
    repo = ExecutionRepository(session)
    execucao = await repo.create(
        tipo=TipoExecucao.FORECAST,
        gatilho=GatilhoExecucao.MANUAL,
        parametros={
            "produto_ids": request.produto_ids,
            "modelo": request.modelo,
            "force_retrain": request.force_retrain,
        },
    )
    await repo.commit()
    return TrainResponse(
        execucao_id=execucao.id,
        status="PENDENTE",
        message="Training job queued",
    )
