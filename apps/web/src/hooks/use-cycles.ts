'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CycleType,
  CycleExecution,
  CycleExecutionDetail,
  CycleScheduleInfo,
  PaginatedCycleResponse,
} from '@/types/cycles';

const CYCLES_KEY = ['automation', 'cycles'];
const SCHEDULE_KEY = ['automation', 'cycles', 'schedule'];

/**
 * Hook: Fetch cycle schedule info (type, cron, next run, last execution).
 * @see Story 4.5 — AC-14
 */
export function useCycleSchedule() {
  return useQuery({
    queryKey: SCHEDULE_KEY,
    queryFn: async () => {
      const res = await api.get<readonly CycleScheduleInfo[]>('/automation/cycles/schedule');
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

/**
 * Hook: Fetch paginated cycle execution history.
 * @see Story 4.5 — AC-16
 */
export function useCycleExecutions(params?: {
  readonly type?: CycleType;
  readonly status?: string;
  readonly page?: number;
  readonly limit?: number;
}) {
  return useQuery({
    queryKey: [...CYCLES_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedCycleResponse>('/automation/cycles', {
        params,
      });
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

/**
 * Hook: Fetch a single cycle execution by ID.
 * @see Story 4.5 — AC-11
 */
export function useCycleExecution(id: string | null) {
  return useQuery({
    queryKey: [...CYCLES_KEY, 'detail', id],
    queryFn: async () => {
      const res = await api.get<CycleExecutionDetail>(`/automation/cycles/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

/**
 * Hook: Manually trigger a cycle.
 * @see Story 4.5 — AC-15
 */
export function useTriggerCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: CycleType) => {
      const res = await api.post<CycleExecution>('/automation/cycles/trigger', { type });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CYCLES_KEY });
      queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    },
  });
}
