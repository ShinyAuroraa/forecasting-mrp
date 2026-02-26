"""SKU segmentation — groups products by assigned forecast model."""

from dataclasses import dataclass, field

from src.db.models import ClasseABC, PadraoDemanda, SkuClassification
from src.models.registry import ModelRegistry, ModelSelection


@dataclass
class SkuSegment:
    """A group of SKUs assigned to the same primary model."""

    model_name: str
    produto_ids: list[str] = field(default_factory=list)
    selections: dict[str, ModelSelection] = field(default_factory=dict)


class SkuSegmenter:
    """Groups products into segments based on their classification and model assignment."""

    def __init__(self, registry: ModelRegistry | None = None) -> None:
        self._registry = registry or ModelRegistry()

    def segment(
        self,
        classifications: list[SkuClassification],
        *,
        weeks_by_product: dict[str, int] | None = None,
    ) -> dict[str, SkuSegment]:
        """Segment SKUs by their assigned primary model.

        Args:
            classifications: List of SKU classification records
            weeks_by_product: Optional mapping of produto_id -> weeks of data available

        Returns:
            Dictionary of model_name -> SkuSegment
        """
        segments: dict[str, SkuSegment] = {}

        for classification in classifications:
            weeks = (
                weeks_by_product.get(classification.produto_id)
                if weeks_by_product
                else None
            )

            selection = self._registry.select_model(
                classe_abc=ClasseABC(classification.classe_abc),
                padrao_demanda=PadraoDemanda(classification.padrao_demanda),
                modelo_override=classification.modelo_forecast_sugerido,
                weeks_of_data=weeks,
            )

            model_name = selection.primary
            if model_name not in segments:
                segments[model_name] = SkuSegment(model_name=model_name)

            segments[model_name].produto_ids.append(classification.produto_id)
            segments[model_name].selections[classification.produto_id] = selection

        return segments
