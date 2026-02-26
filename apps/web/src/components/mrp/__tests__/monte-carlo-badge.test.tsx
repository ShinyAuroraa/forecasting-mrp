import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMutate = jest.fn();
let mockData: unknown = null;
let mockIsPending = false;
let mockError: Error | null = null;

jest.mock('@/hooks/use-monte-carlo', () => ({
  useMonteCarloSimulation: () => ({
    mutate: mockMutate,
    data: mockData,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { MonteCarloSimulation } from '../monte-carlo-badge';

function renderComponent(produtoId: string | null, metodoCalculo?: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MonteCarloSimulation produtoId={produtoId} metodoCalculo={metodoCalculo} />
    </QueryClientProvider>,
  );
}

describe('MonteCarloSimulation', () => {
  beforeEach(() => {
    mockData = null;
    mockIsPending = false;
    mockError = null;
    mockMutate.mockClear();
  });

  it('should display title and simulate button', () => {
    renderComponent('prod-1');
    expect(screen.getByText('Simulação Monte Carlo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /simular/i })).toBeInTheDocument();
  });

  it('should show Monte Carlo badge when metodoCalculo is MONTE_CARLO', () => {
    renderComponent('prod-1', 'MONTE_CARLO');
    expect(screen.getByText('Monte Carlo')).toBeInTheDocument();
  });

  it('should not show Monte Carlo badge when metodoCalculo is not MONTE_CARLO', () => {
    renderComponent('prod-1', 'FORMULA_CLASSICA');
    expect(screen.queryByText('Monte Carlo')).not.toBeInTheDocument();
  });

  it('should call mutate with produtoId when Simular is clicked', () => {
    renderComponent('prod-1');
    fireEvent.click(screen.getByRole('button', { name: /simular/i }));
    expect(mockMutate).toHaveBeenCalledWith({ produtoId: 'prod-1' });
  });

  it('should disable button when no produtoId', () => {
    renderComponent(null);
    const button = screen.getByRole('button', { name: /simular/i });
    expect(button).toBeDisabled();
  });

  it('should show result metrics when simulation completes', () => {
    mockData = {
      safetyStock: 42.5,
      iterations: 10000,
      meanDemandOverLt: 300.1234,
      confidenceInterval: { p5: 200.5, p95: 450.8 },
      histogram: [
        { rangeMin: 200, rangeMax: 225, count: 500 },
        { rangeMin: 225, rangeMax: 250, count: 1500 },
        { rangeMin: 250, rangeMax: 275, count: 3000 },
        { rangeMin: 275, rangeMax: 300, count: 3000 },
        { rangeMin: 300, rangeMax: 325, count: 2000 },
      ],
    };

    renderComponent('prod-1', 'MONTE_CARLO');

    expect(screen.getByText('Estoque Segurança')).toBeInTheDocument();
    expect(screen.getByText('Demanda Média (LT)')).toBeInTheDocument();
    expect(screen.getByText('IC 90% (P5)')).toBeInTheDocument();
    expect(screen.getByText('IC 90% (P95)')).toBeInTheDocument();
    expect(screen.getByText('Distribuição de Demanda no Lead Time')).toBeInTheDocument();
  });

  it('should display iteration count', () => {
    mockData = {
      safetyStock: 42.5,
      iterations: 10000,
      meanDemandOverLt: 300,
      confidenceInterval: { p5: 200, p95: 450 },
      histogram: [],
    };

    renderComponent('prod-1');

    expect(screen.getByText(/10\.000 iterações/)).toBeInTheDocument();
  });

  it('should show error message on simulation failure', () => {
    mockError = new Error('Insufficient historical data');
    renderComponent('prod-1');

    expect(screen.getByText(/Erro na simulação/)).toBeInTheDocument();
  });
});
