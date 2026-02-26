-- Story 4.5: Re-training Cycle Management
-- Adds cycle-related enum values to existing enums

-- Add cycle types to TipoExecucao
ALTER TYPE "tipo_execucao" ADD VALUE IF NOT EXISTS 'CICLO_DIARIO';
ALTER TYPE "tipo_execucao" ADD VALUE IF NOT EXISTS 'CICLO_SEMANAL';
ALTER TYPE "tipo_execucao" ADD VALUE IF NOT EXISTS 'CICLO_MENSAL';

-- Add PARCIAL status to StatusExecucao
ALTER TYPE "status_execucao" ADD VALUE IF NOT EXISTS 'PARCIAL';
