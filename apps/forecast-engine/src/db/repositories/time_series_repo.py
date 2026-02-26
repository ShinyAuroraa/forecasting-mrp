"""Repository for reading time-series data from serie_temporal."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Granularidade, SerieTemporal


class TimeSeriesRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_product(
        self,
        produto_id: str,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        granularidade: Granularidade = Granularidade.semanal,
    ) -> list[SerieTemporal]:
        """Get time-series records for a product with optional date range."""
        stmt = (
            select(SerieTemporal)
            .where(SerieTemporal.produto_id == produto_id)
            .where(SerieTemporal.granularidade == granularidade)
        )
        if date_from is not None:
            stmt = stmt.where(SerieTemporal.data_referencia >= date_from)
        if date_to is not None:
            stmt = stmt.where(SerieTemporal.data_referencia <= date_to)
        stmt = stmt.order_by(SerieTemporal.data_referencia)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_weekly(
        self,
        *,
        produto_ids: list[str] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[SerieTemporal]:
        """Get all weekly time-series, optionally filtered by products and date range."""
        stmt = select(SerieTemporal).where(
            SerieTemporal.granularidade == Granularidade.semanal
        )
        if produto_ids is not None:
            stmt = stmt.where(SerieTemporal.produto_id.in_(produto_ids))
        if date_from is not None:
            stmt = stmt.where(SerieTemporal.data_referencia >= date_from)
        if date_to is not None:
            stmt = stmt.where(SerieTemporal.data_referencia <= date_to)
        stmt = stmt.order_by(SerieTemporal.produto_id, SerieTemporal.data_referencia)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_product_ids_with_data(self) -> list[str]:
        """Get distinct product IDs that have time-series data."""
        stmt = select(SerieTemporal.produto_id).distinct()
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
