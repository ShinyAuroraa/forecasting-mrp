"""SQLAlchemy ORM models mirroring the Prisma schema for forecast-related tables."""

import enum
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# --- Python Enums matching Prisma enums ---


class TipoExecucao(enum.StrEnum):
    FORECAST = "FORECAST"
    MRP = "MRP"
    COMPLETO = "COMPLETO"
    CICLO_DIARIO = "CICLO_DIARIO"
    CICLO_SEMANAL = "CICLO_SEMANAL"
    CICLO_MENSAL = "CICLO_MENSAL"
    PIPELINE_DIARIO = "PIPELINE_DIARIO"


class StatusExecucao(enum.StrEnum):
    PENDENTE = "PENDENTE"
    EXECUTANDO = "EXECUTANDO"
    CONCLUIDO = "CONCLUIDO"
    ERRO = "ERRO"


class GatilhoExecucao(enum.StrEnum):
    MANUAL = "MANUAL"
    AGENDADO = "AGENDADO"
    AUTO_INGESTAO = "AUTO_INGESTAO"


class ModeloForecast(enum.StrEnum):
    TFT = "TFT"
    ETS = "ETS"
    CROSTON = "CROSTON"
    LGBM = "LGBM"
    ENSEMBLE = "ENSEMBLE"


class TargetType(enum.StrEnum):
    VOLUME = "VOLUME"
    FATURAMENTO = "FATURAMENTO"


class Granularidade(enum.StrEnum):
    diario = "diario"
    semanal = "semanal"
    mensal = "mensal"


class ClasseABC(enum.StrEnum):
    A = "A"
    B = "B"
    C = "C"


class ClasseXYZ(enum.StrEnum):
    X = "X"
    Y = "Y"
    Z = "Z"


class PadraoDemanda(enum.StrEnum):
    REGULAR = "REGULAR"
    INTERMITENTE = "INTERMITENTE"
    ERRATICO = "ERRATICO"
    LUMPY = "LUMPY"


# --- ORM Models ---


class SerieTemporal(Base):
    __tablename__ = "serie_temporal"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    produto_id: Mapped[str] = mapped_column(
        "produto_id", UUID(as_uuid=False), ForeignKey("produto.id")
    )
    data_referencia: Mapped[datetime] = mapped_column("data_referencia", Date)
    granularidade: Mapped[Granularidade] = mapped_column(
        Enum(Granularidade, name="Granularidade", create_type=False),
        default=Granularidade.semanal,
    )
    volume: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0"))
    receita: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0"))
    fonte: Mapped[str | None] = mapped_column(String(30), nullable=True)
    qualidade: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("produto_id", "data_referencia", "granularidade"),
    )


class SkuClassification(Base):
    __tablename__ = "sku_classification"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    produto_id: Mapped[str] = mapped_column(
        "produto_id", UUID(as_uuid=False), ForeignKey("produto.id"), unique=True
    )
    classe_abc: Mapped[ClasseABC] = mapped_column(
        "classe_abc", Enum(ClasseABC, name="ClasseABC", create_type=False)
    )
    classe_xyz: Mapped[ClasseXYZ] = mapped_column(
        "classe_xyz", Enum(ClasseXYZ, name="ClasseXYZ", create_type=False)
    )
    padrao_demanda: Mapped[PadraoDemanda] = mapped_column(
        "padrao_demanda", Enum(PadraoDemanda, name="PadraoDemanda", create_type=False)
    )
    modelo_forecast_sugerido: Mapped[str | None] = mapped_column(
        "modelo_forecast_sugerido", String(50), nullable=True
    )
    percentual_receita: Mapped[Decimal | None] = mapped_column(
        "percentual_receita", Numeric(6, 4), nullable=True
    )
    cv_demanda: Mapped[Decimal | None] = mapped_column(
        "cv_demanda", Numeric(6, 4), nullable=True
    )
    calculado_em: Mapped[datetime | None] = mapped_column(
        "calculado_em", DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=True))


