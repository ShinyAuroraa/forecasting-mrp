"""Base class for WebMais PDF report parsers."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import TypeVar

import pdfplumber
import structlog

T = TypeVar("T")
logger = structlog.get_logger(__name__)


class WebMaisParser(ABC):
    """Base parser for WebMais ERP PDF reports."""

    def parse(self, pdf_bytes: bytes) -> list:
        """Parse a PDF file from raw bytes."""
        logger.info("parsing_pdf", parser=self.__class__.__name__, size=len(pdf_bytes))
        try:
            import io
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                return self._extract(pdf)
        except Exception:
            logger.exception("pdf_parse_error", parser=self.__class__.__name__)
            raise

    @abstractmethod
    def _extract(self, pdf: pdfplumber.PDF) -> list:
        """Extract structured data from the opened PDF."""

    @staticmethod
    def clean_text(text: str | None) -> str:
        """Normalize whitespace in extracted text."""
        if not text:
            return ""
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def parse_brazilian_number(value: str) -> float:
        """Parse a Brazilian-formatted number (1.234,56) to float."""
        if not value or not value.strip():
            return 0.0
        cleaned = value.strip().replace(".", "").replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    @staticmethod
    def parse_int_safe(value: str) -> int:
        """Parse an integer, returning 0 on failure."""
        if not value or not value.strip():
            return 0
        cleaned = value.strip().replace(".", "").replace(",", ".")
        try:
            return int(float(cleaned))
        except ValueError:
            return 0
