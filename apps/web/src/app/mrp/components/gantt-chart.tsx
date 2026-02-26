'use client';

import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBase } from '@/components/charts/chart-base';
import { escapeHtml } from '@/lib/mrp-utils';
import type { PlannedOrder, GanttBar } from '@/types/mrp';

interface GanttChartProps {
  readonly orders: readonly PlannedOrder[];
}

const COMPRA_COLOR = '#3B82F6';
const PRODUCAO_COLOR = '#10B981';

/**
 * MRP Gantt timeline chart using ECharts custom series.
 *
 * Displays planned orders as horizontal bars:
 * - Blue (#3B82F6) for COMPRA (purchase) orders
 * - Green (#10B981) for PRODUCAO (production) orders
 *
 * @see Story 3.12 — MRP Gantt (AC-1 to AC-4)
 */
export function GanttChart({ orders }: GanttChartProps) {
  const ganttData = useMemo(() => {
    const bars: GanttBar[] = orders.map((order) => ({
      orderId: order.id,
      produtoCodigo: order.produto?.codigo ?? order.produtoId.slice(0, 8),
      produtoDescricao: order.produto?.descricao ?? '',
      tipo: order.tipo,
      quantidade: order.quantidade,
      dataLiberacao: order.dataLiberacao,
      dataNecessidade: order.dataNecessidade,
      custoEstimado: order.custoEstimado,
      prioridade: order.prioridade,
      fornecedorNome: order.fornecedor?.razaoSocial ?? null,
      centroTrabalhoNome: order.centroTrabalho?.nome ?? null,
    }));

    const skuSet = new Set<string>();
    for (const bar of bars) {
      skuSet.add(bar.produtoCodigo);
    }
    const skuList = Array.from(skuSet).sort();

    return { bars, skuList };
  }, [orders]);

  const formatTooltip = useCallback((params: unknown) => {
    const p = params as { data: { value: unknown[] } };
    const bar = p.data.value[3] as GanttBar;
    const start = new Date(bar.dataLiberacao).toLocaleDateString('pt-BR');
    const end = new Date(bar.dataNecessidade).toLocaleDateString('pt-BR');
    const tipoLabel = bar.tipo === 'COMPRA' ? 'Compra' : 'Produção';
    const custoLabel = bar.custoEstimado != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bar.custoEstimado)
      : '—';
    const destino = bar.tipo === 'COMPRA'
      ? `Fornecedor: ${escapeHtml(bar.fornecedorNome ?? '—')}`
      : `Centro: ${escapeHtml(bar.centroTrabalhoNome ?? '—')}`;

    return [
      `<strong>${escapeHtml(bar.produtoCodigo)}</strong> — ${escapeHtml(bar.produtoDescricao)}`,
      `Tipo: ${tipoLabel}`,
      `Qtd: ${bar.quantidade.toLocaleString('pt-BR')}`,
      `Período: ${start} → ${end}`,
      destino,
      `Custo: ${custoLabel}`,
      `Prioridade: ${bar.prioridade}`,
    ].join('<br/>');
  }, []);

  const option = useMemo(() => {
    if (ganttData.bars.length === 0) {
      return {
        title: { text: 'Sem ordens planejadas', left: 'center', top: 'middle', textStyle: { color: '#9CA3AF', fontSize: 14 } },
      };
    }

    const chartData = ganttData.bars.map((bar) => ({
      value: [
        new Date(bar.dataLiberacao).getTime(),
        new Date(bar.dataNecessidade).getTime(),
        ganttData.skuList.indexOf(bar.produtoCodigo),
        bar,
      ],
      itemStyle: {
        color: bar.tipo === 'COMPRA' ? COMPRA_COLOR : PRODUCAO_COLOR,
      },
    }));

    return {
      tooltip: {
        formatter: formatTooltip,
      },
      legend: {
        data: [
          { name: 'Compra', itemStyle: { color: COMPRA_COLOR } },
          { name: 'Produção', itemStyle: { color: PRODUCAO_COLOR } },
        ],
        bottom: 0,
      },
      grid: {
        left: '12%',
        right: '4%',
        bottom: '12%',
        top: '4%',
        containLabel: true,
      },
      xAxis: {
        type: 'time' as const,
        axisLabel: {
          formatter: (val: number) =>
            new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'category' as const,
        data: ganttData.skuList,
        axisLabel: { fontSize: 10 },
        inverse: true,
      },
      series: [
        {
          name: 'Compra',
          type: 'custom' as const,
          renderItem: (params: unknown, api: unknown) => {
            const a = api as {
              value: (idx: number) => number;
              coord: (val: [number, number]) => [number, number];
              size: (val: [number, number]) => [number, number];
              style: (extra?: Record<string, unknown>) => Record<string, unknown>;
            };
            const startCoord = a.coord([a.value(0), a.value(2)]);
            const endCoord = a.coord([a.value(1), a.value(2)]);
            const barHeight = a.size([0, 1])[1] * 0.6;
            return {
              type: 'rect',
              shape: {
                x: startCoord[0],
                y: startCoord[1] - barHeight / 2,
                width: Math.max(endCoord[0] - startCoord[0], 4),
                height: barHeight,
              },
              style: a.style(),
            };
          },
          encode: { x: [0, 1], y: 2 },
          data: chartData,
        },
      ],
    };
  }, [ganttData, formatTooltip]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gantt — Ordens Planejadas ({orders.length})</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: COMPRA_COLOR }} />
              Compra
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: PRODUCAO_COLOR }} />
              Produção
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartBase
          option={option}
          height={`${Math.max(300, ganttData.skuList.length * 28 + 80)}px`}
        />
      </CardContent>
    </Card>
  );
}

