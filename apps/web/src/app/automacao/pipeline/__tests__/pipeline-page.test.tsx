import React from 'react';

jest.mock('@/hooks/use-pipeline', () => ({
  usePipelineStatus: jest.fn(),
  usePipelineHistory: jest.fn(),
  useTriggerPipeline: jest.fn(),
  usePipelineDetail: jest.fn(),
  useSSEProgress: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const {
  usePipelineStatus,
  usePipelineHistory,
  useTriggerPipeline,
  usePipelineDetail,
  useSSEProgress,
} = require('@/hooks/use-pipeline');

import { render, screen, fireEvent } from '@testing-library/react';
import PipelinePage from '../page';

const mockStatus = {
  id: 'exec-1',
  status: 'COMPLETED',
  startedAt: '2026-02-28T06:00:00Z',
  completedAt: '2026-02-28T06:15:00Z',
  errorMessage: null,
  stepsCompleted: 7,
  stepsTotal: 7,
  resultSummary: null,
  createdAt: '2026-02-28T06:00:00Z',
};

const mockHistory = {
  data: [
    {
      id: 'exec-1',
      status: 'COMPLETED',
      startedAt: '2026-02-28T06:00:00Z',
      completedAt: '2026-02-28T06:15:00Z',
      errorMessage: null,
      stepsCompleted: 7,
      stepsTotal: 7,
      resultSummary: null,
      createdAt: '2026-02-28T06:00:00Z',
    },
    {
      id: 'exec-2',
      status: 'PARTIAL',
      startedAt: '2026-02-27T06:00:00Z',
      completedAt: '2026-02-27T06:12:00Z',
      errorMessage: 'Failed: fetch-data. Skipped: etl, update-stock.',
      stepsCompleted: 4,
      stepsTotal: 7,
      resultSummary: null,
      createdAt: '2026-02-27T06:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
};

describe('PipelinePage', () => {
  const defaultTriggerMutation = {
    mutate: jest.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    data: null,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    usePipelineStatus.mockReturnValue({
      data: mockStatus,
      isLoading: false,
    });
    usePipelineHistory.mockReturnValue({
      data: mockHistory,
      isLoading: false,
    });
    useTriggerPipeline.mockReturnValue(defaultTriggerMutation);
    usePipelineDetail.mockReturnValue({
      data: null,
    });
    useSSEProgress.mockReturnValue({
      stepEvents: [],
      connected: false,
    });
  });

  it('should render page title', () => {
    render(<PipelinePage />);
    expect(screen.getByText('Pipeline Automatizado Diario')).toBeTruthy();
  });

  it('should render pipeline status card', () => {
    render(<PipelinePage />);
    expect(screen.getByTestId('pipeline-status-card')).toBeTruthy();
  });

  it('should display current status as Concluido', () => {
    render(<PipelinePage />);
    expect(screen.getByText('Concluido')).toBeTruthy();
  });

  it('should display step progress', () => {
    render(<PipelinePage />);
    expect(screen.getByText('7/7')).toBeTruthy();
  });

  it('should render trigger button', () => {
    render(<PipelinePage />);
    expect(screen.getByTestId('trigger-pipeline-btn')).toBeTruthy();
  });

  it('should show confirmation on trigger button click', () => {
    render(<PipelinePage />);
    const triggerBtn = screen.getByTestId('trigger-pipeline-btn');
    fireEvent.click(triggerBtn);
    expect(screen.getByTestId('trigger-confirm')).toBeTruthy();
  });

  it('should render history table with data', () => {
    render(<PipelinePage />);
    const rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(2);
  });

  it('should display execution status badges', () => {
    render(<PipelinePage />);
    expect(screen.getByText('Parcial')).toBeTruthy();
  });

  it('should display step counts in history', () => {
    render(<PipelinePage />);
    expect(screen.getByText('4/7')).toBeTruthy();
  });

  it('should show loading state for status', () => {
    usePipelineStatus.mockReturnValue({ data: null, isLoading: true });

    render(<PipelinePage />);
    expect(screen.getByTestId('status-loading')).toBeTruthy();
  });

  it('should show no-pipeline-status when null', () => {
    usePipelineStatus.mockReturnValue({ data: null, isLoading: false });

    render(<PipelinePage />);
    expect(screen.getByTestId('no-pipeline-status')).toBeTruthy();
  });

  it('should show empty state for history', () => {
    usePipelineHistory.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } },
      isLoading: false,
    });

    render(<PipelinePage />);
    expect(screen.getByTestId('no-history')).toBeTruthy();
  });

  it('should show success message after trigger', () => {
    useTriggerPipeline.mockReturnValue({
      ...defaultTriggerMutation,
      isSuccess: true,
      data: { id: 'new-exec-123', status: 'PENDING' },
    });

    render(<PipelinePage />);
    expect(screen.getByTestId('trigger-success')).toBeTruthy();
  });

  it('should show error message on trigger failure', () => {
    useTriggerPipeline.mockReturnValue({
      ...defaultTriggerMutation,
      isError: true,
      error: new Error('Pipeline already running'),
    });

    render(<PipelinePage />);
    expect(screen.getByTestId('trigger-error')).toBeTruthy();
  });
});
