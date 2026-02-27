'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBase } from '@/components/charts/chart-base';
import type { EChartsOption } from 'echarts';
import type { CapacityWeekRecord } from '@/types/mrp';

interface CapacityBarChartProps {
  readonly records: readonly CapacityWeekRecord[];
}

/**
 * Stacked bar chart: planned load vs available capacity per work center per week.
 *
 * Shows blue bars for available capacity and red bars for overload hours.
 *
 * @see Story 3.12 — Capacity Dashboard (AC-13)
 */
export function CapacityBarChart({ records }: CapacityBarChartProps) {
  const chartData = useMemo(() => {
    // Group by work center
    const wcMap = new Map<string, {
      readonly nome: string;
      readonly weeks: readonly CapacityWeekRecord[];
    }>();

    for (const rec of records) {
      const key = rec.centroTrabalhoId;
      const existing = wcMap.get(key);
      if (existing) {
        wcMap.set(key, { ...existing, weeks: [...existing.weeks, rec] });
      } else {
        wcMap.set(key, {
          nome: rec.centroTrabalho?.nome ?? rec.centroTrabalhoId.slice(0, 8),
          weeks: [rec],
        });
      }
    }

    // Get unique week labels
    const weekSet = new Set<string>();
    for (const rec of records) {
      weekSet.add(rec.periodStart);
    }
    const weekLabels = Array.from(weekSet)
      .sort()
      .map((w) =>
        new Date(w).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      );

    const weekKeys = Array.from(weekSet).sort();
    const workCenters = Array.from(wcMap.entries());

    return { weekLabels, weekKeys, workCenters };
  }, [records]);

  const option = useMemo(() => {
    if (chartData.workCenters.length === 0) {
      return {
        title: {
          text: 'Sem dados de capacidade',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#9CA3AF', fontSize: 14 },
        },
      };
    }

    // For each work center, create two series: planned load and available capacity
    // Displayed as grouped bars (not stacked) so both are visible side-by-side.
    const series: Record<string, unknown>[] = [];
    for (const [, wc] of chartData.workCenters) {
      // Build a lookup map for O(1) access
      const weekLookup = new Map(wc.weeks.map((w) => [w.periodStart, w]));

      const capacityData = chartData.weekKeys.map((weekKey) => {
        return weekLookup.get(weekKey)?.capacidadeDisponivelHoras ?? 0;
      });

      const loadData = chartData.weekKeys.map((weekKey) => {
        return weekLookup.get(weekKey)?.cargaPlanejadaHoras ?? 0;
      });

      series.push({
        name: `${wc.nome} — Capacidade`,
        type: 'bar',
        data: capacityData,
        itemStyle: { color: '#93C5FD' },
        barMaxWidth: 24,
        barGap: '10%',
      });

      series.push({
        name: `${wc.nome} — Carga Planejada`,
        type: 'bar',
        data: loadData.map((load, i) => ({
          value: load,
          itemStyle: {
            color: load > capacityData[i] ? '#FCA5A5' : '#86EFAC',
          },
        })),
        barMaxWidth: 24,
      });
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      legend: { bottom: 0, type: 'scroll' as const },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '4%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: chartData.weekLabels,
        axisLabel: { rotate: 45, fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Horas',
      },
      series,
    };
  }, [chartData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carga vs Capacidade por Centro de Trabalho</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBase option={option as EChartsOption} height="350px" />
      </CardContent>
    </Card>
  );
}
