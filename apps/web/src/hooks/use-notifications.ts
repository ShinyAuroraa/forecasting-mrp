'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type {
  Alert,
  AlertListResponse,
  AlertSummary,
  AlertQueryParams,
} from '@/types/notifications';

const ALERTS_KEY = ['alerts'];
const SUMMARY_KEY = ['alerts', 'summary'];

/**
 * Hook: Fetch alert list with filters.
 * @see Story 4.4 — AC-14
 */
export function useAlerts(params?: AlertQueryParams) {
  return useQuery({
    queryKey: [...ALERTS_KEY, params],
    queryFn: async () => {
      const res = await api.get<AlertListResponse>('/alerts', { params });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook: Fetch alert summary (counts by type/severity).
 * @see Story 4.4 — AC-16
 */
export function useAlertSummary() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: async () => {
      const res = await api.get<AlertSummary>('/alerts/summary');
      return res.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Hook: Acknowledge an alert.
 * @see Story 4.4 — AC-15
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<Alert>(`/alerts/${id}/acknowledge`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

/**
 * Hook: Subscribe to SSE alert stream for real-time updates.
 * @see Story 4.4 — AC-11, AC-12, AC-13
 */
export function useAlertStream(onNewAlert?: (alert: Alert) => void) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(onNewAlert);
  callbackRef.current = onNewAlert;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
    queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
  }, [queryClient]);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const eventSource = new EventSource(`${baseUrl}/alerts/stream`, {
      withCredentials: true,
    });

    eventSource.addEventListener('alert', (event: MessageEvent) => {
      try {
        const alert = JSON.parse(event.data) as Alert;
        callbackRef.current?.(alert);
        invalidate();
      } catch {
        // ignore parse errors
      }
    });

    return () => {
      eventSource.close();
    };
  }, [invalidate]);
}
