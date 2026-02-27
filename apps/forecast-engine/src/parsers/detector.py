"""Auto-detect WebMais PDF report type from content."""

from __future__ import annotations

import io
import re

import pdfplumber


def detect_report_type(pdf_bytes: bytes) -> str:
    """Detect the type of WebMais report from PDF content.

    Returns one of: 'produtos', 'faturamento', 'movimentacao', 'inventario', 'composicao', 'unknown'
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if not pdf.pages:
                return "unknown"
            text = (pdf.pages[0].extract_text() or "").upper()
    except Exception:
        return "unknown"

    if re.search(r"RELAT[ÓO]RIO\s+DE\s+PRODUTOS", text) or re.search(r"TIPO\s*:\s*\d+\s*-\s*PRODUTO", text):
        return "produtos"

    if re.search(r"FATURAMENTO\s+AGRUPADO", text):
        return "faturamento"

    if re.search(r"PEDIDOS\s+EMITIDOS\s+POR\s+PER[ÍI]ODO", text) or re.search(r"N[ºO°]\s*REGISTROS\s*:", text):
        return "movimentacao"

    if re.search(r"POSI[ÇC][ÃA]O\s+GERAL\s+DE\s+ESTOQUE", text):
        return "inventario"

    if re.search(r"ENGENHARIA\s*/?\s*COMPOSI[ÇC][ÃA]O", text):
        return "composicao"

    return "unknown"
