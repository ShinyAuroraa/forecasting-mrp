'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ImportResult {
  tipo: string;
  importados: number;
  atualizados: number;
  rejeitados: number;
  erros: Array<{
    linha?: number;
    codigo?: string;
    campo?: string;
    mensagem: string;
  }>;
}

export interface ImportStatus {
  estatisticas: {
    produtos: number;
    seriesTemporais: number;
    inventario: number;
    composicoes: number;
  };
}

type ReportType =
  | 'produtos'
  | 'faturamento'
  | 'movimentacao'
  | 'inventario'
  | 'composicao';

function uploadPdf(tipo: ReportType, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return api
    .post<ImportResult>(`/erp-import/${tipo}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    })
    .then((res) => res.data);
}

export function useImportProdutos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPdf('produtos', file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-import-status'] });
    },
  });
}

export function useImportFaturamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPdf('faturamento', file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-import-status'] });
    },
  });
}

export function useImportMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPdf('movimentacao', file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-import-status'] });
    },
  });
}

export function useImportInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPdf('inventario', file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-import-status'] });
    },
  });
}

export function useImportComposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPdf('composicao', file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp-import-status'] });
    },
  });
}

export function useImportStatus() {
  return useQuery({
    queryKey: ['erp-import-status'],
    queryFn: async () => {
      const { data } = await api.get<ImportStatus>('/erp-import/status');
      return data;
    },
  });
}