class ExecucaoPlanejamento(Base):
    __tablename__ = "execucao_planejamento"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tipo: Mapped[TipoExecucao] = mapped_column(
        Enum(TipoExecucao, name="TipoExecucao", create_type=False)
    )
    status: Mapped[StatusExecucao] = mapped_column(
        Enum(StatusExecucao, name="StatusExecucao", create_type=False),
        default=StatusExecucao.PENDENTE,
    )
    gatilho: Mapped[GatilhoExecucao] = mapped_column(
        Enum(GatilhoExecucao, name="GatilhoExecucao", create_type=False)
    )
    parametros: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    resultado_resumo: Mapped[dict[str, Any] | None] = mapped_column(
        "resultado_resumo", JSONB, nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        "started_at", DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        "completed_at", DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(
        "error_message", Text, nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(
        "created_by", UUID(as_uuid=False), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))

    step_logs: Mapped[list["ExecucaoStepLog"]] = relationship(back_populates="execucao")
    forecast_resultados: Mapped[list["ForecastResultado"]] = relationship(
        back_populates="execucao"
    )
    forecast_metricas: Mapped[list["ForecastMetrica"]] = relationship(
        back_populates="execucao"
    )
    forecast_modelos: Mapped[list["ForecastModelo"]] = relationship(
        back_populates="execucao"
    )

    __table_args__ = (
        Index("idx_exec_tipo_status", "tipo", "status"),
    )


class ExecucaoStepLog(Base):
    __tablename__ = "execucao_step_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    execucao_id: Mapped[str] = mapped_column(
        "execucao_id", UUID(as_uuid=False), ForeignKey("execucao_planejamento.id")
    )
    step_name: Mapped[str] = mapped_column("step_name", String(50))
    step_order: Mapped[int] = mapped_column("step_order", SmallInteger)
    status: Mapped[str] = mapped_column(String(20))
    records_processed: Mapped[int | None] = mapped_column(
        "records_processed", BigInteger, nullable=True
    )
    duration_ms: Mapped[int | None] = mapped_column(
        "duration_ms", Integer, nullable=True
    )
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        "started_at", DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        "completed_at", DateTime(timezone=True), nullable=True
    )

    execucao: Mapped[ExecucaoPlanejamento] = relationship(back_populates="step_logs")


class ForecastResultado(Base):
    __tablename__ = "forecast_resultado"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    execucao_id: Mapped[str] = mapped_column(
        "execucao_id", UUID(as_uuid=False), ForeignKey("execucao_planejamento.id")
    )
    produto_id: Mapped[str] = mapped_column(
        "produto_id", UUID(as_uuid=False), ForeignKey("produto.id")
    )
    periodo: Mapped[datetime] = mapped_column(Date)
    horizonte_semanas: Mapped[int] = mapped_column("horizonte_semanas", Integer)
    modelo_usado: Mapped[ModeloForecast] = mapped_column(
        "modelo_usado", Enum(ModeloForecast, name="ModeloForecast", create_type=False)
    )
    target_type: Mapped[TargetType] = mapped_column(
        "target_type", Enum(TargetType, name="TargetType", create_type=False)
    )
    p10: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    p25: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    p50: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    p75: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    p90: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    faturamento_p50: Mapped[Decimal | None] = mapped_column(
        "faturamento_p50", Numeric(14, 4), nullable=True
    )
    faturamento_p10: Mapped[Decimal | None] = mapped_column(
        "faturamento_p10", Numeric(14, 4), nullable=True
    )
    faturamento_p90: Mapped[Decimal | None] = mapped_column(
        "faturamento_p90", Numeric(14, 4), nullable=True
    )

    execucao: Mapped[ExecucaoPlanejamento] = relationship(
        back_populates="forecast_resultados"
    )

    __table_args__ = (
        Index("idx_forecast_exec_produto", "execucao_id", "produto_id"),
        Index("idx_forecast_periodo", "periodo"),
    )


class ForecastMetrica(Base):
    __tablename__ = "forecast_metrica"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    execucao_id: Mapped[str] = mapped_column(
        "execucao_id", UUID(as_uuid=False), ForeignKey("execucao_planejamento.id")
    )
    produto_id: Mapped[str] = mapped_column(
        "produto_id", UUID(as_uuid=False), ForeignKey("produto.id")
    )
    modelo: Mapped[str] = mapped_column(String(50))
    mape: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    mae: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    rmse: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    bias: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    classe_abc: Mapped[str | None] = mapped_column(
        "classe_abc", String(1), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))

    execucao: Mapped[ExecucaoPlanejamento] = relationship(
        back_populates="forecast_metricas"
    )


class ForecastModelo(Base):
    __tablename__ = "forecast_modelo"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    execucao_id: Mapped[str] = mapped_column(
        "execucao_id", UUID(as_uuid=False), ForeignKey("execucao_planejamento.id")
    )
    tipo_modelo: Mapped[str] = mapped_column("tipo_modelo", String(50))
    versao: Mapped[int] = mapped_column(Integer)
    parametros: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    metricas_treino: Mapped[dict[str, Any] | None] = mapped_column(
        "metricas_treino", JSONB, nullable=True
    )
    arquivo_path: Mapped[str | None] = mapped_column(
        "arquivo_path", String(500), nullable=True
    )
    is_champion: Mapped[bool] = mapped_column(
        "is_champion", Boolean, default=False
    )
    treinado_em: Mapped[datetime | None] = mapped_column(
        "treinado_em", DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))

    execucao: Mapped[ExecucaoPlanejamento] = relationship(
        back_populates="forecast_modelos"
    )
