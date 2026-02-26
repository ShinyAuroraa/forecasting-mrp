"""Models metadata route — lists trained models."""

from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/models")
async def list_models() -> dict[str, Any]:
    """List all trained model metadata. Stub — returns empty list."""
    return {"models": [], "total": 0}
