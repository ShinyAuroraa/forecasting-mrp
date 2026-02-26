'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DriftCheckResult {
  tipoModelo: string;
  status: 'STABLE' | 'WARNING' | 'DRIFTING';
  currentMape: number;
  rollingAvgMape: number;
  mapeIncreasePct: number;
  recentMapes: number[];
  checkedAt: string;
}

export function useDriftStatus() {
  return useQuery({
    queryKey: ['forecast', 'drift-status'],
    queryFn: async () => {
      const response = await api.get<DriftCheckResult[]>('/forecast/drift-status');
      return response.data;
    },
  });
}

export function useDriftStatusByModel(tipoModelo: string) {
  return useQuery({
    queryKey: ['forecast', 'drift-status', tipoModelo],
    queryFn: async () => {
      const response = await api.get<DriftCheckResult>(
        `/forecast/drift-status/${tipoModelo}`,
      );
      return response.data;
    },
    enabled: !!tipoModelo,
  });
}

export function useTriggerDriftCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tipoModelo?: string) => {
      const response = await api.post<DriftCheckResult | DriftCheckResult[]>(
        '/forecast/drift-check',
        tipoModelo ? { tipoModelo } : {},
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forecast', 'drift-status'] });
    },
  });
}
