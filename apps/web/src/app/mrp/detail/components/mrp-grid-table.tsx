'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { getWeekStart, formatWeekLabel } from '@/lib/mrp-utils';
import type { PlannedOrder, StockParams } from '@/types/mrp';

interface MrpGridTableProps {
  readonly orders: readonly PlannedOrder[];
  readonly stockParams: StockParams | null;
  readonly produtoId: string;
}

interface PeriodColumn {
  readonly label: string;
  readonly periodStart: string;
  readonly grossRequirement: number;
  readonly scheduledReceipts: number;
  readonly projectedStock: number;
  readonly netRequirement: number;
  readonly plannedOrderReceipts: number;
}

const ROW_LABELS = [
  'Necessidade Bruta',
  'Recebimentos Programados',
  'Estoque Projetado',
  'Necessidade Líquida',
  'Ordens Planejadas',
] as const;

/**
 * MRP grid table for a selected SKU.
 *
 * Shows time-phased grid: rows = MRP row types, columns = weekly periods.
 * Color-coded cells: red for negative stock, orange for below safety stock.
 *
 * @see Story 3.12 — MRP Detail (AC-6, AC-7)
 */
export function MrpGridTable({
  orders,
  stockParams,
  produtoId,
}: MrpGridTableProps) {
  const periods = useMemo(() => {
    const weekMap = new Map<string, PeriodColumn>();

    // Group orders by week (using dataLiberacao as period key)
    for (const order of orders) {
      if (order.produtoId !== produtoId) continue;

      const weekStart = getWeekStart(order.dataNecessidade);
      const key = weekStart.toISOString();

      const existing = weekMap.get(key);
      const qty = order.quantidade;

      if (existing) {
        const isReceipt = order.status !== 'PLANEJADA';
        weekMap.set(key, {
          ...existing,
          grossRequirement: existing.grossRequirement + qty,
          scheduledReceipts: isReceipt
            ? existing.scheduledReceipts + qty
            : existing.scheduledReceipts,
          plannedOrderReceipts: !isReceipt
            ? existing.plannedOrderReceipts + qty
            : existing.plannedOrderReceipts,
        });
      } else {
        const isReceipt = order.status !== 'PLANEJADA';
        weekMap.set(key, {
          label: formatWeekLabel(weekStart),
          periodStart: key,
          grossRequirement: qty,
          scheduledReceipts: isReceipt ? qty : 0,
          projectedStock: 0,
          netRequirement: 0,
          plannedOrderReceipts: !isReceipt ? qty : 0,
        });
      }
    }

    // Sort by period start
    const sorted = Array.from(weekMap.values()).sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    );

    // Calculate projected stock and net requirements
    const ss = stockParams?.safetyStock ?? 0;
    let runningStock = 0;

    return sorted.map((period) => {
      const projectedStock =
        runningStock +
        period.scheduledReceipts +
        period.plannedOrderReceipts -
        period.grossRequirement;
      const netRequirement = Math.max(0, ss - projectedStock + period.grossRequirement - period.scheduledReceipts);
      runningStock = projectedStock;

      return {
        ...period,
        projectedStock,
        netRequirement,
      };
    });
  }, [orders, stockParams, produtoId]);

  const safetyStock = stockParams?.safetyStock ?? 0;

  if (periods.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-sm text-gray-500">
            Nenhum dado MRP disponível para este SKU.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade MRP — {periods.length} períodos</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-[180px] bg-white">
                Período
              </TableHead>
              {periods.map((p) => (
                <TableHead key={p.periodStart} className="min-w-[90px] text-center">
                  {p.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROW_LABELS.map((rowLabel, rowIdx) => (
              <TableRow key={rowLabel}>
                <TableCell className="sticky left-0 z-10 bg-white font-medium">
                  {rowLabel}
                </TableCell>
                {periods.map((p) => {
                  const value = getRowValue(p, rowIdx);
                  const cellClass = getCellClass(rowIdx, value, safetyStock);

                  return (
                    <TableCell
                      key={p.periodStart}
                      className={`text-center ${cellClass}`}
                    >
                      {value.toLocaleString('pt-BR')}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────

function getRowValue(period: PeriodColumn, rowIdx: number): number {
  switch (rowIdx) {
    case 0: return period.grossRequirement;
    case 1: return period.scheduledReceipts;
    case 2: return period.projectedStock;
    case 3: return period.netRequirement;
    case 4: return period.plannedOrderReceipts;
    default: return 0;
  }
}

function getCellClass(
  rowIdx: number,
  value: number,
  safetyStock: number,
): string {
  // Only color-code the "Projected Stock" row (index 2)
  if (rowIdx !== 2) return '';
  if (value < 0) return 'bg-red-100 text-red-700 font-medium';
  if (value < safetyStock) return 'bg-orange-100 text-orange-700';
  return '';
}
