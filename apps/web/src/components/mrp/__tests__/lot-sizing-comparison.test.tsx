import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCompareData = {
  produtoId: 'prod-1',
  methods: [
    { method: 'L4L', totalCost: 400, orderingCost: 400, holdingCost: 0, numberOfOrders: 4, avgOrderQty: 68 },
    { method: 'EOQ', totalCost: 350, orderingCost: 200, holdingCost: 150, numberOfOrders: 2, avgOrderQty: 135 },
    { method: 'SILVER_MEAL', totalCost: 330, orderingCost: 200, holdingCost: 130, numberOfOrders: 2, avgOrderQty: 135 },
    { method: 'WAGNER_WHITIN', totalCost: 320, orderingCost: 200, holdingCost: 120, numberOfOrders: 2, avgOrderQty: 135 },
  ],
  recommendation: 'WAGNER_WHITIN',
};

jest.mock('@/hooks/use-lot-sizing-compare', () => ({
  useLotSizingCompare: (produtoId: string | null) => ({
    data: produtoId ? mockCompareData : undefined,
    isLoading: false,
    error: null,
  }),
}));

import { LotSizingComparison } from '../lot-sizing-comparison';

function renderComponent(produtoId: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LotSizingComparison produtoId={produtoId} />
    </QueryClientProvider>,
  );
}

describe('LotSizingComparison', () => {
  it('should show placeholder when no product selected', () => {
    renderComponent(null);
    expect(screen.getByText(/selecione um produto/i)).toBeInTheDocument();
  });

  it('should render all 4 method rows when product selected', () => {
    renderComponent('prod-1');

    expect(screen.getByText('Lot-for-Lot')).toBeInTheDocument();
    expect(screen.getByText('Lote Econômico (EOQ)')).toBeInTheDocument();
    expect(screen.getByText('Silver-Meal')).toBeInTheDocument();
    expect(screen.getByText(/Wagner-Whitin/)).toBeInTheDocument();
  });

  it('should display "Recomendado" badge on Wagner-Whitin', () => {
    renderComponent('prod-1');
    expect(screen.getByText('Recomendado')).toBeInTheDocument();
  });

  it('should display cost values for each method', () => {
    renderComponent('prod-1');

    // Wagner-Whitin total cost 320
    expect(screen.getByText(/320,00/)).toBeInTheDocument();
    // L4L total cost 400
    expect(screen.getByText(/400,00/)).toBeInTheDocument();
  });

  it('should show table header labels', () => {
    renderComponent('prod-1');

    expect(screen.getByText('Método')).toBeInTheDocument();
    expect(screen.getByText('Custo Total')).toBeInTheDocument();
    expect(screen.getByText('Nº Pedidos')).toBeInTheDocument();
  });

  it('should display the comparison title', () => {
    renderComponent('prod-1');
    expect(screen.getByText('Comparação de Lotificação')).toBeInTheDocument();
  });
});
