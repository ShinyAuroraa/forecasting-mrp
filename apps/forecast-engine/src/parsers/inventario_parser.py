"""Parser for WebMais 'Posição Geral de Estoque / Inventário' PDF."""

from __future__ import annotations

import re

import pdfplumber
import structlog

from src.parsers.base import WebMaisParser
from src.parsers.models import InventarioDTO

logger = structlog.get_logger(__name__)

# Group header: "GRUPO: AÇAÍS E CREMES"
_GROUP_HEADER = re.compile(r"GRUPO\s*:\s*(.+)", re.IGNORECASE)

# Product line: "000002 - ACAI NATURAL CX 10L CX 717,000000"
_PRODUCT_LINE = re.compile(r"^(\d{6})\s*-\s*(.+)$")

# Lines to skip
_SKIP_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"PARABRASIL\s+INDUSTRIA", re.IGNORECASE),
    re.compile(r"POSI[ÇC][ÃA]O\s+GERAL\s+DE\s+ESTOQUE", re.IGNORECASE),
    re.compile(r"^\d+\.\d+\.\d+/\d+-\d+"),  # CNPJ
    re.compile(r"^RUA\s+"),
    re.compile(r"GESTOR\s*:", re.IGNORECASE),
    re.compile(r"M[ÓO]DULO\s*:", re.IGNORECASE),
    re.compile(r"PRG\s*:", re.IGNORECASE),
    re.compile(r"DATA\s+BASE", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+LISTAGEM", re.IGNORECASE),
    re.compile(r"AGRUPAMENTO\s*:", re.IGNORECASE),
    re.compile(r"EXIBIR\s+PRODUTOS", re.IGNORECASE),
    re.compile(r"ORDENA[ÇC][ÃA]O\s*:", re.IGNORECASE),
    re.compile(r"EMPRESA\s*:", re.IGNORECASE),
    re.compile(r"^\s*PRODUTO\s+UN\s+QTDE", re.IGNORECASE),
    re.compile(r"QTDE/TERC", re.IGNORECASE),
    re.compile(r"QTDE/TOTAL", re.IGNORECASE),
    re.compile(r"PRE[ÇC]O\s*:", re.IGNORECASE),
    re.compile(r"RECREIO\s+IPITANGA", re.IGNORECASE),
    re.compile(r"LAURO\s+DE\s+FREITAS", re.IGNORECASE),
    re.compile(r"^\d+\s+of\s+\d+", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{4},?\s*\d{2}:\d{2}"),
]

# Number with 6 decimal places: "717,000000" or "0,000000"
_QUANTITY_PATTERN = re.compile(r"[\d.,]+$")


class InventarioParser(WebMaisParser):
    """Parses inventory/stock position report from WebMais ERP."""

    def _extract(self, pdf: pdfplumber.PDF) -> list[InventarioDTO]:
        results: list[InventarioDTO] = []
        seen_codigos: set[str] = set()
        current_group = "GERAL"

        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                line = self.clean_text(line)
                if not line:
                    continue

                if self._should_skip(line):
                    continue

                # Check for group header
                group_match = _GROUP_HEADER.search(line)
                if group_match:
                    current_group = group_match.group(1).strip()
                    continue

                # Check for subtotal line (just a number, no code)
                stripped = line.strip()
                if re.match(r"^[\d.,]+$", stripped):
                    continue  # group subtotal

                # Check for product line
                prod_match = _PRODUCT_LINE.match(line)
                if not prod_match:
                    continue

                codigo = prod_match.group(1)
                rest = prod_match.group(2).strip()

                # Split from right: last token should be quantity, second-to-last is unit
                # Format: "{description} {unit} {quantity}"
                parts = rest.rsplit(None, 1)
                if len(parts) < 2:
                    continue

                quantity_str = parts[1]
                # Verify last token looks like a number
                if not re.match(r"^[\d.,]+$", quantity_str):
                    continue

                remaining = parts[0]
                # Split again: last token is unit
                parts2 = remaining.rsplit(None, 1)
                if len(parts2) < 2:
                    continue

                descricao = parts2[0].strip()
                unidade = parts2[1].strip()

                # Deduplicate by codigo within the same group
                dedup_key = f"{codigo}_{current_group}"
                if dedup_key in seen_codigos:
                    continue
                seen_codigos.add(dedup_key)

                results.append(
                    InventarioDTO(
                        codigo_produto=codigo,
                        descricao=descricao,
                        unidade=unidade.upper(),
                        grupo=current_group,
                        quantidade=self.parse_brazilian_number(quantity_str),
                    )
                )

        logger.info("inventario_parsed", count=len(results))
        return results

    @staticmethod
    def _should_skip(line: str) -> bool:
        for pattern in _SKIP_PATTERNS:
            if pattern.search(line):
                return True
        return False
