"""Repository for reading SKU classification data."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import SkuClassification


class ClassificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_all(self) -> list[SkuClassification]:
        """Get all SKU classifications."""
        stmt = select(SkuClassification)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_product_id(self, produto_id: str) -> SkuClassification | None:
        """Get classification for a specific product."""
        stmt = select(SkuClassification).where(
            SkuClassification.produto_id == produto_id
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_model_suggestions(self) -> dict[str, str | None]:
        """Get a mapping of product_id -> suggested forecast model."""
        stmt = select(
            SkuClassification.produto_id,
            SkuClassification.modelo_forecast_sugerido,
        )
        result = await self._session.execute(stmt)
        return {row.produto_id: row.modelo_forecast_sugerido for row in result.all()}
