'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  EmailListenerConfig,
  EmailTestConnectionResult,
  EmailProcessingResult,
} from '@/types/automation';

const EMAIL_CONFIG_KEY = ['automation', 'email', 'config'];
const EMAIL_LOGS_KEY = ['automation', 'email', 'logs'];

/**
 * Hook: Fetch email listener configuration.
 * @see Story 4.3 — AC-12
 */
export function useEmailConfig() {
  return useQuery({
    queryKey: EMAIL_CONFIG_KEY,
    queryFn: async () => {
      const res = await api.get<EmailListenerConfig>('/automation/email/config');
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook: Update email listener configuration.
 * @see Story 4.3 — AC-12, AC-13
 */
export function useUpdateEmailConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: EmailListenerConfig) => {
      const res = await api.put<EmailListenerConfig>(
        '/automation/email/config',
        config,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CONFIG_KEY });
    },
  });
}

/**
 * Hook: Test email connection.
 * @see Story 4.3 — AC-12
 */
export function useTestEmailConnection() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<EmailTestConnectionResult>(
        '/automation/email/test-connection',
      );
      return res.data;
    },
  });
}

/**
 * Hook: Manually trigger email processing.
 * @see Story 4.3 — AC-14
 */
export function useTriggerEmailListener() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<EmailProcessingResult>(
        '/automation/email/trigger',
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_LOGS_KEY });
    },
  });
}

/**
 * Hook: Fetch email listener execution logs.
 * @see Story 4.3 — AC-14, AC-15
 */
export function useEmailLogs(limit: number = 20) {
  return useQuery({
    queryKey: [...EMAIL_LOGS_KEY, limit],
    queryFn: async () => {
      const res = await api.get<EmailProcessingResult[]>(
        '/automation/email/logs',
        { params: { limit } },
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}
