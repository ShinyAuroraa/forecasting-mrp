-- Story 4.5: Re-training Cycle Management
-- Adds cycle-related enum values to existing enums

-- Add cycle types to TipoExecucao
ALTER TYPE "TipoExecucao" ADD VALUE IF NOT EXISTS 'CICLO_DIARIO';
ALTER TYPE "TipoExecucao" ADD VALUE IF NOT EXISTS 'CICLO_SEMANAL';
ALTER TYPE "TipoExecucao" ADD VALUE IF NOT EXISTS 'CICLO_MENSAL';

-- Add PARCIAL status to StatusExecucao
ALTER TYPE "StatusExecucao" ADD VALUE IF NOT EXISTS 'PARCIAL';
