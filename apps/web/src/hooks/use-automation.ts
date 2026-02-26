'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ErpConfig,
  TestConnectionResult,
  FetchResult,
  ConnectorType,
} from '@/types/automation';

const CONFIG_KEY = ['automation', 'config'];

/**
 * Hook: Fetch ERP connector configuration.
 * @see Story 4.2 — AC-3, AC-16
 */
export function useErpConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: async () => {
      const res = await api.get<ErpConfig>('/automation/config');
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook: Update ERP connector configuration.
 * @see Story 4.2 — AC-16
 */
export function useUpdateErpConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: ErpConfig) => {
      const res = await api.put<ErpConfig>('/automation/config', config);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
    },
  });
}

/**
 * Hook: Test ERP connector connection.
 * @see Story 4.2 — AC-17
 */
export function useTestConnection() {
  return useMutation({
    mutationFn: async (tipo?: ConnectorType) => {
      const res = await api.post<TestConnectionResult>(
        '/automation/test-connection',
        { tipo },
      );
      return res.data;
    },
  });
}

/**
 * Hook: Manually trigger daily data fetch.
 * @see Story 4.2 — AC-13
 */
export function useFetchDailyData() {
  return useMutation({
    mutationFn: async (date?: string) => {
      const res = await api.post<FetchResult>(
        '/automation/fetch',
        null,
        { params: date ? { date } : undefined },
      );
      return res.data;
    },
  });
}
