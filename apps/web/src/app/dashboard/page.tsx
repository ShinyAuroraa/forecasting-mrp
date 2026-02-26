'use client';

import { useState } from 'react';
import {
  useDashboardKpis,
  useRevenueChart,
  usePareto,
  useStockCoverage,
  useActiveAlerts,
} from '@/hooks/use-dashboard';
import { KpiCards } from './components/kpi-cards';
import { RevenueChart } from './components/revenue-chart';
import { ParetoChart } from './components/pareto-chart';
import { StockCoverageHeatmap } from './components/stock-coverage-heatmap';
import { ActiveAlertsPanel } from './components/active-alerts-panel';
import { ExportButton } from '@/components/export/export-dialog';

/**
 * Executive BI Dashboard — main landing page.
 *
 * @see Story 4.8 — AC-20, AC-21, AC-22
 */
export default function DashboardPage() {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const kpis = useDashboardKpis();
  const revenueChart = useRevenueChart();
  const pareto = usePareto();
  const stockCoverage = useStockCoverage();
  const alerts = useActiveAlerts();

  const isLoading =
    kpis.isLoading || revenueChart.isLoading || pareto.isLoading || stockCoverage.isLoading || alerts.isLoading;
  const hasError =
    kpis.isError || revenueChart.isError || pareto.isError || stockCoverage.isError || alerts.isError;

  if (isLoading) {
    return (
      <div data-testid="dashboard-loading" className="flex min-h-[400px] items-center justify-center">
        <div className="text-gray-400">Carregando dashboard...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div data-testid="dashboard-error" className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600">Erro ao carregar o dashboard</p>
          <p className="mt-1 text-sm text-gray-500">Verifique a conexão e tente novamente.</p>
        </div>
      </div>
    );
  }

  // Filter stock coverage by selected ABC class
  const filteredCoverage = stockCoverage.data
    ? {
        items: selectedClass
          ? stockCoverage.data.items.filter((i) => i.classeAbc === selectedClass)
          : stockCoverage.data.items,
      }
    : undefined;

  return (
    <div data-testid="dashboard-page" className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Dashboard Executivo</h1>
          <ExportButton type="EXECUTIVE_DASHBOARD" />
        </div>
        {selectedClass && (
          <button
            className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
            onClick={() => setSelectedClass(null)}
          >
            Limpar filtro: Classe {selectedClass}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {kpis.data && <KpiCards data={kpis.data} />}

      {/* Revenue Chart */}
      {revenueChart.data && <RevenueChart data={revenueChart.data} />}

      {/* Pareto + Alerts side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {pareto.data && (
            <ParetoChart
              data={pareto.data}
              onClassClick={(cls) => setSelectedClass(cls === selectedClass ? null : cls)}
            />
          )}
        </div>
        <div>{alerts.data && <ActiveAlertsPanel data={alerts.data} />}</div>
      </div>

      {/* Stock Coverage Heatmap */}
      {filteredCoverage && <StockCoverageHeatmap data={filteredCoverage} />}
    </div>
  );
}
