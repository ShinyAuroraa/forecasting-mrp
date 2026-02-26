'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  DashboardKpis,
  RevenueChartData,
  ParetoData,
  StockCoverageData,
  ActiveAlertsSummary,
} from '@/types/dashboard';

const DASHBOARD_KEYS = {
  kpis: ['dashboard', 'kpis'] as const,
  revenueChart: ['dashboard', 'revenue-chart'] as const,
  pareto: ['dashboard', 'pareto'] as const,
  stockCoverage: ['dashboard', 'stock-coverage'] as const,
  alerts: ['alerts', 'summary'] as const,
};

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes (AC-22)

/**
 * Hook: KPI cards data.
 * @see AC-1..4, AC-16
 */
export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: DASHBOARD_KEYS.kpis,
    queryFn: async () => {
      const { data } = await api.get('/dashboard/kpis');
      return data;
    },
    refetchInterval: REFRESH_INTERVAL,
  });
}

/**
 * Hook: revenue chart data (12mo actual + 3mo forecast).
 * @see AC-5..8, AC-17
 */
export function useRevenueChart() {
  return useQuery<RevenueChartData>({
    queryKey: DASHBOARD_KEYS.revenueChart,
    queryFn: async () => {
      const { data } = await api.get('/dashboard/revenue-chart');
      return data;
    },
    refetchInterval: REFRESH_INTERVAL,
  });
}

/**
 * Hook: Pareto / ABC distribution.
 * @see AC-9..10, AC-18
 */
export function usePareto() {
  return useQuery<ParetoData>({
    queryKey: DASHBOARD_KEYS.pareto,
    queryFn: async () => {
      const { data } = await api.get('/dashboard/pareto');
      return data;
    },
    refetchInterval: REFRESH_INTERVAL,
  });
}

/**
 * Hook: stock coverage heatmap data.
 * @see AC-11..13, AC-19
 */
export function useStockCoverage() {
  return useQuery<StockCoverageData>({
    queryKey: DASHBOARD_KEYS.stockCoverage,
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stock-coverage');
      return data;
    },
    refetchInterval: REFRESH_INTERVAL,
  });
}

/**
 * Hook: active alerts summary for dashboard panel.
 * @see AC-14..15
 */
export function useActiveAlerts() {
  return useQuery<ActiveAlertsSummary>({
    queryKey: DASHBOARD_KEYS.alerts,
    queryFn: async () => {
      const { data } = await api.get('/alerts/summary');
      return data;
    },
    refetchInterval: REFRESH_INTERVAL,
  });
}
