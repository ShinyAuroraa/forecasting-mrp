-- Custom migration: GENERATED columns and GIN indexes
-- These features are not natively supported by Prisma

-- GENERATED ALWAYS AS columns for inventario_atual
ALTER TABLE "inventario_atual"
  ADD COLUMN "quantidade_total" DECIMAL(12,4)
  GENERATED ALWAYS AS (quantidade_disponivel + quantidade_reservada + quantidade_em_quarentena) STORED;

ALTER TABLE "inventario_atual"
  ADD COLUMN "valor_total_estoque" DECIMAL(14,4)
  GENERATED ALWAYS AS ((quantidade_disponivel + quantidade_reservada + quantidade_em_quarentena) * COALESCE(custo_medio_unitario, 0)) STORED;

-- GIN indexes for JSONB columns
CREATE INDEX idx_exec_parametros ON execucao_planejamento USING GIN (parametros);
CREATE INDEX idx_exec_resultado ON execucao_planejamento USING GIN (resultado_resumo);
CREATE INDEX idx_config_valor ON config_sistema USING GIN (valor);
