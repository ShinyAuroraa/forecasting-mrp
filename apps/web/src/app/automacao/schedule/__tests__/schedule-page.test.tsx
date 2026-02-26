import React from 'react';

jest.mock('@/hooks/use-cycles', () => ({
  useCycleSchedule: jest.fn(),
  useCycleExecutions: jest.fn(),
  useTriggerCycle: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const {
  useCycleSchedule,
  useCycleExecutions,
  useTriggerCycle,
} = require('@/hooks/use-cycles');

import { render, screen, fireEvent } from '@testing-library/react';
import SchedulePage from '../page';

const mockSchedules = [
  {
    type: 'DAILY',
    label: 'Ciclo Diario',
    cronExpression: '0 6 * * *',
    nextRunAt: '2026-02-28T06:00:00Z',
    lastExecution: {
      id: 'last-1',
      status: 'SUCCESS',
      startedAt: '2026-02-27T06:00:00Z',
      completedAt: '2026-02-27T06:02:00Z',
      durationMs: 120000,
    },
  },
  {
    type: 'WEEKLY',
    label: 'Ciclo Semanal',
    cronExpression: '0 3 * * 1',
    nextRunAt: '2026-03-02T03:00:00Z',
    lastExecution: null,
  },
  {
    type: 'MONTHLY',
    label: 'Ciclo Mensal',
    cronExpression: '0 2 1 * *',
    nextRunAt: '2026-03-01T02:00:00Z',
    lastExecution: null,
  },
];

const mockExecutions = {
  data: [
    {
      id: 'exec-1',
      type: 'DAILY',
      status: 'SUCCESS',
      startedAt: '2026-02-27T06:00:00Z',
      completedAt: '2026-02-27T06:02:00Z',
      errorMessage: null,
      stepsCompleted: 3,
      stepsTotal: 3,
      resultSummary: null,
      createdAt: '2026-02-27T06:00:00Z',
    },
    {
      id: 'exec-2',
      type: 'WEEKLY',
      status: 'FAILED',
      startedAt: '2026-02-24T03:00:00Z',
      completedAt: '2026-02-24T03:05:00Z',
      errorMessage: 'Step 2 failed',
      stepsCompleted: 1,
      stepsTotal: 4,
      resultSummary: null,
      createdAt: '2026-02-24T03:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
};

describe('SchedulePage', () => {
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
    useCycleSchedule.mockReturnValue({
      data: mockSchedules,
      isLoading: false,
      isError: false,
    });
    useCycleExecutions.mockReturnValue({
      data: mockExecutions,
      isLoading: false,
      isError: false,
    });
    useTriggerCycle.mockReturnValue(defaultTriggerMutation);
  });

  it('should render page title', () => {
    render(<SchedulePage />);
    expect(screen.getByText('Gerenciamento de Ciclos')).toBeTruthy();
  });

  it('should render schedule cards for all cycle types', () => {
    render(<SchedulePage />);
    expect(screen.getByTestId('schedule-card-DAILY')).toBeTruthy();
    expect(screen.getByTestId('schedule-card-WEEKLY')).toBeTruthy();
    expect(screen.getByTestId('schedule-card-MONTHLY')).toBeTruthy();
  });

  it('should display cron expressions in schedule cards', () => {
    render(<SchedulePage />);
    expect(screen.getByText('0 6 * * *')).toBeTruthy();
    expect(screen.getByText('0 3 * * 1')).toBeTruthy();
    expect(screen.getByText('0 2 1 * *')).toBeTruthy();
  });

  it('should display last execution status when available', () => {
    render(<SchedulePage />);
    expect(screen.getByTestId('last-exec-DAILY')).toBeTruthy();
    expect(screen.getByText('Sucesso')).toBeTruthy();
  });

  it('should show "Nenhuma execucao registrada" when no last execution', () => {
    render(<SchedulePage />);
    const weeklyCard = screen.getByTestId('schedule-card-WEEKLY');
    expect(weeklyCard.textContent).toContain('Nenhuma execucao registrada');
  });

  it('should render trigger buttons for each cycle type', () => {
    render(<SchedulePage />);
    expect(screen.getByTestId('trigger-btn-DAILY')).toBeTruthy();
    expect(screen.getByTestId('trigger-btn-WEEKLY')).toBeTruthy();
    expect(screen.getByTestId('trigger-btn-MONTHLY')).toBeTruthy();
  });

  it('should show confirmation on trigger button click', () => {
    render(<SchedulePage />);
    const triggerBtn = screen.getByTestId('trigger-btn-DAILY');
    fireEvent.click(triggerBtn);
    expect(screen.getByTestId('confirm-trigger-DAILY')).toBeTruthy();
  });

  it('should render executions table with data', () => {
    render(<SchedulePage />);
    const rows = screen.getAllByTestId('execution-row');
    expect(rows).toHaveLength(2);
  });

  it('should display execution status badges', () => {
    render(<SchedulePage />);
    expect(screen.getByText('Falha')).toBeTruthy();
  });

  it('should show step progress', () => {
    render(<SchedulePage />);
    expect(screen.getByText('3/3')).toBeTruthy();
    expect(screen.getByText('1/4')).toBeTruthy();
  });

  it('should show loading state for schedules', () => {
    useCycleSchedule.mockReturnValue({ data: null, isLoading: true, isError: false });

    render(<SchedulePage />);
    expect(screen.getByText('Carregando agendamentos...')).toBeTruthy();
  });

  it('should show error state for schedules', () => {
    useCycleSchedule.mockReturnValue({ data: null, isLoading: false, isError: true });

    render(<SchedulePage />);
    expect(screen.getByTestId('schedule-error')).toBeTruthy();
  });

  it('should show empty state for executions', () => {
    useCycleExecutions.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } },
      isLoading: false,
      isError: false,
    });

    render(<SchedulePage />);
    expect(screen.getByTestId('no-executions')).toBeTruthy();
  });

  it('should show success message after trigger', () => {
    useTriggerCycle.mockReturnValue({
      ...defaultTriggerMutation,
      isSuccess: true,
      data: { id: 'new-exec-123', type: 'DAILY' },
    });

    render(<SchedulePage />);
    expect(screen.getByTestId('trigger-success')).toBeTruthy();
  });
});
