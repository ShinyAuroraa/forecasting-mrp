"""Pydantic models for parsed ERP report data."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProdutoDTO(BaseModel):
    codigo: str = Field(..., description="Código do produto (ex: '000002')")
    descricao: str = Field(..., description="Descrição do produto")
    tipo: str = Field(..., description="Tipo do produto (ex: 'PRODUTO ACABADO')")
    unidade_medida: str = Field(..., description="Unidade de medida (ex: 'CX', 'KG')")


class FaturamentoDTO(BaseModel):
    codigo_produto: str
    descricao: str
    periodo: str = Field(..., description="Período no formato 'MM/YYYY'")
    qtde_pecas: int = 0
    qtde_kg: float = 0.0
    preco_medio_kg: float = 0.0
    valor_bruto: float = 0.0
    valor_liquido: float = 0.0
    prazo_medio: float = 0.0


class MovimentacaoResumoDTO(BaseModel):
    codigo_produto: str
    descricao: str
    periodo: str = Field(..., description="Período no formato 'MM/YYYY'")
    total_quantidade: float
    total_valor: float
    num_pedidos: int


class InventarioDTO(BaseModel):
    codigo_produto: str
    descricao: str
    unidade: str
    grupo: str = Field(..., description="Grupo de produtos (ex: 'AÇAÍS E CREMES')")
    quantidade: float


class InsumoDTO(BaseModel):
    codigo: str
    descricao: str
    unidade: str
    quantidade: float
    perda_percentual: float = 0.0


class ComposicaoDTO(BaseModel):
    produto_pai_codigo: str
    produto_pai_descricao: str
    produto_pai_unidade: str
    peso_bruto: float = 0.0
    peso_liquido: float = 0.0
    rendimento: float = 0.0
    insumos: list[InsumoDTO] = Field(default_factory=list)
