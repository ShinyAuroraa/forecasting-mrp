"""Parser for WebMais 'Relatório de Composição / Engenharia' PDF."""

from __future__ import annotations

import re

import pdfplumber
import structlog

from src.parsers.base import WebMaisParser
from src.parsers.models import ComposicaoDTO, InsumoDTO

logger = structlog.get_logger(__name__)

# Lines to skip
_SKIP_PATTERNS = [
    re.compile(r"https?://"),
    re.compile(r"PARABRASIL\s+INDUSTRIA", re.IGNORECASE),
    re.compile(r"ENGENHARIA\s*/?\s*COMPOSI", re.IGNORECASE),
    re.compile(r"^\d+\.\d+\.\d+/\d+-\d+"),
    re.compile(r"^RUA\s+"),
    re.compile(r"GESTOR\s*:", re.IGNORECASE),
    re.compile(r"M[ÓO]DULO\s*:", re.IGNORECASE),
    re.compile(r"PRG\s*:", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+LISTAGEM", re.IGNORECASE),
    re.compile(r"AGRUPAMENTO\s*:", re.IGNORECASE),
    re.compile(r"ORDENA[ÇC][ÃA]O\s*:", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+PRODUTO\s+ENGENHARIA", re.IGNORECASE),
    re.compile(r"TIPO\s+DE\s+PRODUTO\s+INSUMOS", re.IGNORECASE),
    re.compile(r"MOSTRAR\s+CAMPOS", re.IGNORECASE),
    re.compile(r"EMPRESA\s*:", re.IGNORECASE),
    re.compile(r"RECREIO\s+IPITANGA", re.IGNORECASE),
    re.compile(r"LAURO\s+DE\s+FREITAS", re.IGNORECASE),
    re.compile(r"^\d+\s+of\s+\d+", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{4},?\s*\d{2}:\d{2}"),
    re.compile(r"^Produto\s+Engenharia\s+Un", re.IGNORECASE),
    re.compile(r"^Composi[çc][ãa]o\s*:\s*Insumos", re.IGNORECASE),
    re.compile(r"^Servi[çc]os/Outros", re.IGNORECASE),
]

# Type section header: "1 - PRODUTO ACABADO" (low code number, known type names)
_TYPE_SECTION = re.compile(
    r"^\d+\s*-\s*(?:PRODUTO\s+ACABADO|MERCADORIA\s+PARA\s+REVENDA|"
    r"MATERIA\s+PRIMA|MAT[ÉE]RIA\s+PRIMA|INSUMO|EMBALAGEM|"
    r"INTERMEDI[ÁA]RIO|SEMI[- ]?ACABADO)\s*$",
    re.IGNORECASE,
)

# Line starting with a code: "NNN - description..."
_CODE_LINE = re.compile(r"^(\d+)\s*-\s*(.+)$")

# 5 trailing numbers (parent product): peso_bruto, peso_liq, coeficiente, densidade, rendimento
_TRAILING_5_NUMBERS = re.compile(
    r"([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$"
)

# 2 trailing numbers (insumo): perda, quantidade
_TRAILING_2_NUMBERS = re.compile(
    r"([\d.,]+)\s+([\d.,]+)\s*$"
)


class ComposicaoParser(WebMaisParser):
    """Parses BOM/composition engineering report from WebMais ERP."""

    def _extract(self, pdf: pdfplumber.PDF) -> list[ComposicaoDTO]:
        composicoes: list[ComposicaoDTO] = []
        current_parent: dict | None = None
        current_insumos: list[InsumoDTO] = []
        in_insumo_section = False

        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                line = self.clean_text(line)
                if not line:
                    continue

                if self._should_skip(line):
                    # Check section markers
                    if re.search(r"Composi[çc][ãa]o\s*:\s*Insumos", line, re.IGNORECASE):
                        in_insumo_section = True
                    elif re.search(r"Servi[çc]os/Outros", line, re.IGNORECASE):
                        in_insumo_section = False
                    continue

                # Check for type section header
                if _TYPE_SECTION.match(line):
                    continue

                code_match = _CODE_LINE.match(line)
                if not code_match:
                    continue

                codigo = code_match.group(1).zfill(6)
                rest = code_match.group(2).strip()

                # Try to match as parent product (5 trailing numbers)
                five_match = _TRAILING_5_NUMBERS.search(rest)
                if five_match:
                    # Check that remaining text before numbers contains a unit
                    text_before = rest[:five_match.start()].strip()
                    parts = text_before.rsplit(None, 1)

                    if len(parts) >= 2:
                        descricao = parts[0].strip()
                        unidade = parts[1].strip().upper()
                    else:
                        descricao = text_before
                        unidade = "UN"

                    # Save previous parent
                    if current_parent:
                        composicoes.append(
                            self._build_composicao(current_parent, current_insumos)
                        )

                    current_parent = {
                        "codigo": codigo,
                        "descricao": descricao,
                        "unidade": unidade,
                        "peso_bruto": self.parse_brazilian_number(five_match.group(1)),
                        "peso_liquido": self.parse_brazilian_number(five_match.group(2)),
                        "rendimento": self.parse_brazilian_number(five_match.group(5)),
                    }
                    current_insumos = []
                    in_insumo_section = False
                    continue

                # Try to match as insumo (2 trailing numbers)
                if current_parent:
                    two_match = _TRAILING_2_NUMBERS.search(rest)
                    if two_match:
                        text_before = rest[:two_match.start()].strip()
                        parts = text_before.rsplit(None, 1)

                        if len(parts) >= 2:
                            descricao = parts[0].strip()
                            unidade = parts[1].strip()
                        else:
                            descricao = text_before
                            unidade = "un"

                        perda = self.parse_brazilian_number(two_match.group(1))
                        quantidade = self.parse_brazilian_number(two_match.group(2))

                        current_insumos.append(
                            InsumoDTO(
                                codigo=codigo,
                                descricao=descricao,
                                unidade=unidade.upper(),
                                quantidade=quantidade,
                                perda_percentual=perda,
                            )
                        )

        # Save last parent
        if current_parent:
            composicoes.append(
                self._build_composicao(current_parent, current_insumos)
            )

        logger.info("composicao_parsed", count=len(composicoes))
        return composicoes

    @staticmethod
    def _build_composicao(parent: dict, insumos: list[InsumoDTO]) -> ComposicaoDTO:
        return ComposicaoDTO(
            produto_pai_codigo=parent["codigo"],
            produto_pai_descricao=parent["descricao"],
            produto_pai_unidade=parent["unidade"],
            peso_bruto=parent["peso_bruto"],
            peso_liquido=parent["peso_liquido"],
            rendimento=parent["rendimento"],
            insumos=insumos,
        )

    @staticmethod
    def _should_skip(line: str) -> bool:
        for pattern in _SKIP_PATTERNS:
            if pattern.search(line):
                return True
        return False
