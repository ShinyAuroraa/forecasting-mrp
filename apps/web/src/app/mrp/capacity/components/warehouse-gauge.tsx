'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBase } from '@/components/charts/chart-base';
import type { StorageDepositoRecord } from '@/types/mrp';

interface WarehouseGaugeProps {
  readonly deposito: StorageDepositoRecord;
}

/**
 * Circular gauge showing current/projected storage utilization per deposito.
 *
 * Uses the latest weekly result to display current utilization %.
 *
 * @see Story 3.12 — Capacity Dashboard (AC-15)
 */
export function WarehouseGauge({ deposito }: WarehouseGaugeProps) {
  const latestResult = useMemo(() => {
    if (deposito.weeklyResults.length === 0) return null;
    const sorted = [...deposito.weeklyResults].sort(
      (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
    );
    return sorted[0];
  }, [deposito.weeklyResults]);

  const utilization = latestResult?.utilizationPercentual ?? 0;

  const option = useMemo(() => {
    const gaugeColor: [number, string][] =
      utilization <= 90
        ? [[utilization / 100, '#10B981'], [1, '#E5E7EB']]
        : utilization <= 95
          ? [[utilization / 100, '#F59E0B'], [1, '#E5E7EB']]
          : [[utilization / 100, '#EF4444'], [1, '#E5E7EB']];

    return {
      series: [
        {
          type: 'gauge' as const,
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 20,
              color: gaugeColor,
            },
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '55%',
            width: 8,
            itemStyle: { color: 'auto' },
          },
          axisTick: { distance: -20, length: 6, lineStyle: { color: '#999', width: 1 } },
          splitLine: { distance: -24, length: 16, lineStyle: { color: '#999', width: 2 } },
          axisLabel: { distance: -8, color: '#666', fontSize: 10 },
          detail: {
            valueAnimation: true,
            formatter: '{value}%',
            color: 'auto',
            fontSize: 18,
            offsetCenter: [0, '70%'],
          },
          data: [{ value: Math.round(utilization) }],
          title: {
            show: true,
            offsetCenter: [0, '90%'],
            fontSize: 12,
            color: '#666',
          },
        },
      ],
    };
  }, [utilization]);

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">
          {deposito.nome} ({deposito.codigo})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBase option={option} height="200px" />
        {latestResult && (
          <p className="text-center text-xs text-gray-500">
            {latestResult.projectedVolumeM3.toFixed(1)} m³ / {latestResult.capacityM3.toFixed(1)} m³
          </p>
        )}
      </CardContent>
    </Card>
  );
}
