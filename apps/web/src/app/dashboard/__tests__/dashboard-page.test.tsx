import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock chart component (ECharts requires DOM not available in jsdom)
jest.mock('@/components/charts/chart-base', () => ({
  ChartBase: ({ option }: { option: unknown }) => <div data-testid="chart-base">Chart</div>,
}));

// Mock hooks
const mockKpis = {
  monthlyRevenue: { label: 'Receita Mensal', value: 150000, unit: 'BRL', variation: { value: 10000, percent: 7.1, direction: 'up' } },
  forecastAccuracy: { label: 'Acurácia Forecast', value: 86.5, unit: '%', variation: { value: 0, percent: 0, direction: 'stable' } },
  inventoryTurnover: { label: 'Giro de Estoque', value: 4.2, unit: 'x', variation: { value: 0, percent: 0, direction: 'stable' } },
  fillRate: { label: 'Fill Rate (OTIF)', value: 92.3, unit: '%', variation: { value: 0, percent: 0, direction: 'stable' } },
  referenceDate: '2026-02-26',
};

const mockRevenueChart = {
  points: [
    { period: '2025-12', actual: 120000, forecastIndirect: null, forecastDirect: null, p10: null, p90: null },
    { period: '2026-01', actual: 140000, forecastIndirect: null, forecastDirect: null, p10: null, p90: null },
  ],
  divergenceFlags: [],
};

const mockPareto = {
  items: [
    { classeAbc: 'A', skuCount: 20, totalRevenue: 800000, revenuePercent: 80, cumulativePercent: 80 },
    { classeAbc: 'B', skuCount: 30, totalRevenue: 150000, revenuePercent: 15, cumulativePercent: 95 },
    { classeAbc: 'C', skuCount: 50, totalRevenue: 50000, revenuePercent: 5, cumulativePercent: 100 },
  ],
  totalRevenue: 1000000,
};

const mockCoverage = {
  items: [
    { produtoId: 'p1', codigo: 'SKU-001', descricao: 'Produto A', classeAbc: 'A', coverageDays: 5, colorZone: 'red' as const },
    { produtoId: 'p2', codigo: 'SKU-002', descricao: 'Produto B', classeAbc: 'B', coverageDays: 25, colorZone: 'yellow' as const },
  ],
};

const mockAlerts = {
  categories: [
    { type: 'STOCKOUT', label: 'SKUs em Stockout', count: 3 },
    { type: 'CAPACITY_OVERLOAD', label: 'Centros Sobrecarregados', count: 1 },
  ],
  total: 4,
};

jest.mock('@/hooks/use-dashboard', () => ({
  useDashboardKpis: () => ({ data: mockKpis, isLoading: false }),
  useRevenueChart: () => ({ data: mockRevenueChart, isLoading: false }),
  usePareto: () => ({ data: mockPareto, isLoading: false }),
  useStockCoverage: () => ({ data: mockCoverage, isLoading: false }),
  useActiveAlerts: () => ({ data: mockAlerts, isLoading: false }),
}));

import DashboardPage from '../page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('should render the page title', () => {
    renderPage();
    expect(screen.getByText('Dashboard Executivo')).toBeInTheDocument();
  });

  it('should render all 4 KPI cards', () => {
    renderPage();
    expect(screen.getByTestId('kpi-cards')).toBeInTheDocument();
    expect(screen.getByText('Receita Mensal')).toBeInTheDocument();
    expect(screen.getByText('Acurácia Forecast')).toBeInTheDocument();
    expect(screen.getByText('Giro de Estoque')).toBeInTheDocument();
    expect(screen.getByText('Fill Rate (OTIF)')).toBeInTheDocument();
  });

  it('should render the revenue chart', () => {
    renderPage();
    expect(screen.getByTestId('revenue-chart')).toBeInTheDocument();
    expect(screen.getByText('Receita vs Forecast')).toBeInTheDocument();
  });

  it('should render the toggle for direct forecast', () => {
    renderPage();
    expect(screen.getByTestId('toggle-direct')).toBeInTheDocument();
  });

  it('should render the pareto chart', () => {
    renderPage();
    expect(screen.getByTestId('pareto-chart')).toBeInTheDocument();
    expect(screen.getByText('Análise Pareto ABC')).toBeInTheDocument();
  });

  it('should render stock coverage heatmap with items', () => {
    renderPage();
    expect(screen.getByTestId('stock-coverage-heatmap')).toBeInTheDocument();
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('SKU-002')).toBeInTheDocument();
  });

  it('should render the active alerts panel with count', () => {
    renderPage();
    expect(screen.getByTestId('active-alerts-panel')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // total alerts
    expect(screen.getByText('SKUs em Stockout')).toBeInTheDocument();
  });
});
