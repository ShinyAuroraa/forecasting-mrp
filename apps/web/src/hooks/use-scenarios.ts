'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ScenarioData,
  ScenarioImpact,
  CreateScenarioPayload,
} from '@/types/scenario';

const SCENARIO_KEYS = {
  list: ['scenarios'] as const,
  impact: (id: string) => ['scenarios', id, 'impact'] as const,
};

/**
 * Hook: list saved scenarios.
 * @see AC-10
 */
export function useScenarios() {
  return useQuery<ScenarioData[]>({
    queryKey: SCENARIO_KEYS.list,
    queryFn: async () => {
      const { data } = await api.get('/scenarios');
      return data;
    },
  });
}

/**
 * Hook: create a new scenario.
 * @see AC-11
 */
export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation<ScenarioData, Error, CreateScenarioPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/scenarios', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIO_KEYS.list });
    },
  });
}

/**
 * Hook: compute impact analysis for a scenario.
 * @see AC-12
 */
export function useScenarioImpact(scenarioId: string | null) {
  return useQuery<ScenarioImpact>({
    queryKey: scenarioId ? SCENARIO_KEYS.impact(scenarioId) : ['scenarios', 'none'],
    queryFn: async () => {
      const { data } = await api.get(`/scenarios/${scenarioId}/impact`);
      return data;
    },
    enabled: !!scenarioId,
  });
}

/**
 * Hook: delete a scenario.
 * @see AC-13
 */
export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/scenarios/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCENARIO_KEYS.list });
    },
  });
}
