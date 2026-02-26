import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HistogramBucket {
  readonly rangeMin: number;
  readonly rangeMax: number;
  readonly count: number;
}

export interface MonteCarloResult {
  readonly safetyStock: number;
  readonly iterations: number;
  readonly meanDemandOverLt: number;
  readonly confidenceInterval: {
    readonly p5: number;
    readonly p95: number;
  };
  readonly histogram: readonly HistogramBucket[];
}

interface MonteCarloParams {
  readonly produtoId: string;
  readonly serviceLevel?: number;
  readonly iterations?: number;
}

/**
 * Hook to trigger Monte Carlo safety stock simulation.
 * Uses mutation since it's a POST endpoint.
 *
 * @see Story 5.2 — AC-11, AC-12
 */
export function useMonteCarloSimulation() {
  return useMutation({
    mutationFn: async (params: MonteCarloParams) => {
      const { data } = await api.post<MonteCarloResult>(
        '/mrp/stock-params/monte-carlo',
        params,
      );
      return data;
    },
  });
}
