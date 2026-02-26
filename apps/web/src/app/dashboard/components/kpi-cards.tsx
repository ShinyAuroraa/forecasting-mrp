'use client';

import type { DashboardKpis, KpiCard } from '@/types/dashboard';
import { VARIATION_ICONS } from '@/types/dashboard';

interface KpiCardsProps {
  readonly data: DashboardKpis;
}

function formatValue(card: KpiCard): string {
  if (card.unit === 'BRL') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value);
  }
  if (card.unit === '%') {
    return `${card.value.toFixed(1)}%`;
  }
  if (card.unit === 'x') {
    return `${card.value.toFixed(2)}x`;
  }
  return String(card.value);
}

function variationColor(direction: string): string {
  if (direction === 'up') return 'text-green-600';
  if (direction === 'down') return 'text-red-600';
  return 'text-gray-400';
}

function SingleKpiCard({ card }: { readonly card: KpiCard }) {
  return (
    <div
      data-testid={`kpi-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
      className="rounded-xl border bg-white p-6 shadow-sm"
    >
      <p className="text-sm text-gray-500">{card.label}</p>
      <p className="mt-1 text-2xl font-bold">{formatValue(card)}</p>
      <p className={`mt-1 text-sm ${variationColor(card.variation.direction)}`}>
        {VARIATION_ICONS[card.variation.direction]}{' '}
        {card.variation.percent !== 0 ? `${card.variation.percent > 0 ? '+' : ''}${card.variation.percent}%` : '—'}
      </p>
    </div>
  );
}

/**
 * KPI Cards grid — 4 cards: revenue, accuracy, turnover, fill rate.
 *
 * @see Story 4.8 — AC-1, AC-2, AC-3, AC-4
 */
export function KpiCards({ data }: KpiCardsProps) {
  return (
    <div data-testid="kpi-cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SingleKpiCard card={data.monthlyRevenue} />
      <SingleKpiCard card={data.forecastAccuracy} />
      <SingleKpiCard card={data.inventoryTurnover} />
      <SingleKpiCard card={data.fillRate} />
    </div>
  );
}
