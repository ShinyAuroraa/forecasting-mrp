'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CategoriaOverride =
  | 'SEASONAL'
  | 'PROMOTION'
  | 'SUPPLY_DISRUPTION'
  | 'MARKET_INTELLIGENCE'
  | 'OTHER';

export interface ForecastOverride {
  id: string;
  forecastResultadoId: string | null;
  produtoId: string;
  periodo: string;
  originalP50: number | null;
  overrideP50: number;
  motivo: string;
  categoriaOverride: CategoriaOverride;
  revertedFromId: string | null;
  createdBy: string | null;
  createdAt: string;
  produto?: { id: string; codigo: string; descricao: string };
}

interface PaginatedOverrides {
  data: ForecastOverride[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface CreateOverrideInput {
  forecastResultadoId?: string;
  produtoId: string;
  periodo: string;
  originalP50?: number;
  overrideP50: number;
  motivo: string;
  categoriaOverride: CategoriaOverride;
}

export function useOverrides(filters?: {
  produtoId?: string;
  dateFrom?: string;
  dateTo?: string;
  categoriaOverride?: CategoriaOverride;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['forecast', 'overrides', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.produtoId) params.set('produtoId', filters.produtoId);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.categoriaOverride) params.set('categoriaOverride', filters.categoriaOverride);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));

      const response = await api.get<PaginatedOverrides>(
        `/forecast/overrides?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useCreateOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOverrideInput) => {
      const response = await api.post<ForecastOverride>(
        '/forecast/overrides',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forecast', 'overrides'] });
    },
  });
}

export function useRevertOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (overrideId: string) => {
      const response = await api.post<ForecastOverride>(
        `/forecast/overrides/${overrideId}/revert`,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forecast', 'overrides'] });
    },
  });
}
