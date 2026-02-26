'use client';

import { useState } from 'react';
import { ChartBase } from '@/components/charts/chart-base';
import type { EChartsOption } from 'echarts';
import type { RevenueChartData, DivergenceFlag } from '@/types/dashboard';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RevenueChartProps {
  readonly data: RevenueChartData;
}

/**
 * Revenue vs Forecast chart — 12mo actual + 3mo projection with P10-P90 bands.
 *
 * @see Story 4.8 — AC-5, AC-6, AC-7, AC-8
 */
export function RevenueChart({ data }: RevenueChartProps) {
  const [showDirect, setShowDirect] = useState(true);

  const periods = data.points.map((p) => p.period);
  const actuals = data.points.map((p) => p.actual);
  const forecastIndirect = data.points.map((p) => p.forecastIndirect);
  const forecastDirect = data.points.map((p) => p.forecastDirect);
  const p10 = data.points.map((p) => p.p10);
  const p90 = data.points.map((p) => p.p90);

  // P10-P90 band as area between
  const bandLow = data.points.map((p) => p.p10);
  const bandHigh = data.points.map((p) =>
    p.p90 !== null && p.p10 !== null ? p.p90 - p.p10 : null,
  );

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const arr = params as Array<{ seriesName: string; value: number | null; marker: string; axisValue: string }>;
        if (!Array.isArray(arr) || arr.length === 0) return '';
        let tip = `<strong>${arr[0].axisValue}</strong><br/>`;
        for (const s of arr) {
          if (s.value != null && s.seriesName !== 'P10-P90 Base') {
            tip += `${s.marker} ${s.seriesName}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.value)}<br/>`;
          }
        }
        // Add divergence flag if present
        const flag = data.divergenceFlags.find((f) => f.period === arr[0].axisValue);
        if (flag) {
          tip += `<br/><span style="color:#f97316">⚠ ${escapeHtml(flag.message)}</span>`;
        }
        return tip;
      },
    },
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
        name: 'Receita Real',
        type: 'line',
        data: actuals,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 2 },
        connectNulls: false,
      },
      {
        name: 'Forecast Indireto',
        type: 'line',
        data: forecastIndirect,
        itemStyle: { color: '#8b5cf6' },
        lineStyle: { width: 2, type: 'dashed' },
        connectNulls: false,
      },
      ...(showDirect
        ? [
            {
              name: 'Forecast Direto (TFT)',
              type: 'line' as const,
              data: forecastDirect,
              itemStyle: { color: '#ec4899' },
              lineStyle: { width: 2, type: 'dotted' as const },
              connectNulls: false,
            },
          ]
        : []),
      {
        name: 'P10-P90 Base',
        type: 'line',
        data: bandLow,
        stack: 'confidence',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        symbol: 'none',
      },
      {
        name: 'P10-P90',
        type: 'line',
        data: bandHigh,
        stack: 'confidence',
        lineStyle: { opacity: 0 },
        areaStyle: { color: '#8b5cf620', opacity: 0.3 },
        symbol: 'none',
      },
    ],
    // Mark divergence flags
    ...(data.divergenceFlags.length > 0
      ? {
          markPoint: {
            data: data.divergenceFlags.map((f: DivergenceFlag) => ({
              coord: [f.period, 0],
              symbol: 'triangle',
              symbolSize: 12,
              itemStyle: { color: '#f97316' },
            })),
          },
        }
      : {}),
  };

  return (
    <div data-testid="revenue-chart" className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Receita vs Forecast</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDirect}
            onChange={(e) => setShowDirect(e.target.checked)}
            data-testid="toggle-direct"
          />
          Mostrar Forecast Direto (TFT)
        </label>
      </div>
      <ChartBase option={option} height="400px" />
      {data.divergenceFlags.length > 0 && (
        <div data-testid="divergence-flags" className="mt-2 space-y-1">
          {data.divergenceFlags.map((f) => (
            <p key={f.period} className="text-sm text-orange-600">
              ⚠ {f.period}: {f.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
