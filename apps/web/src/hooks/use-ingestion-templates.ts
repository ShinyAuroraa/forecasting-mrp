'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/types/forecast';
import type {
  MappingTemplate,
  CreateMappingTemplateInput,
  UpdateMappingTemplateInput,
  TemplateSuggestion,
} from '@/types/ingestion';

const TEMPLATES_KEY = ['ingestion', 'templates'];

/**
 * Hook: Fetch paginated mapping templates.
 *
 * @param search - Optional search text filter
 * @param tipoFonte - Optional source type filter
 * @see Story 4.1 — Ingestion Mapping Templates (AC-9)
 */
export function useIngestionTemplates(search?: string, tipoFonte?: string) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, search, tipoFonte],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<MappingTemplate>>(
        '/ingestion/templates',
        { params: { search, tipoFonte, limit: 100 } },
      );
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook: Fetch a single mapping template by ID.
 *
 * @param id - Template UUID (null disables the query)
 * @see Story 4.1 — (AC-4)
 */
export function useIngestionTemplate(id: string | null) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, id],
    queryFn: async () => {
      const res = await api.get<MappingTemplate>(`/ingestion/templates/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook: Create a new mapping template.
 *
 * @see Story 4.1 — (AC-10)
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateMappingTemplateInput) => {
      const res = await api.post<MappingTemplate>('/ingestion/templates', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}

/**
 * Hook: Update an existing mapping template.
 *
 * @see Story 4.1 — (AC-11)
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateMappingTemplateInput;
    }) => {
      const res = await api.put<MappingTemplate>(
        `/ingestion/templates/${id}`,
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}

/**
 * Hook: Delete (soft) a mapping template.
 *
 * @see Story 4.1 — (AC-12)
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ingestion/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}

/**
 * Hook: Duplicate an existing template.
 *
 * @see Story 4.1 — (AC-5)
 */
export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<MappingTemplate>(
        `/ingestion/templates/${id}/duplicate`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}

/**
 * Hook: Suggest templates based on file column headers.
 *
 * @see Story 4.1 — (AC-6)
 */
export function useSuggestTemplates() {
  return useMutation({
    mutationFn: async (headers: string[]) => {
      const res = await api.post<TemplateSuggestion[]>(
        '/ingestion/templates/suggest',
        { headers },
      );
      return res.data;
    },
  });
}
