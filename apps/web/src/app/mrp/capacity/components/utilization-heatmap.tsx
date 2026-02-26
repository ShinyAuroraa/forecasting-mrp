'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBase } from '@/components/charts/chart-base';
import type { CapacityWeekRecord } from '@/types/mrp';

interface UtilizationHeatmapProps {
  readonly records: readonly CapacityWeekRecord[];
}

/**
 * Weekly heatmap of capacity utilization per work center.
 *
 * Cells colored by utilization %:
 * - Green < 80%
 * - Yellow 80-100%
 * - Orange 100-110%
 * - Red > 110%
 *
 * @see Story 3.12 — Capacity Dashboard (AC-14)
 */
export function UtilizationHeatmap({ records }: UtilizationHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Get unique work centers and weeks
    const wcSet = new Map<string, string>();
    const weekSet = new Set<string>();

    for (const rec of records) {
      const wcName = rec.centroTrabalho?.nome ?? rec.centroTrabalhoId.slice(0, 8);
      wcSet.set(rec.centroTrabalhoId, wcName);
      weekSet.add(rec.periodStart);
    }

    const workCenters = Array.from(wcSet.values());
    const wcIdList = Array.from(wcSet.keys());
    const weekKeys = Array.from(weekSet).sort();
    const weekLabels = weekKeys.map((w) =>
      new Date(w).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    );

    // Build index maps for O(1) lookups instead of O(n) indexOf
    const weekIdxMap = new Map(weekKeys.map((k, i) => [k, i]));
    const wcIdxMap = new Map(wcIdList.map((k, i) => [k, i]));

    // Build heatmap data: [weekIdx, wcIdx, utilizacao]
    const data: [number, number, number][] = [];
    for (const rec of records) {
      const weekIdx = weekIdxMap.get(rec.periodStart);
      const wcIdx = wcIdxMap.get(rec.centroTrabalhoId);
      if (weekIdx !== undefined && wcIdx !== undefined) {
        data.push([weekIdx, wcIdx, Math.round(rec.utilizacaoPercentual)]);
      }
    }

    return { workCenters, weekLabels, data };
  }, [records]);

  const option = useMemo(() => {
    if (heatmapData.data.length === 0) {
      return {
        title: {
          text: 'Sem dados de utilização',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#9CA3AF', fontSize: 14 },
        },
      };
    }

    return {
      tooltip: {
        position: 'top' as const,
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number] };
          const week = heatmapData.weekLabels[p.value[0]];
          const wc = heatmapData.workCenters[p.value[1]];
          return `${wc}<br/>Semana ${week}<br/>Utilização: ${p.value[2]}%`;
        },
      },
      grid: {
        left: '15%',
        right: '10%',
        bottom: '15%',
        top: '4%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: heatmapData.weekLabels,
        splitArea: { show: true },
        axisLabel: { rotate: 45, fontSize: 11 },
      },
      yAxis: {
        type: 'category' as const,
        data: heatmapData.workCenters,
        splitArea: { show: true },
        axisLabel: { fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: 150,
        calculable: true,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#86EFAC', '#FDE047', '#FDBA74', '#FCA5A5'],
        },
        pieces: [
          { lt: 80, label: '< 80%', color: '#86EFAC' },
          { gte: 80, lt: 100, label: '80-100%', color: '#FDE047' },
          { gte: 100, lt: 110, label: '100-110%', color: '#FDBA74' },
          { gte: 110, label: '> 110%', color: '#FCA5A5' },
        ],
        type: 'piecewise' as const,
      },
      series: [
        {
          type: 'heatmap' as const,
          data: heatmapData.data,
          label: {
            show: true,
            formatter: (params: unknown) => {
              const p = params as { value: [number, number, number] };
              return `${p.value[2]}%`;
            },
            fontSize: 10,
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.3)' },
          },
        },
      ],
    };
  }, [heatmapData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Heatmap de Utilização Semanal</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBase
          option={option}
          height={`${Math.max(250, heatmapData.workCenters.length * 40 + 100)}px`}
        />
      </CardContent>
    </Card>
  );
}
