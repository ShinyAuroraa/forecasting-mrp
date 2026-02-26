"""Health check endpoint for the Forecast Engine."""

from datetime import UTC, datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Return service health status."""
    return {
        "status": "ok",
        "service": "forecast-engine",
        "timestamp": datetime.now(UTC).isoformat(),
    }
