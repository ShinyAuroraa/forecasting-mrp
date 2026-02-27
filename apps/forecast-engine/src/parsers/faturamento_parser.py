"""Parser for WebMais 'Relatório de Faturamento Agrupado' PDF."""

from __future__ import annotations

import re

import pdfplumber
import structlog

from src.parsers.base import WebMaisParser
from src.parsers.models import FaturamentoDTO

logger = structlog.get_logger(__name__)

# Period from header: "PERÍODO DE EMISSÃO : 01/01/2025 ATÉ 31/01/2025"
_PERIODO_PATTERN = re.compile(
    r"PER[ÍI]ODO\s+(?:DE\s+EMISS[ÃA]O\s*)?:\s*(\d{2})/(\d{2})/(\d{4})\s+AT[ÉE]",
    re.IGNORECASE,
)

# Product code at start of line: "8 - ACAI BANANA BALDE 12L ..."
_PRODUCT_CODE = re.compile(r"^(\d+)\s*-\s*")

# 6 trailing numbers: qtde_pc, qtde_kg, vlr_medio_kg, total_brt, total_liq, prz_medio
_TRAILING_6_NUMBERS = re.compile(
    r"([\d.]+)\s+([\d.]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$"
)

# Lines to skip
_SKIP_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"PARABRASIL\s+INDUSTRIA", re.IGNORECASE),
    re.compile(r"FATURAMENTO\s+AGRUPADO", re.IGNORECASE),
    re.compile(r"^LTDA\s*$", re.IGNORECASE),
    re.compile(r"PER[ÍI]ODO\s+DE\s+EMISS", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+LISTAGEM", re.IGNORECASE),
    re.compile(r"AGRUPAMENTO\s*:", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+PESO", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+PRODUTO", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+OPERA", re.IGNORECASE),
    re.compile(r"ESTADO\(S\)", re.IGNORECASE),
    re.compile(r"EMPRESA\s+ORIGEM", re.IGNORECASE),
    re.compile(r"SUBGRUPO\s*:", re.IGNORECASE),
    re.compile(r"^\s*QTDE/", re.IGNORECASE),
    re.compile(r"^\s*PRODUTO\s+TOTAL", re.IGNORECASE),
    re.compile(r"^\s*PC\s+KG", re.IGNORECASE),
    re.compile(r"GESTOR\s*:", re.IGNORECASE),
    re.compile(r"M[ÓO]DULO\s*:", re.IGNORECASE),
    re.compile(r"PRG\s*:", re.IGNORECASE),
    re.compile(r"RUA\s+IRARA", re.IGNORECASE),
    re.compile(r"RECREIO\s+IPITANGA", re.IGNORECASE),
    re.compile(r"LAURO\s+DE\s+FREITAS", re.IGNORECASE),
    re.compile(r"^\d+\.\d+\.\d+/\d+-\d+"),  # CNPJ
    re.compile(r"^\d+\s+of\s+\d+", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{4},?\s+\d{2}:\d{2}"),
]


class FaturamentoParser(WebMaisParser):
    """Parses the grouped billing report from WebMais ERP."""

    def _extract(self, pdf: pdfplumber.PDF) -> list[FaturamentoDTO]:
        periodo = self._detect_periodo(pdf)
        results: list[FaturamentoDTO] = []
        pending_product: dict | None = None

        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")

            for line in lines:
                line = self.clean_text(line)
                if not line:
                    continue

                if self._should_skip(line):
                    continue

                # Check if line starts with product code
                code_match = _PRODUCT_CODE.match(line)
                if code_match:
                    codigo = code_match.group(1).zfill(6)
                    remaining = line[code_match.end():].strip()

                    # Try to find 6 trailing numbers on the same line
                    numbers_match = _TRAILING_6_NUMBERS.search(remaining)
                    if numbers_match:
                        descricao = remaining[:numbers_match.start()].strip()
                        item = self._build_item(
                            codigo, descricao, periodo,
                            numbers_match.group(1), numbers_match.group(2),
                            numbers_match.group(3), numbers_match.group(4),
                            numbers_match.group(5), numbers_match.group(6),
                        )
                        if item:
                            # Save any pending product first
                            if pending_product:
                                pending_product = None
                            results.append(item)
                    else:
                        # Numbers might be on the next line
                        if pending_product:
                            pass  # discard incomplete pending
                        pending_product = {
                            "codigo": codigo,
                            "descricao": remaining,
                        }
                    continue

                # If we have a pending product, check if this line has the 6 numbers
                if pending_product:
                    numbers_match = _TRAILING_6_NUMBERS.search(line)
                    if numbers_match:
                        # Text before numbers might be continuation of description
                        extra_desc = line[:numbers_match.start()].strip()
                        if extra_desc:
                            pending_product["descricao"] += " " + extra_desc
                        item = self._build_item(
                            pending_product["codigo"],
                            pending_product["descricao"],
                            periodo,
                            numbers_match.group(1), numbers_match.group(2),
                            numbers_match.group(3), numbers_match.group(4),
                            numbers_match.group(5), numbers_match.group(6),
                        )
                        if item:
                            results.append(item)
                        pending_product = None
                    else:
                        # This might be a description continuation or noise
                        # Only append if it looks like text (not just numbers)
                        if re.search(r"[a-zA-ZÀ-ÿ]", line):
                            pending_product["descricao"] += " " + line
                    continue

        logger.info("faturamento_parsed", count=len(results), periodo=periodo)
        return results

    def _detect_periodo(self, pdf: pdfplumber.PDF) -> str:
        """Extract period (MM/YYYY) from the report header."""
        for page in pdf.pages[:2]:
            text = page.extract_text() or ""
            match = _PERIODO_PATTERN.search(text)
            if match:
                day = match.group(1)
                month = match.group(2)
                year = match.group(3)
                # If day field is actually the month (DD/MM/YYYY)
                # The format is DD/MM/YYYY, so month is group(2)
                return f"{month}/{year}"
        return "01/2025"

    def _build_item(
        self, codigo: str, descricao: str, periodo: str,
        qtde_pc_str: str, qtde_kg_str: str, vlr_medio_str: str,
        total_brt_str: str, total_liq_str: str, prz_medio_str: str,
    ) -> FaturamentoDTO | None:
        """Build a FaturamentoDTO from parsed strings."""
        qtde_pc = self.parse_int_safe(qtde_pc_str)
        qtde_kg = self.parse_brazilian_number(qtde_kg_str)
        vlr_medio = self.parse_brazilian_number(vlr_medio_str)
        total_brt = self.parse_brazilian_number(total_brt_str)
        total_liq = self.parse_brazilian_number(total_liq_str)
        prz_medio = self.parse_brazilian_number(prz_medio_str)

        # Skip if all values are zero (likely a subtotal or header line)
        if qtde_pc == 0 and qtde_kg == 0 and total_brt == 0 and total_liq == 0:
            return None

        return FaturamentoDTO(
            codigo_produto=codigo,
            descricao=descricao.strip(),
            periodo=periodo,
            qtde_pecas=qtde_pc,
            qtde_kg=qtde_kg,
            preco_medio_kg=vlr_medio,
            valor_bruto=total_brt,
            valor_liquido=total_liq,
            prazo_medio=prz_medio,
        )

    @staticmethod
    def _should_skip(line: str) -> bool:
        for pattern in _SKIP_PATTERNS:
            if pattern.search(line):
                return True
        return False
