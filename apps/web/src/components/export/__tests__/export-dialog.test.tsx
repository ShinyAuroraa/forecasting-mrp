import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMutateAsync = jest.fn().mockResolvedValue({ async: false });
const mockMutate = jest.fn();

jest.mock('@/hooks/use-export', () => ({
  useRequestExport: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDownloadExport: () => ({ mutate: mockMutate }),
  useExportHistory: () => ({
    data: [
      {
        jobId: 'j1',
        type: 'MRP_ORDERS',
        format: 'xlsx',
        status: 'COMPLETED',
        fileName: 'orders.xlsx',
        createdAt: '2026-02-28T00:00:00Z',
        downloadUrl: '/export/j1/download',
      },
    ],
    isLoading: false,
  }),
}));

import { ExportDialog, ExportButton } from '../export-dialog';

function renderDialog(props?: Partial<React.ComponentProps<typeof ExportDialog>>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ExportDialog open={true} onClose={jest.fn()} {...props} />
    </QueryClientProvider>,
  );
}

function renderButton() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ExportButton type="MRP_ORDERS" />
    </QueryClientProvider>,
  );
}

describe('ExportDialog', () => {
  it('should render dialog when open', () => {
    renderDialog();
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
    expect(screen.getByText('Exportar Dados')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();
  });

  it('should render export type selector', () => {
    renderDialog();
    expect(screen.getByTestId('select-type')).toBeInTheDocument();
  });

  it('should render format radio buttons', () => {
    renderDialog();
    expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should render export button', () => {
    renderDialog();
    expect(screen.getByTestId('btn-export')).toBeInTheDocument();
  });

  it('should show export history', () => {
    renderDialog();
    expect(screen.getByTestId('export-history')).toBeInTheDocument();
    expect(screen.getByText('orders.xlsx')).toBeInTheDocument();
  });

  it('should show download button for completed exports', () => {
    renderDialog();
    expect(screen.getByTestId('btn-download-j1')).toBeInTheDocument();
  });
});

describe('ExportButton', () => {
  it('should render export button', () => {
    renderButton();
    expect(screen.getByTestId('btn-open-export')).toBeInTheDocument();
    expect(screen.getByText('Exportar')).toBeInTheDocument();
  });

  it('should open dialog on click', () => {
    renderButton();
    fireEvent.click(screen.getByTestId('btn-open-export'));
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
  });
});
