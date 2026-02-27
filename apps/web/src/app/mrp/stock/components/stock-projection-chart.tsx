'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBase } from '@/components/charts/chart-base';
import { getWeekStart } from '@/lib/mrp-utils';
import type { EChartsOption } from 'echarts';
import type { PlannedOrder, StockParams } from '@/types/mrp';

interface StockProjectionChartProps {
  readonly orders: readonly PlannedOrder[];
  readonly stockParams: StockParams | null;
  readonly produtoId: string;
}

/**
 * Stock Projection line chart with reference lines.
 *
 * Shows projected stock over the planning horizon with:
 * - Safety Stock (SS) as red dashed line
 * - Reorder Point (ROP) as orange dashed line
 * - Max stock as green dashed line
 * - Area below SS highlighted in red, between SS and ROP in yellow
 *
 * @see Story 3.12 — Stock Projection (AC-8 to AC-11)
 */
export function StockProjectionChart({
  orders,
  stockParams,
  produtoId,
}: StockProjectionChartProps) {
  const chartData = useMemo(() => {
    // Planned orders represent supply (receipts arriving).
    // We use dataLiberacao as the week for order release and
    // dataNecessidade as the need week. The projected stock starts
    // at the safety stock level (or 0) and is adjusted by planned receipts
    // vs gross consumption per period.
    //
    // Since we only have planned orders (MRP output), we model:
    // - Planned receipts: orders arriving in dataNecessidade (supply)
    // - Gross requirements: estimated from the dataNecessidade spread
    //   across the horizon. Each planned order exists because there IS
    //   a corresponding requirement — so net effect on stock is the
    //   timing difference between release and receipt.
    const weekMap = new Map<string, { plannedReceipts: number; grossRequirements: number }>();

    for (const order of orders) {
      if (order.produtoId !== produtoId) continue;

      // Receipt arrives at dataNecessidade (supply)
      const receiptWeek = getWeekStart(order.dataNecessidade).toISOString();
      const receiptEntry = weekMap.get(receiptWeek) ?? { plannedReceipts: 0, grossRequirements: 0 };
      weekMap.set(receiptWeek, {
        ...receiptEntry,
        plannedReceipts: receiptEntry.plannedReceipts + order.quantidade,
      });

      // Requirement originates at dataLiberacao (demand trigger)
      const requirementWeek = getWeekStart(order.dataLiberacao).toISOString();
      const reqEntry = weekMap.get(requirementWeek) ?? { plannedReceipts: 0, grossRequirements: 0 };
      weekMap.set(requirementWeek, {
        ...reqEntry,
        grossRequirements: reqEntry.grossRequirements + order.quantidade,
      });
    }

    const sortedWeeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

    const weekLabels: string[] = [];
    const projectedStock: number[] = [];
    // Start from safety stock as initial projected inventory level
    const initialStock = stockParams?.safetyStock ?? 0;
    let runningStock = initialStock;

    for (const [weekKey, data] of sortedWeeks) {
      const date = new Date(weekKey);
      weekLabels.push(
        date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      );
      // Projected stock = previous stock + receipts - requirements
      runningStock = runningStock + data.plannedReceipts - data.grossRequirements;
      projectedStock.push(runningStock);
    }

    return { weekLabels, projectedStock };
  }, [orders, produtoId, stockParams]);

  const ss = stockParams?.safetyStock ?? 0;
  const rop = stockParams?.reorderPoint ?? 0;
  const maxStock = stockParams?.estoqueMaximo ?? 0;

  const option = useMemo(() => {
    if (chartData.weekLabels.length === 0) {
      return {
        title: {
          text: 'Sem dados de projeção',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#9CA3AF', fontSize: 14 },
        },
      };
    }

    const ssLine = chartData.weekLabels.map(() => ss);
    const ropLine = chartData.weekLabels.map(() => rop);
    const maxLine = chartData.weekLabels.map(() => maxStock);

    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; marker: string }>;
          return items
            .map((item) => `${item.marker} ${item.seriesName}: ${item.value.toLocaleString('pt-BR')}`)
            .join('<br/>');
        },
      },
      legend: {
        data: ['Estoque Projetado', 'Estoque Segurança', 'Ponto Reposição', 'Estoque Máximo'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: chartData.weekLabels,
        axisLabel: { rotate: 45, fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Quantidade',
      },
      visualMap: [
        {
          show: false,
          type: 'piecewise' as const,
          seriesIndex: 0,
          pieces: [
            { lt: ss, color: 'rgba(239, 68, 68, 0.8)' },
            { gte: ss, lt: rop, color: 'rgba(245, 158, 11, 0.8)' },
            { gte: rop, color: '#3B82F6' },
          ],
        },
      ],
      series: [
        {
          name: 'Estoque Projetado',
          type: 'line' as const,
          data: chartData.projectedStock,
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.15)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
              ],
            },
          },
          markArea: {
            silent: true,
            data: [
              [
                { yAxis: 0, itemStyle: { color: 'rgba(239, 68, 68, 0.08)' } },
                { yAxis: ss },
              ],
              [
                { yAxis: ss, itemStyle: { color: 'rgba(245, 158, 11, 0.06)' } },
                { yAxis: rop },
              ],
            ],
          },
        },
        {
          name: 'Estoque Segurança',
          type: 'line' as const,
          data: ssLine,
          lineStyle: { type: 'dashed' as const, color: '#EF4444', width: 1 },
          itemStyle: { color: '#EF4444' },
          symbol: 'none',
        },
        {
          name: 'Ponto Reposição',
          type: 'line' as const,
          data: ropLine,
          lineStyle: { type: 'dashed' as const, color: '#F59E0B', width: 1 },
          itemStyle: { color: '#F59E0B' },
          symbol: 'none',
        },
        {
          name: 'Estoque Máximo',
          type: 'line' as const,
          data: maxLine,
          lineStyle: { type: 'dashed' as const, color: '#10B981', width: 1 },
          itemStyle: { color: '#10B981' },
          symbol: 'none',
        },
      ],
    };
  }, [chartData, ss, rop, maxStock]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projeção de Estoque</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBase option={option as EChartsOption} height="400px" />
      </CardContent>
    </Card>
  );
}

