"""Parser for WebMais 'Relatório de Produtos' PDF."""

from __future__ import annotations

import re

import pdfplumber
import structlog

from src.parsers.base import WebMaisParser
from src.parsers.models import ProdutoDTO

logger = structlog.get_logger(__name__)

# Section header: "TIPO: 001 - PRODUTO ACABADO TOTAL : 151"
_TIPO_HEADER = re.compile(
    r"TIPO\s*:\s*\d+\s*-\s*(.+?)\s+TOTAL\s*:", re.IGNORECASE
)

# Product line: "000002 - ACAI NATURAL CX 10L CX"
_PRODUCT_LINE = re.compile(r"^(\d{6})\s*-\s*(.+)$")

# Lines to skip (page headers, footers, URLs)
_SKIP_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"^\d+\s+of\s+\d+", re.IGNORECASE),
    re.compile(r"PARABRASIL\s+INDUSTRIA", re.IGNORECASE),
    re.compile(r"RELAT[ÓO]RIO\s+DE\s+PRODUTOS", re.IGNORECASE),
    re.compile(r"^PRODUTO\s+U\.?M\.?\s*$", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{4},?\s+\d{2}:\d{2}"),
    re.compile(r"^RUA\s+"),
    re.compile(r"GESTOR\s*:"),
    re.compile(r"M[ÓO]DULO\s*:"),
    re.compile(r"PRG\s*:"),
    re.compile(r"MOVIMENTA\s+ESTOQUE"),
    re.compile(r"AGRUPAMENTO\s*:"),
    re.compile(r"ORDENA[ÇC][ÃA]O\s*:"),
    re.compile(r"STATUS\s*:"),
    re.compile(r"^\d+\.\d+\.\d+/\d+-\d+"),  # CNPJ
]

# Known valid unit abbreviations
_KNOWN_UNITS = {
    "CX", "BD", "KG", "UN", "LT", "L", "PC", "PCT", "SC", "FD",
    "GL", "TB", "BL", "GR", "ML", "MT", "CM", "UND",
}

_TIPO_MAP = {
    "PRODUTO ACABADO": "PRODUTO ACABADO",
    "MERCADORIA PARA REVENDA": "MERCADORIA PARA REVENDA",
    "MATERIA PRIMA": "MATERIA PRIMA",
    "MATÉRIA PRIMA": "MATERIA PRIMA",
    "INSUMO": "INSUMO",
    "EMBALAGEM": "EMBALAGEM",
    "INTERMEDIÁRIO": "INTERMEDIÁRIO",
    "SEMI ACABADO": "INTERMEDIÁRIO",
    "SEMI-ACABADO": "INTERMEDIÁRIO",
}


class ProdutosParser(WebMaisParser):
    """Parses the product catalog report from WebMais ERP."""

    def _extract(self, pdf: pdfplumber.PDF) -> list[ProdutoDTO]:
        produtos: list[ProdutoDTO] = []
        seen_codigos: set[str] = set()
        current_tipo = "PRODUTO ACABADO"

        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                line = self.clean_text(line)
                if not line:
                    continue

                if self._should_skip(line):
                    continue

                # Check for type section header
                tipo_match = _TIPO_HEADER.search(line)
                if tipo_match:
                    raw_tipo = tipo_match.group(1).strip().upper()
                    current_tipo = _TIPO_MAP.get(raw_tipo, raw_tipo)
                    continue

                # Check for product line
                prod_match = _PRODUCT_LINE.match(line)
                if prod_match:
                    codigo = prod_match.group(1)
                    rest = prod_match.group(2).strip()

                    if codigo in seen_codigos:
                        continue

                    # Last word is the unit
                    parts = rest.rsplit(None, 1)
                    if len(parts) < 2:
                        continue

                    descricao = parts[0].strip()
                    unidade = parts[1].strip().upper()

                    # Validate: unit should be a known abbreviation or short word
                    if unidade not in _KNOWN_UNITS and len(unidade) > 4:
                        continue

                    seen_codigos.add(codigo)
                    produtos.append(
                        ProdutoDTO(
                            codigo=codigo,
                            descricao=descricao,
                            tipo=current_tipo,
                            unidade_medida=unidade,
                        )
                    )

        logger.info("produtos_parsed", count=len(produtos))
        return produtos

    @staticmethod
    def _should_skip(line: str) -> bool:
        """Check if a line is a header/footer that should be skipped."""
        for pattern in _SKIP_PATTERNS:
            if pattern.search(line):
                return True
        return False
