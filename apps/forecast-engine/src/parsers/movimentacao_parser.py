"""Parser for WebMais 'Relatório de Pedidos Emitidos por Período' PDF."""

from __future__ import annotations

import re

import pdfplumber
import structlog

from src.parsers.base import WebMaisParser
from src.parsers.models import MovimentacaoResumoDTO

logger = structlog.get_logger(__name__)

# Period: "PERÍODO : 01/01/2025 ATÉ 31/01/2025"
_PERIODO_PATTERN = re.compile(
    r"PER[ÍI]ODO\s*:\s*(\d{2})/(\d{2})/(\d{4})\s+AT[ÉE]",
    re.IGNORECASE,
)

# Product section header: "8 - ACAI BANANA BALDE 12L Nº REGISTROS: 28"
_SECTION_HEADER = re.compile(
    r"^(\d+)\s*-\s*(.+?)\s+N[ºo°]\s*REGISTROS\s*:\s*(\d+)",
    re.IGNORECASE,
)

# Subtotal line: only numbers separated by spaces (9 numbers typically)
_NUMBERS_ONLY = re.compile(r"^[\d.,\s]+$")

# Lines to skip
_SKIP_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"PARABRASIL\s+INDUSTRIA", re.IGNORECASE),
    re.compile(r"PEDIDOS\s+EMITIDOS", re.IGNORECASE),
    re.compile(r"^\d+\.\d+\.\d+/\d+-\d+"),
    re.compile(r"^RUA\s+"),
    re.compile(r"GESTOR\s*:", re.IGNORECASE),
    re.compile(r"M[ÓO]DULO\s*:", re.IGNORECASE),
    re.compile(r"PRG\s*:", re.IGNORECASE),
    re.compile(r"PER[ÍI]ODO\s*:", re.IGNORECASE),
    re.compile(r"AGRUPAMENTO\s*:", re.IGNORECASE),
    re.compile(r"VALOR\s+DOS\s+PEDIDOS", re.IGNORECASE),
    re.compile(r"ORIGEM\s+DO\s+PEDIDO", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+LISTAGEM", re.IGNORECASE),
    re.compile(r"MOSTRAR\s+CAMPOS", re.IGNORECASE),
    re.compile(r"EMPRESA\s*:", re.IGNORECASE),
    re.compile(r"RECREIO\s+IPITANGA", re.IGNORECASE),
    re.compile(r"LAURO\s+DE\s+FREITAS", re.IGNORECASE),
    re.compile(r"^N[ºo°]\s+ICMS", re.IGNORECASE),
    re.compile(r"^EMISS[ÃA]O\s+CLIENTE", re.IGNORECASE),
    re.compile(r"^PEDIDO\s+FCP", re.IGNORECASE),
    re.compile(r"^\d+\s+of\s+\d+", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{4},?\s*\d{2}:\d{2}"),
    re.compile(r"^LTDA\s*$", re.IGNORECASE),
]


class MovimentacaoParser(WebMaisParser):
    """Parses movement/order reports from WebMais ERP.

    Returns aggregated monthly summaries per product using section subtotals.
    """

    def _extract(self, pdf: pdfplumber.PDF) -> list[MovimentacaoResumoDTO]:
        periodo = self._detect_periodo(pdf)
        results: list[MovimentacaoResumoDTO] = []

        # Collect all text lines from all pages
        all_lines: list[str] = []
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                cleaned = self.clean_text(line)
                if cleaned:
                    all_lines.append(cleaned)

        # Find all product sections
        sections: list[dict] = []
        for i, line in enumerate(all_lines):
            header_match = _SECTION_HEADER.match(line)
            if header_match:
                sections.append({
                    "codigo": header_match.group(1).zfill(6),
                    "descricao": header_match.group(2).strip(),
                    "num_pedidos": int(header_match.group(3)),
                    "start_line": i,
                })

        # For each section, find the subtotal line (last numbers-only line before next section)
        for idx, section in enumerate(sections):
            start = section["start_line"] + 1
            end = sections[idx + 1]["start_line"] if idx + 1 < len(sections) else len(all_lines)

            # Find the last numbers-only line in this section
            subtotal_line = None
            for i in range(end - 1, start - 1, -1):
                line = all_lines[i]
                if self._should_skip(line):
                    continue
                # Check if line is only numbers (subtotal)
                if self._is_numbers_only(line):
                    subtotal_line = line
                    break

            total_brt = 0.0
            total_liq = 0.0
            if subtotal_line:
                numbers = self._extract_numbers(subtotal_line)
                if len(numbers) >= 2:
                    total_brt = numbers[-2]  # second-to-last
                    total_liq = numbers[-1]  # last

            results.append(
                MovimentacaoResumoDTO(
                    codigo_produto=section["codigo"],
                    descricao=section["descricao"],
                    periodo=periodo,
                    total_quantidade=float(section["num_pedidos"]),
                    total_valor=total_liq if total_liq > 0 else total_brt,
                    num_pedidos=section["num_pedidos"],
                )
            )

        logger.info("movimentacao_parsed", count=len(results), periodo=periodo)
        return results

    def _detect_periodo(self, pdf: pdfplumber.PDF) -> str:
        for page in pdf.pages[:2]:
            text = page.extract_text() or ""
            match = _PERIODO_PATTERN.search(text)
            if match:
                month = match.group(2)
                year = match.group(3)
                return f"{month}/{year}"
        return "01/2025"

    def _is_numbers_only(self, line: str) -> bool:
        """Check if a line contains only numbers (subtotal line)."""
        # Remove all digits, dots, commas, and spaces
        stripped = re.sub(r"[\d.,\s]", "", line)
        return len(stripped) == 0 and len(line.strip()) > 0

    def _extract_numbers(self, line: str) -> list[float]:
        """Extract all numbers from a line."""
        tokens = line.split()
        numbers = []
        for token in tokens:
            val = self.parse_brazilian_number(token)
            numbers.append(val)
        return numbers

    @staticmethod
    def _should_skip(line: str) -> bool:
        for pattern in _SKIP_PATTERNS:
            if pattern.search(line):
                return True
        return False
