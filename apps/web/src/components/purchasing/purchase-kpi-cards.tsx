'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBRL } from '@/lib/format';
import type { PurchaseTotals } from '@/types/purchasing';

interface PurchaseKpiCardsProps {
  readonly totals: PurchaseTotals;
}

/**
 * KPI cards for the Purchasing Panel.
 *
 * Displays 4 cards:
 * 1. Total Purchases (R$)
 * 2. Total Orders
 * 3. Urgent Orders
 * 4. Average Lead Time (days)
 *
 * @see Story 3.11 — Purchasing Panel (AC-11)
 */
export function PurchaseKpiCards({ totals }: PurchaseKpiCardsProps) {
  const kpis = [
    {
      title: 'Total em Compras',
      value: formatBRL(totals.totalPurchaseCost),
      className: 'text-blue-600',
    },
    {
      title: 'Total de Ordens',
      value: String(totals.totalOrders),
      className: 'text-gray-900',
    },
    {
      title: 'Ordens Urgentes',
      value: String(totals.urgentOrders),
      className: totals.urgentOrders > 0 ? 'text-red-600' : 'text-gray-900',
    },
    {
      title: 'Lead Time Médio',
      value: `${totals.averageLeadTimeDays} dias`,
      className: 'text-gray-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {kpi.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${kpi.className}`}>
              {kpi.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
