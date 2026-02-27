"""PDF parsers for WebMais ERP reports."""

from src.parsers.produtos_parser import ProdutosParser
from src.parsers.faturamento_parser import FaturamentoParser
from src.parsers.movimentacao_parser import MovimentacaoParser
from src.parsers.inventario_parser import InventarioParser
from src.parsers.composicao_parser import ComposicaoParser

__all__ = [
    "ProdutosParser",
    "FaturamentoParser",
    "MovimentacaoParser",
    "InventarioParser",
    "ComposicaoParser",
]
