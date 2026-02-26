'use client';

import { ChartBase } from '@/components/charts/chart-base';
import type { EChartsOption } from 'echarts';
import type { ParetoData } from '@/types/dashboard';

interface ParetoChartProps {
  readonly data: ParetoData;
  readonly onClassClick?: (classeAbc: string) => void;
}

const CLASS_COLORS: Record<string, string> = {
  A: '#3b82f6',
  B: '#8b5cf6',
  C: '#94a3b8',
};

/**
 * Pareto / ABC Analysis chart — bar + cumulative line.
 *
 * @see Story 4.8 — AC-9, AC-10
 */
export function ParetoChart({ data, onClassClick }: ParetoChartProps) {
  const categories = data.items.map((i) => `Classe ${i.classeAbc}`);
  const revenues = data.items.map((i) => i.revenuePercent);
  const cumulative = data.items.map((i) => i.cumulativePercent);
  const colors = data.items.map((i) => CLASS_COLORS[i.classeAbc] ?? '#94a3b8');

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const arr = params as Array<{ seriesName: string; value: number; axisValue: string; marker: string }>;
        if (!Array.isArray(arr) || arr.length === 0) return '';
        const item = data.items.find((i) => `Classe ${i.classeAbc}` === arr[0].axisValue);
        let tip = `<strong>${arr[0].axisValue}</strong><br/>`;
        tip += `SKUs: ${item?.skuCount ?? 0}<br/>`;
        for (const s of arr) {
          tip += `${s.marker} ${s.seriesName}: ${s.value.toFixed(1)}%<br/>`;
        }
        return tip;
      },
    },
    legend: { top: 0 },
    grid: { top: 40, bottom: 30, left: 60, right: 60 },
    xAxis: { type: 'category', data: categories },
    yAxis: [
      { type: 'value', name: 'Receita %', max: 100, axisLabel: { formatter: '{value}%' } },
      { type: 'value', name: 'Acumulado %', max: 100, axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      {
        name: '% Receita',
        type: 'bar',
        data: revenues.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i] },
        })),
        yAxisIndex: 0,
      },
      {
        name: '% Acumulado',
        type: 'line',
        data: cumulative,
        yAxisIndex: 1,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 8,
      },
    ],
  };

  const handleEvents = onClassClick
    ? {
        click: (params: unknown) => {
          const p = params as { componentType: string; dataIndex: number };
          if (p.componentType === 'series' && data.items[p.dataIndex]) {
            onClassClick(data.items[p.dataIndex].classeAbc);
          }
        },
      }
    : undefined;

  return (
    <div data-testid="pareto-chart" className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Análise Pareto ABC</h3>
      <ChartBase option={option} height="350px" onEvents={handleEvents} />
    </div>
  );
}
