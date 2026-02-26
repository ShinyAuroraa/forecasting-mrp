/**
 * @jest-environment jsdom
 *
 * Basic render tests for PurchaseKpiCards.
 *
 * Prerequisites (devDependencies):
 *   @testing-library/react, @testing-library/jest-dom, jest, jest-environment-jsdom
 *
 * @see Story 3.11 — Purchasing Panel (AC-17)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PurchaseKpiCards } from '../purchase-kpi-cards';
import type { PurchaseTotals } from '@/types/purchasing';

const defaultTotals: PurchaseTotals = {
  totalPurchaseCost: 125000.5,
  totalOrders: 42,
  urgentOrders: 7,
  averageLeadTimeDays: 14.5,
};

describe('PurchaseKpiCards', () => {
  it('should render all 4 KPI cards', () => {
    render(<PurchaseKpiCards totals={defaultTotals} />);

    expect(screen.getByText('Total em Compras')).toBeInTheDocument();
    expect(screen.getByText('Total de Ordens')).toBeInTheDocument();
    expect(screen.getByText('Ordens Urgentes')).toBeInTheDocument();
    expect(screen.getByText('Lead Time Médio')).toBeInTheDocument();
  });

  it('should display total orders count', () => {
    render(<PurchaseKpiCards totals={defaultTotals} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should display urgent orders count', () => {
    render(<PurchaseKpiCards totals={defaultTotals} />);

    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('should display average lead time with "dias" suffix', () => {
    render(<PurchaseKpiCards totals={defaultTotals} />);

    expect(screen.getByText('14.5 dias')).toBeInTheDocument();
  });

  it('should apply red text when urgentOrders > 0', () => {
    const { container } = render(
      <PurchaseKpiCards totals={{ ...defaultTotals, urgentOrders: 5 }} />,
    );

    const urgentValue = container.querySelector('.text-red-600');
    expect(urgentValue).toBeInTheDocument();
  });

  it('should not apply red text when urgentOrders is 0', () => {
    const { container } = render(
      <PurchaseKpiCards totals={{ ...defaultTotals, urgentOrders: 0 }} />,
    );

    const urgentCards = container.querySelectorAll('.text-red-600');
    expect(urgentCards).toHaveLength(0);
  });
});
