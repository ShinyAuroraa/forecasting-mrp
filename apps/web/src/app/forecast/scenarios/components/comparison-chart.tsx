'use client';

import { ChartBase } from '@/components/charts/chart-base';
import type { EChartsOption } from 'echarts';
import type { ForecastComparisonPoint } from '@/types/scenario';

interface ComparisonChartProps {
  readonly points: readonly ForecastComparisonPoint[];
}

/**
 * Side-by-side comparison chart — baseline vs scenario forecast.
 *
 * @see Story 4.9 — AC-6, AC-17
 */
export function ComparisonChart({ points }: ComparisonChartProps) {
  const periods = points.map((p) => p.period);
  const baseline = points.map((p) => p.baselineRevenue);
  const scenario = points.map((p) => p.scenarioRevenue);

  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { top: 40, bottom: 30, left: 80, right: 20 },
    xAxis: { type: 'category', data: periods },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (val: number) =>
          new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(val),
      },
    },
    series: [
      {
        name: 'Baseline',
        type: 'line',
        data: baseline,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 2 },
      },
      {
        name: 'Cenário',
        type: 'line',
        data: scenario,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 2, type: 'dashed' },
      },
    ],
  };

  return (
    <div data-testid="comparison-chart" className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Baseline vs Cenário</h3>
      <ChartBase option={option} height="350px" />
    </div>
  );
}
