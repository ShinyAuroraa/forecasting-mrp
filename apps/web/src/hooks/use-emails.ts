'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  EmailFullConfig,
  EmailSendResult,
  PaginatedEmailResponse,
} from '@/types/email';

const EMAIL_KEYS = {
  config: ['emails', 'config'] as const,
  history: ['emails', 'history'] as const,
};

/**
 * Hook: current email configuration (SMTP + recipients).
 */
export function useEmailConfig() {
  return useQuery<EmailFullConfig>({
    queryKey: EMAIL_KEYS.config,
    queryFn: async () => {
      const { data } = await api.get('/automation/emails/config');
      return data;
    },
  });
}

/**
 * Hook: update email configuration.
 */
export function useUpdateEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, Record<string, unknown>>({
    mutationFn: async (config) => {
      const { data } = await api.put('/automation/emails/config', config);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_KEYS.config });
    },
  });
}

/**
 * Hook: email send history (paginated).
 */
export function useEmailHistory(page = 1, limit = 20) {
  return useQuery<PaginatedEmailResponse>({
    queryKey: [...EMAIL_KEYS.history, page, limit],
    queryFn: async () => {
      const { data } = await api.get('/automation/emails/history', {
        params: { page, limit, sortOrder: 'desc' },
      });
      return data;
    },
    refetchInterval: 30_000,
  });
}

/**
 * Hook: manually send daily summary email.
 */
export function useSendSummary() {
  const queryClient = useQueryClient();

  return useMutation<EmailSendResult, Error>({
    mutationFn: async () => {
      const { data } = await api.post('/automation/emails/send-summary');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_KEYS.history });
    },
  });
}

/**
 * Hook: manually send morning briefing email.
 */
export function useSendBriefing() {
  const queryClient = useQueryClient();

  return useMutation<EmailSendResult, Error>({
    mutationFn: async () => {
      const { data } = await api.post('/automation/emails/send-briefing');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_KEYS.history });
    },
  });
}
