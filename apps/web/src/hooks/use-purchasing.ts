'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PurchasingPanelResponse,
  MrpExecution,
} from '@/types/purchasing';
import type { PaginatedResponse } from '@/types/forecast';

/**
 * Hook: Fetch purchasing panel data for a given MRP execution.
 *
 * @param execucaoId - MRP execution UUID (null disables the query)
 * @see Story 3.11 — Purchasing Panel (AC-1)
 */
export function usePurchasingPanel(execucaoId: string | null) {
  return useQuery({
    queryKey: ['purchasing', 'panel', execucaoId],
    queryFn: async () => {
      const res = await api.get<{ data: PurchasingPanelResponse }>(
        '/mrp/purchasing-panel',
        { params: { execucaoId } },
      );
      return res.data.data;
    },
    enabled: !!execucaoId,
  });
}

/**
 * Hook: Fetch list of MRP executions for the execution selector.
 *
 * @see Story 3.11 — Purchasing Panel (AC-14)
 */
export function useMrpExecutions() {
  return useQuery({
    queryKey: ['mrp', 'executions'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<MrpExecution>>(
        '/mrp/executions',
        { params: { limit: 20, sortOrder: 'desc' } },
      );
      return res.data;
    },
  });
}

/**
 * Hook: Export purchasing panel data as Excel file.
 *
 * Triggers a browser file download using Blob URL.
 *
 * @see Story 3.11 — Purchasing Panel (AC-6, AC-12)
 */
export function useExportPurchasing() {
  return useMutation({
    mutationFn: async (execucaoId: string) => {
      const res = await api.get('/mrp/purchasing-panel/export', {
        params: { execucaoId },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `compras-${execucaoId.slice(0, 8)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}

/**
 * Hook: Send purchasing panel email summary.
 *
 * @see Story 3.11 — Purchasing Panel (AC-7, AC-13)
 */
export function useEmailSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (execucaoId: string) => {
      const res = await api.post<{
        sent: boolean;
        recipients: string[];
      }>('/mrp/purchasing-panel/email-summary', { execucaoId });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['purchasing'],
      });
    },
  });
}
