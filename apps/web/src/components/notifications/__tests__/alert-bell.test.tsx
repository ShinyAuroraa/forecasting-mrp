import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertBell } from '../alert-bell';

// Mock hooks
jest.mock('@/hooks/use-notifications', () => ({
  useAlertSummary: jest.fn(() => ({
    data: { totalUnacknowledged: 5, byType: {}, bySeverity: {} },
  })),
  useAlertStream: jest.fn(),
}));

jest.mock('../alert-dropdown', () => ({
  AlertDropdown: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="alert-dropdown">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

function renderWithProvider(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('AlertBell', () => {
  it('renders bell button', () => {
    renderWithProvider(<AlertBell />);
    expect(screen.getByTestId('alert-bell')).toBeInTheDocument();
  });

  it('shows badge count when > 0', () => {
    renderWithProvider(<AlertBell />);
    expect(screen.getByTestId('alert-badge')).toHaveTextContent('5');
  });

  it('opens dropdown on click', () => {
    renderWithProvider(<AlertBell />);
    fireEvent.click(screen.getByTestId('alert-bell'));
    expect(screen.getByTestId('alert-dropdown')).toBeInTheDocument();
  });

  it('closes dropdown on second click', () => {
    renderWithProvider(<AlertBell />);
    const bell = screen.getByTestId('alert-bell');
    fireEvent.click(bell);
    expect(screen.getByTestId('alert-dropdown')).toBeInTheDocument();

    fireEvent.click(bell);
    expect(screen.queryByTestId('alert-dropdown')).not.toBeInTheDocument();
  });

  it('has accessible label', () => {
    renderWithProvider(<AlertBell />);
    expect(screen.getByTestId('alert-bell')).toHaveAttribute(
      'aria-label',
      'Alertas (5 não lidos)',
    );
  });

  it('shows 99+ when count exceeds 99', () => {
    const { useAlertSummary } = require('@/hooks/use-notifications');
    useAlertSummary.mockReturnValue({
      data: { totalUnacknowledged: 150, byType: {}, bySeverity: {} },
    });

    renderWithProvider(<AlertBell />);
    expect(screen.getByTestId('alert-badge')).toHaveTextContent('99+');
  });

  it('hides badge when count is 0', () => {
    const { useAlertSummary } = require('@/hooks/use-notifications');
    useAlertSummary.mockReturnValue({
      data: { totalUnacknowledged: 0, byType: {}, bySeverity: {} },
    });

    renderWithProvider(<AlertBell />);
    expect(screen.queryByTestId('alert-badge')).not.toBeInTheDocument();
  });
});
