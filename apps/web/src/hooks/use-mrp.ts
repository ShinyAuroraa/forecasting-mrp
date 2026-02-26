'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/types/forecast';
import type {
  PlannedOrder,
  CapacityWeekRecord,
  StockParams,
  StorageDepositoRecord,
} from '@/types/mrp';

/**
 * Hook: Fetch planned orders for a given MRP execution.
 *
 * Used by MRP Gantt and MRP Detail pages.
 *
 * @param execucaoId - MRP execution UUID (null disables the query)
 * @param produtoId - Optional product filter
 * @param tipo - Optional order type filter (COMPRA | PRODUCAO)
 * @see Story 3.12 — MRP & Capacity Dashboards (AC-1 to AC-7)
 */
export function useMrpOrders(
  execucaoId: string | null,
  produtoId?: string,
  tipo?: string,
) {
  return useQuery({
    queryKey: ['mrp', 'orders', execucaoId, produtoId, tipo],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<PlannedOrder>>(
        '/mrp/orders',
        { params: { execucaoId, produtoId, tipo, limit: 500 } },
      );
      return res.data;
    },
    enabled: !!execucaoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook: Fetch capacity load records for a given MRP execution.
 *
 * Used by Capacity Dashboard page.
 *
 * @param execucaoId - MRP execution UUID (null disables the query)
 * @param centroTrabalhoId - Optional work center filter
 * @see Story 3.12 — Capacity Dashboard (AC-12 to AC-16)
 */
export function useMrpCapacity(
  execucaoId: string | null,
  centroTrabalhoId?: string,
) {
  return useQuery({
    queryKey: ['mrp', 'capacity', execucaoId, centroTrabalhoId],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<CapacityWeekRecord>>(
        '/mrp/capacity',
        { params: { execucaoId, centroTrabalhoId, limit: 500 } },
      );
      return res.data;
    },
    enabled: !!execucaoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook: Fetch stock parameter records for a given MRP execution.
 *
 * Used by MRP Detail and Stock Projection pages.
 *
 * @param execucaoId - MRP execution UUID (null disables the query)
 * @param produtoId - Optional product filter
 * @see Story 3.12 — Stock Projection (AC-8 to AC-11)
 */
export function useMrpStockParams(
  execucaoId: string | null,
  produtoId?: string,
) {
  return useQuery({
    queryKey: ['mrp', 'stock-params', execucaoId, produtoId],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<StockParams>>(
        '/mrp/stock-params',
        { params: { execucaoId, produtoId } },
      );
      return res.data;
    },
    enabled: !!execucaoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook: Fetch storage validation results for a given MRP execution.
 *
 * Used by Capacity Dashboard page for warehouse gauges.
 * Gracefully returns empty if endpoint is not yet available.
 *
 * @param execucaoId - MRP execution UUID (null disables the query)
 * @see Story 3.12 — Capacity Dashboard (AC-15)
 */
export function useMrpStorage(execucaoId: string | null) {
  return useQuery({
    queryKey: ['mrp', 'storage', execucaoId],
    queryFn: async () => {
      const res = await api.get<{ data: readonly StorageDepositoRecord[] }>(
        '/mrp/storage',
        { params: { execucaoId } },
      );
      return res.data.data;
    },
    enabled: !!execucaoId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
