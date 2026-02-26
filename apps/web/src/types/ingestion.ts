/**
 * Ingestion Mapping Template types.
 *
 * All interfaces use readonly properties to enforce immutability.
 *
 * @see Story 4.1 — Ingestion Mapping Templates
 */

export type TipoFonte = 'CSV' | 'XLSX' | 'API' | 'DB';

export interface ColumnMapping {
  readonly sourceColumn: string;
  readonly targetField: string;
  readonly dataType: 'string' | 'number' | 'date' | 'boolean';
  readonly transformation?: string;
  readonly required: boolean;
}

export interface MappingTemplate {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly tipoFonte: TipoFonte;
  readonly colunas: readonly ColumnMapping[];
  readonly validationRules: readonly Record<string, unknown>[] | null;
  readonly lastUsedAt: string | null;
  readonly usageCount: number;
  readonly ativo: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TemplateSuggestion {
  readonly template: MappingTemplate;
  readonly matchScore: number;
  readonly matchCount: number;
}

export interface CreateMappingTemplateInput {
  readonly nome: string;
  readonly descricao?: string;
  readonly tipoFonte: TipoFonte;
  readonly colunas: readonly ColumnMapping[];
  readonly validationRules?: readonly Record<string, unknown>[];
}

export interface UpdateMappingTemplateInput {
  readonly nome?: string;
  readonly descricao?: string;
  readonly tipoFonte?: TipoFonte;
  readonly colunas?: readonly ColumnMapping[];
  readonly validationRules?: readonly Record<string, unknown>[];
}
