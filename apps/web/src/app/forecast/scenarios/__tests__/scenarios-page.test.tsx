import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/charts/chart-base', () => ({
  ChartBase: () => <div data-testid="chart-base">Chart</div>,
}));

const mockScenarios = [
  {
    id: 's1',
    name: 'Cenário Otimista',
    description: 'Aumento 20% classe A',
    adjustments: { globalMultiplier: 1.2, classMultipliers: { A: 1.3, B: 1.0, C: 0.8 }, skuOverrides: [] },
    createdAt: '2026-02-27T00:00:00.000Z',
    createdBy: null,
  },
];

jest.mock('@/hooks/use-scenarios', () => ({
  useScenarios: () => ({ data: mockScenarios, isLoading: false }),
  useCreateScenario: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteScenario: () => ({ mutate: jest.fn() }),
  useScenarioImpact: () => ({ data: null, isLoading: false, isError: false }),
}));

import ScenariosPage from '../page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ScenariosPage />
    </QueryClientProvider>,
  );
}

describe('ScenariosPage', () => {
  it('should render the page title', () => {
    renderPage();
    expect(screen.getByText('Análise What-If')).toBeInTheDocument();
  });

  it('should render the new scenario button', () => {
    renderPage();
    expect(screen.getByTestId('btn-new-scenario')).toBeInTheDocument();
  });

  it('should render the scenario list', () => {
    renderPage();
    expect(screen.getByTestId('scenario-list')).toBeInTheDocument();
    expect(screen.getByText('Cenário Otimista')).toBeInTheDocument();
  });

  it('should show scenario multiplier in list', () => {
    renderPage();
    expect(screen.getByText(/1\.20x/)).toBeInTheDocument();
  });

  it('should render delete button for each scenario', () => {
    renderPage();
    expect(screen.getByTestId('btn-delete-s1')).toBeInTheDocument();
  });

  it('should show saved scenarios heading', () => {
    renderPage();
    expect(screen.getByText('Cenários Salvos')).toBeInTheDocument();
  });
});
