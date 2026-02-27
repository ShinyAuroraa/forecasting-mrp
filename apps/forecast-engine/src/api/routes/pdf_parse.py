"""FastAPI routes for PDF parsing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.parsers.composicao_parser import ComposicaoParser
from src.parsers.detector import detect_report_type
from src.parsers.faturamento_parser import FaturamentoParser
from src.parsers.inventario_parser import InventarioParser
from src.parsers.models import (
    ComposicaoDTO,
    FaturamentoDTO,
    InventarioDTO,
    MovimentacaoResumoDTO,
    ProdutoDTO,
)
from src.parsers.movimentacao_parser import MovimentacaoParser
from src.parsers.produtos_parser import ProdutosParser

router = APIRouter(prefix="/parse-pdf")

_ALLOWED_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "application/octet-stream",
}

_REPORT_TYPE_LABELS = {
    "produtos": "Relatório de Produtos",
    "faturamento": "Faturamento Agrupado",
    "movimentacao": "Pedidos Emitidos por Período",
    "inventario": "Posição Geral de Estoque",
    "composicao": "Engenharia/Composição Produto",
}


def _validate_pdf(file: UploadFile) -> None:
    content_type = file.content_type or ""
    filename = file.filename or ""
    if content_type not in _ALLOWED_TYPES and not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail=f"Arquivo deve ser PDF. Tipo recebido: {content_type}",
        )


def _check_report_type(pdf_bytes: bytes, expected: str) -> None:
    """Detect report type and raise error if it doesn't match expected."""
    detected = detect_report_type(pdf_bytes)
    if detected != "unknown" and detected != expected:
        detected_label = _REPORT_TYPE_LABELS.get(detected, detected)
        expected_label = _REPORT_TYPE_LABELS.get(expected, expected)
        raise HTTPException(
            status_code=400,
            detail=(
                f"PDF detectado como '{detected_label}', mas este endpoint espera "
                f"'{expected_label}'. Use o endpoint /parse-pdf/{detected} em vez disso."
            ),
        )


@router.post("/produtos", response_model=list[ProdutoDTO])
async def parse_produtos(file: UploadFile = File(...)):
    """Parse a WebMais product catalog PDF."""
    _validate_pdf(file)
    pdf_bytes = await file.read()
    _check_report_type(pdf_bytes, "produtos")
    parser = ProdutosParser()
    return parser.parse(pdf_bytes)


@router.post("/faturamento", response_model=list[FaturamentoDTO])
async def parse_faturamento(file: UploadFile = File(...)):
    """Parse a WebMais grouped billing PDF."""
    _validate_pdf(file)
    pdf_bytes = await file.read()
    _check_report_type(pdf_bytes, "faturamento")
    parser = FaturamentoParser()
    return parser.parse(pdf_bytes)


@router.post("/movimentacao", response_model=list[MovimentacaoResumoDTO])
async def parse_movimentacao(file: UploadFile = File(...)):
    """Parse a WebMais movement/orders PDF (returns aggregated monthly summary)."""
    _validate_pdf(file)
    pdf_bytes = await file.read()
    _check_report_type(pdf_bytes, "movimentacao")
    parser = MovimentacaoParser()
    return parser.parse(pdf_bytes)


@router.post("/inventario", response_model=list[InventarioDTO])
async def parse_inventario(file: UploadFile = File(...)):
    """Parse a WebMais inventory/stock position PDF."""
    _validate_pdf(file)
    pdf_bytes = await file.read()
    _check_report_type(pdf_bytes, "inventario")
    parser = InventarioParser()
    return parser.parse(pdf_bytes)


@router.post("/composicao", response_model=list[ComposicaoDTO])
async def parse_composicao(file: UploadFile = File(...)):
    """Parse a WebMais BOM/composition engineering PDF."""
    _validate_pdf(file)
    pdf_bytes = await file.read()
    _check_report_type(pdf_bytes, "composicao")
    parser = ComposicaoParser()
    return parser.parse(pdf_bytes)
