'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PipelineExecution,
  PipelineExecutionDetail,
  PipelineProgressEvent,
  PaginatedPipelineResponse,
} from '@/types/pipeline';

const PIPELINE_KEYS = {
  status: ['pipeline', 'status'] as const,
  history: ['pipeline', 'history'] as const,
  detail: (id: string) => ['pipeline', 'detail', id] as const,
};

/**
 * Hook: current pipeline execution status.
 * Polls every 10 seconds when a pipeline is running.
 */
export function usePipelineStatus() {
  return useQuery<PipelineExecution | null>({
    queryKey: PIPELINE_KEYS.status,
    queryFn: async () => {
      const { data } = await api.get('/automation/pipeline/status');
      return data;
    },
    refetchInterval: 10_000,
  });
}

/**
 * Hook: pipeline execution history (paginated).
 */
export function usePipelineHistory(page = 1, limit = 20) {
  return useQuery<PaginatedPipelineResponse>({
    queryKey: [...PIPELINE_KEYS.history, page, limit],
    queryFn: async () => {
      const { data } = await api.get('/automation/pipeline/history', {
        params: { page, limit, sortBy: 'createdAt', sortOrder: 'desc' },
      });
      return data;
    },
    refetchInterval: 30_000,
  });
}

/**
 * Hook: pipeline execution detail with per-step status.
 */
export function usePipelineDetail(id: string | null) {
  return useQuery<PipelineExecutionDetail>({
    queryKey: PIPELINE_KEYS.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/automation/pipeline/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

/**
 * Hook: SSE pipeline progress for real-time step updates.
 * Connects to the SSE endpoint and returns live step progress events.
 *
 * @see Story 4.6 — AC-19
 */
export function useSSEProgress(executionId: string | null) {
  const [stepEvents, setStepEvents] = useState<readonly PipelineProgressEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!executionId) {
      setStepEvents([]);
      setConnected(false);
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const source = new EventSource(
      `${baseUrl}/automation/pipeline/${executionId}/progress`,
      { withCredentials: true },
    );

    source.onopen = () => setConnected(true);

    source.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as PipelineProgressEvent;
        setStepEvents((prev) => {
          const filtered = prev.filter((e) => e.stepId !== data.stepId);
          return [...filtered, data];
        });
      } catch {
        // ignore malformed events
      }
    };

    source.onerror = () => {
      setConnected(false);
      source.close();
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [executionId]);

  return { stepEvents, connected };
}

/**
 * Hook: trigger daily pipeline manually.
 */
export function useTriggerPipeline() {
  const queryClient = useQueryClient();

  return useMutation<PipelineExecution, Error>({
    mutationFn: async () => {
      const { data } = await api.post('/automation/pipeline/trigger');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_KEYS.status });
      queryClient.invalidateQueries({ queryKey: PIPELINE_KEYS.history });
    },
  });
}
