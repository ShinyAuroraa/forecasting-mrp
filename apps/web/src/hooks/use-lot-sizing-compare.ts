import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LotSizingMethodResult {
  readonly method: string;
  readonly totalCost: number;
  readonly orderingCost: number;
  readonly holdingCost: number;
  readonly numberOfOrders: number;
  readonly avgOrderQty: number;
}

export interface LotSizingCompareResult {
  readonly produtoId: string;
  readonly methods: readonly LotSizingMethodResult[];
  readonly recommendation: string;
}

/**
 * Hook to fetch lot sizing cost comparison for a product.
 *
 * @see Story 5.1 — AC-11, AC-12, AC-13
 */
export function useLotSizingCompare(produtoId: string | null) {
  return useQuery({
    queryKey: ['mrp', 'lot-sizing-compare', produtoId],
    queryFn: async () => {
      const { data } = await api.get<LotSizingCompareResult>(
        '/mrp/lot-sizing/compare',
        { params: { produtoId } },
      );
      return data;
    },
    enabled: !!produtoId,
  });
}
