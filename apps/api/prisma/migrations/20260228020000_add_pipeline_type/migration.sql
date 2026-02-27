-- Story 4.6: Daily Automated Pipeline
-- Add PIPELINE_DIARIO to tipo_execucao enum

ALTER TYPE "TipoExecucao" ADD VALUE IF NOT EXISTS 'PIPELINE_DIARIO';
