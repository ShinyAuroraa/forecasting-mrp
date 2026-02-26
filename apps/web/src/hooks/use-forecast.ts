'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PaginatedResponse,
  ForecastExecution,
  ExecutionWithSteps,
  ForecastMetric,
  ForecastModelMeta,
  ExecuteForecastRequest,
} from '@/types/forecast';

interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ExecutionFilters extends PaginationParams {
  status?: string;
  jobType?: string;
}

interface MetricsFilters extends PaginationParams {
  executionId?: string;
  produtoId?: string;
  classeAbc?: string;
  modelName?: string;
  isBaseline?: boolean;
}

interface ModelsFilters extends PaginationParams {
  modelName?: string;
  isChampion?: boolean;
}

export function useExecutions(filters: ExecutionFilters = {}) {
  return useQuery({
    queryKey: ['forecast', 'executions', filters],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ForecastExecution>>(
        '/forecast/executions',
        { params: filters },
      );
      return response.data;
    },
  });
}

export function useExecution(id: string) {
  return useQuery({
    queryKey: ['forecast', 'executions', id],
    queryFn: async () => {
      const response = await api.get<{ data: ExecutionWithSteps }>(
        `/forecast/executions/${id}`,
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useExecuteForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ExecuteForecastRequest) => {
      const response = await api.post<{ data: ForecastExecution }>(
        '/forecast/execute',
        request,
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forecast', 'executions'],
      });
    },
  });
}

export function useMetrics(filters: MetricsFilters = {}) {
  return useQuery({
    queryKey: ['forecast', 'metrics', filters],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ForecastMetric>>(
        '/forecast/metrics',
        { params: filters },
      );
      return response.data;
    },
  });
}

export function useModels(filters: ModelsFilters = {}) {
  return useQuery({
    queryKey: ['forecast', 'models', filters],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ForecastModelMeta>>(
        '/forecast/models',
        { params: filters },
      );
      return response.data;
    },
  });
}

export interface ChampionInfo {
  id: string;
  tipoModelo: string;
  versao: number;
  isChampion: boolean;
  metricasTreino: Record<string, unknown> | null;
  treinadoEm: string | null;
  createdAt: string;
}

export function useCurrentChampion(tipoModelo?: string) {
  return useQuery({
    queryKey: ['forecast', 'champion', tipoModelo],
    queryFn: async () => {
      const response = await api.get<ChampionInfo>(
        '/forecast/champion',
        { params: tipoModelo ? { tipoModelo } : {} },
      );
      return response.data;
    },
  });
}

export function useChampionHistory(tipoModelo?: string) {
  return useQuery({
    queryKey: ['forecast', 'champion', 'history', tipoModelo],
    queryFn: async () => {
      const response = await api.get<ChampionInfo[]>(
        '/forecast/champion/history',
        { params: tipoModelo ? { tipoModelo } : {} },
      );
      return response.data;
    },
  });
}
