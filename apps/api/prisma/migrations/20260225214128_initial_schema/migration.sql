-- CreateEnum
CREATE TYPE "TipoProduto" AS ENUM ('ACABADO', 'SEMI_ACABADO', 'INSUMO', 'EMBALAGEM', 'MATERIA_PRIMA', 'REVENDA');

-- CreateEnum
CREATE TYPE "PoliticaRessuprimento" AS ENUM ('PONTO_PEDIDO', 'MIN_MAX', 'REVISAO_PERIODICA', 'KANBAN');

-- CreateEnum
CREATE TYPE "FonteAtualizacao" AS ENUM ('MANUAL', 'ERP_SYNC', 'CONTAGEM', 'UPLOAD');

-- CreateEnum
CREATE TYPE "TipoDeposito" AS ENUM ('MATERIA_PRIMA', 'PRODUTO_ACABADO', 'WIP', 'EXPEDICAO', 'QUARENTENA');

-- CreateEnum
CREATE TYPE "TipoCentroTrabalho" AS ENUM ('PRODUCAO', 'EMBALAGEM', 'MONTAGEM', 'ACABAMENTO', 'CONTROLE_QUALIDADE');

-- CreateEnum
CREATE TYPE "TipoParadaProgramada" AS ENUM ('MANUTENCAO', 'FERIAS_COLETIVAS', 'SETUP', 'LIMPEZA', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoEventoCapacidade" AS ENUM ('NOVO_MAQUINARIO', 'QUEBRA', 'REPARO', 'MUDANCA_TURNO', 'MUDANCA_EFICIENCIA', 'AUMENTO_CAPACIDADE', 'REDUCAO_CAPACIDADE');

-- CreateEnum
CREATE TYPE "TipoCalendarioFabrica" AS ENUM ('UTIL', 'FERIADO', 'PONTO_FACULTATIVO', 'FERIAS_COLETIVAS', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "TipoExecucao" AS ENUM ('FORECAST', 'MRP', 'COMPLETO');

-- CreateEnum
CREATE TYPE "StatusExecucao" AS ENUM ('PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "GatilhoExecucao" AS ENUM ('MANUAL', 'AGENDADO', 'AUTO_INGESTAO');

-- CreateEnum
CREATE TYPE "ModeloForecast" AS ENUM ('TFT', 'ETS', 'CROSTON', 'LGBM', 'ENSEMBLE');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('VOLUME', 'FATURAMENTO');

-- CreateEnum
CREATE TYPE "Granularidade" AS ENUM ('diario', 'semanal', 'mensal');

-- CreateEnum
CREATE TYPE "PadraoDemanda" AS ENUM ('REGULAR', 'INTERMITENTE', 'ERRATICO', 'LUMPY');

-- CreateEnum
CREATE TYPE "ClasseABC" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "ClasseXYZ" AS ENUM ('X', 'Y', 'Z');

-- CreateEnum
CREATE TYPE "TipoOrdem" AS ENUM ('COMPRA', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "StatusOrdem" AS ENUM ('PLANEJADA', 'FIRME', 'LIBERADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PrioridadeOrdem" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "Lotificacao" AS ENUM ('L4L', 'EOQ', 'SILVER_MEAL', 'WAGNER_WHITIN');

-- CreateEnum
CREATE TYPE "SugestaoCapacidade" AS ENUM ('OK', 'HORA_EXTRA', 'ANTECIPAR', 'SUBCONTRATAR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "MetodoCalculo" AS ENUM ('TFT_QUANTIL', 'FORMULA_CLASSICA', 'MONTE_CARLO');

-- CreateTable
CREATE TABLE "produto" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descricao" VARCHAR(255) NOT NULL,
    "tipo_produto" "TipoProduto" NOT NULL,
    "categoria_id" TEXT,
    "unidade_medida_id" TEXT,
    "peso_liquido_kg" DECIMAL(10,4),
    "volume_m3" DECIMAL(10,6),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "custo_unitario" DECIMAL(12,4),
    "custo_pedido" DECIMAL(12,4),
    "custo_manutencao_pct_ano" DECIMAL(5,2) DEFAULT 25.00,
    "preco_venda" DECIMAL(12,4),
    "politica_ressuprimento" "PoliticaRessuprimento" NOT NULL DEFAULT 'PONTO_PEDIDO',
    "intervalo_revisao_dias" INTEGER,
    "lote_minimo" DECIMAL(12,4) DEFAULT 1,
    "multiplo_compra" DECIMAL(12,4) DEFAULT 1,
    "estoque_seguranca_manual" DECIMAL(12,4),
    "lead_time_producao_dias" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "pai_id" TEXT,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade_medida" (
    "id" TEXT NOT NULL,
    "sigla" VARCHAR(10) NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "fator_conversao" DECIMAL(12,6) NOT NULL DEFAULT 1,

    CONSTRAINT "unidade_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedor" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "razao_social" VARCHAR(255) NOT NULL,
    "nome_fantasia" VARCHAR(255),
    "cnpj" VARCHAR(18),
    "email" VARCHAR(255),
    "telefone" VARCHAR(20),
    "cidade" VARCHAR(100),
    "estado" VARCHAR(2),
    "lead_time_padrao_dias" INTEGER,
    "lead_time_min_dias" INTEGER,
    "lead_time_max_dias" INTEGER,
    "confiabilidade_pct" DECIMAL(5,2) DEFAULT 90.00,
    "avaliacao" SMALLINT DEFAULT 3,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_fornecedor" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "lead_time_dias" INTEGER,
    "preco_unitario" DECIMAL(12,4),
    "moq" DECIMAL(12,4) DEFAULT 1,
    "multiplo_compra" DECIMAL(12,4) DEFAULT 1,
    "is_principal" BOOLEAN NOT NULL DEFAULT false,
    "ultima_compra" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "produto_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom" (
    "id" TEXT NOT NULL,
    "produto_pai_id" TEXT NOT NULL,
    "produto_filho_id" TEXT NOT NULL,
    "quantidade" DECIMAL(12,6) NOT NULL,
    "unidade_medida_id" TEXT,
    "perda_percentual" DECIMAL(5,2) DEFAULT 0,
    "nivel" SMALLINT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "valido_desde" DATE,
    "valido_ate" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposito" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" "TipoDeposito" NOT NULL,
    "capacidade_m3" DECIMAL(10,2),
    "capacidade_posicoes" INTEGER,
    "capacidade_kg" DECIMAL(12,2),
    "temperatura_min" DECIMAL(5,2),
    "temperatura_max" DECIMAL(5,2),
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_atual" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "deposito_id" TEXT NOT NULL,
    "quantidade_disponivel" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "quantidade_reservada" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "quantidade_em_transito" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "quantidade_em_quarentena" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "lote" VARCHAR(50),
    "data_validade" DATE,
    "data_ultima_contagem" DATE,
    "custo_medio_unitario" DECIMAL(12,4),
    "fonte_atualizacao" "FonteAtualizacao" NOT NULL DEFAULT 'MANUAL',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inventario_atual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centro_trabalho" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" "TipoCentroTrabalho" NOT NULL,
    "descricao" TEXT,
    "capacidade_hora_unidades" DECIMAL(10,2),
    "num_operadores" INTEGER,
    "eficiencia_percentual" DECIMAL(5,2) DEFAULT 100,
    "tempo_setup_minutos" DECIMAL(8,2) DEFAULT 0,
    "custo_hora" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "centro_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" TEXT NOT NULL,
    "centro_trabalho_id" TEXT NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fim" TIME NOT NULL,
    "dias_semana" INTEGER[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "valido_desde" DATE,
    "valido_ate" DATE,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parada_programada" (
    "id" TEXT NOT NULL,
    "centro_trabalho_id" TEXT NOT NULL,
    "tipo" "TipoParadaProgramada" NOT NULL,
    "data_inicio" TIMESTAMPTZ NOT NULL,
    "data_fim" TIMESTAMPTZ NOT NULL,
    "motivo" TEXT,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "cron_expression" VARCHAR(100),

    CONSTRAINT "parada_programada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_capacidade" (
    "id" TEXT NOT NULL,
    "centro_trabalho_id" TEXT NOT NULL,
    "tipo" "TipoEventoCapacidade" NOT NULL,
    "data_evento" TIMESTAMPTZ NOT NULL,
    "campo_alterado" VARCHAR(50),
    "valor_anterior" VARCHAR(100),
    "valor_novo" VARCHAR(100),
    "motivo" TEXT,
    "previsao_resolucao" DATE,
    "usuario_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_capacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roteiro_producao" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "centro_trabalho_id" TEXT NOT NULL,
    "sequencia" SMALLINT NOT NULL,
    "operacao" VARCHAR(100) NOT NULL,
    "tempo_setup_minutos" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "tempo_unitario_minutos" DECIMAL(8,4) NOT NULL,
    "tempo_espera_minutos" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roteiro_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_fabrica" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoCalendarioFabrica" NOT NULL,
    "descricao" VARCHAR(100),
    "horas_produtivas" DECIMAL(4,2) NOT NULL DEFAULT 0,

    CONSTRAINT "calendario_fabrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucao_planejamento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoExecucao" NOT NULL,
    "status" "StatusExecucao" NOT NULL DEFAULT 'PENDENTE',
    "gatilho" "GatilhoExecucao" NOT NULL,
    "parametros" JSONB,
    "resultado_resumo" JSONB,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execucao_planejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucao_step_log" (
    "id" BIGSERIAL NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "step_name" VARCHAR(50) NOT NULL,
    "step_order" SMALLINT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "records_processed" BIGINT,
    "duration_ms" INTEGER,
    "details" JSONB,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "execucao_step_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_resultado" (
    "id" TEXT NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "horizonte_semanas" INTEGER NOT NULL,
    "modelo_usado" "ModeloForecast" NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "p10" DECIMAL(14,4),
    "p25" DECIMAL(14,4),
    "p50" DECIMAL(14,4),
    "p75" DECIMAL(14,4),
    "p90" DECIMAL(14,4),
    "faturamento_p50" DECIMAL(14,4),
    "faturamento_p10" DECIMAL(14,4),
    "faturamento_p90" DECIMAL(14,4),

    CONSTRAINT "forecast_resultado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_metrica" (
    "id" TEXT NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "modelo" VARCHAR(50) NOT NULL,
    "mape" DECIMAL(8,4),
    "mae" DECIMAL(12,4),
    "rmse" DECIMAL(12,4),
    "bias" DECIMAL(8,4),
    "classe_abc" CHAR(1),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_metrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_modelo" (
    "id" TEXT NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "tipo_modelo" VARCHAR(50) NOT NULL,
    "versao" INTEGER NOT NULL,
    "parametros" JSONB,
    "metricas_treino" JSONB,
    "arquivo_path" VARCHAR(500),
    "is_champion" BOOLEAN NOT NULL DEFAULT false,
    "treinado_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_classification" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "classe_abc" "ClasseABC" NOT NULL,
    "classe_xyz" "ClasseXYZ" NOT NULL,
    "padrao_demanda" "PadraoDemanda" NOT NULL,
    "modelo_forecast_sugerido" VARCHAR(50),
    "percentual_receita" DECIMAL(6,4),
    "cv_demanda" DECIMAL(6,4),
    "calculado_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sku_classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serie_temporal" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "data_referencia" DATE NOT NULL,
    "granularidade" "Granularidade" NOT NULL DEFAULT 'semanal',
    "volume" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "receita" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "fonte" VARCHAR(30),
    "qualidade" DECIMAL(4,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serie_temporal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_estoque" (
    "id" TEXT NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "safety_stock" DECIMAL(12,4),
    "reorder_point" DECIMAL(12,4),
    "estoque_minimo" DECIMAL(12,4),
    "estoque_maximo" DECIMAL(12,4),
    "eoq" DECIMAL(12,4),
    "dias_cobertura_atual" DECIMAL(8,2),
    "metodo_calculo" "MetodoCalculo" NOT NULL,
    "nivel_servico_usado" DECIMAL(5,4),
    "calculated_at" TIMESTAMPTZ,

    CONSTRAINT "parametros_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordem_planejada" (
    "id" TEXT NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "tipo" "TipoOrdem" NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL,
    "data_necessidade" DATE NOT NULL,
    "data_liberacao" DATE NOT NULL,
    "data_recebimento_esperado" DATE,
    "fornecedor_id" TEXT,
    "centro_trabalho_id" TEXT,
    "custo_estimado" DECIMAL(14,4),
    "lotificacao_usada" "Lotificacao",
    "prioridade" "PrioridadeOrdem" NOT NULL,
    "status" "StatusOrdem" NOT NULL DEFAULT 'PLANEJADA',
    "mensagem_acao" VARCHAR(100),
    "motivo" VARCHAR(100),
    "observacao" TEXT,

    CONSTRAINT "ordem_planejada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carga_capacidade" (
    "id" TEXT NOT NULL,
    "execucao_id" TEXT NOT NULL,
    "centro_trabalho_id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "capacidade_disponivel_horas" DECIMAL(8,2) NOT NULL,
    "carga_planejada_horas" DECIMAL(8,2) NOT NULL,
    "utilizacao_percentual" DECIMAL(5,2) NOT NULL,
    "sobrecarga" BOOLEAN NOT NULL DEFAULT false,
    "horas_excedentes" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "sugestao" "SugestaoCapacidade",

    CONSTRAINT "carga_capacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_sistema" (
    "chave" VARCHAR(100) NOT NULL,
    "valor" JSONB NOT NULL,
    "descricao" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "config_sistema_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produto_codigo_key" ON "produto"("codigo");

-- CreateIndex
CREATE INDEX "idx_produto_tipo_ativo" ON "produto"("tipo_produto", "ativo");

-- CreateIndex
CREATE INDEX "idx_produto_categoria" ON "produto"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_medida_sigla_key" ON "unidade_medida"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedor_codigo_key" ON "fornecedor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "produto_fornecedor_produto_id_fornecedor_id_key" ON "produto_fornecedor"("produto_id", "fornecedor_id");

-- CreateIndex
CREATE INDEX "idx_bom_pai_ativo" ON "bom"("produto_pai_id", "ativo");

-- CreateIndex
CREATE INDEX "idx_bom_filho" ON "bom"("produto_filho_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposito_codigo_key" ON "deposito"("codigo");

-- CreateIndex
CREATE INDEX "idx_inv_produto_deposito" ON "inventario_atual"("produto_id", "deposito_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_atual_produto_id_deposito_id_lote_key" ON "inventario_atual"("produto_id", "deposito_id", "lote");

-- CreateIndex
CREATE UNIQUE INDEX "centro_trabalho_codigo_key" ON "centro_trabalho"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "calendario_fabrica_data_key" ON "calendario_fabrica"("data");

-- CreateIndex
CREATE INDEX "idx_exec_tipo_status" ON "execucao_planejamento"("tipo", "status");

-- CreateIndex
CREATE INDEX "idx_forecast_exec_produto" ON "forecast_resultado"("execucao_id", "produto_id");

-- CreateIndex
CREATE INDEX "idx_forecast_periodo" ON "forecast_resultado"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "sku_classification_produto_id_key" ON "sku_classification"("produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "serie_temporal_produto_id_data_referencia_granularidade_key" ON "serie_temporal"("produto_id", "data_referencia", "granularidade");

-- CreateIndex
CREATE INDEX "idx_ordem_exec_tipo" ON "ordem_planejada"("execucao_id", "tipo");

-- CreateIndex
CREATE INDEX "idx_ordem_prioridade" ON "ordem_planejada"("prioridade");

-- CreateIndex
CREATE INDEX "idx_ordem_data_liberacao" ON "ordem_planejada"("data_liberacao");

-- CreateIndex
CREATE INDEX "idx_carga_centro_periodo" ON "carga_capacidade"("centro_trabalho_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_unidade_medida_id_fkey" FOREIGN KEY ("unidade_medida_id") REFERENCES "unidade_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom" ADD CONSTRAINT "bom_produto_pai_id_fkey" FOREIGN KEY ("produto_pai_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom" ADD CONSTRAINT "bom_produto_filho_id_fkey" FOREIGN KEY ("produto_filho_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom" ADD CONSTRAINT "bom_unidade_medida_id_fkey" FOREIGN KEY ("unidade_medida_id") REFERENCES "unidade_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_atual" ADD CONSTRAINT "inventario_atual_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_atual" ADD CONSTRAINT "inventario_atual_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "deposito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_centro_trabalho_id_fkey" FOREIGN KEY ("centro_trabalho_id") REFERENCES "centro_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parada_programada" ADD CONSTRAINT "parada_programada_centro_trabalho_id_fkey" FOREIGN KEY ("centro_trabalho_id") REFERENCES "centro_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_capacidade" ADD CONSTRAINT "evento_capacidade_centro_trabalho_id_fkey" FOREIGN KEY ("centro_trabalho_id") REFERENCES "centro_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_capacidade" ADD CONSTRAINT "evento_capacidade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roteiro_producao" ADD CONSTRAINT "roteiro_producao_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roteiro_producao" ADD CONSTRAINT "roteiro_producao_centro_trabalho_id_fkey" FOREIGN KEY ("centro_trabalho_id") REFERENCES "centro_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucao_planejamento" ADD CONSTRAINT "execucao_planejamento_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucao_step_log" ADD CONSTRAINT "execucao_step_log_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_resultado" ADD CONSTRAINT "forecast_resultado_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_resultado" ADD CONSTRAINT "forecast_resultado_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_metrica" ADD CONSTRAINT "forecast_metrica_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_metrica" ADD CONSTRAINT "forecast_metrica_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_modelo" ADD CONSTRAINT "forecast_modelo_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_classification" ADD CONSTRAINT "sku_classification_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serie_temporal" ADD CONSTRAINT "serie_temporal_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_estoque" ADD CONSTRAINT "parametros_estoque_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_estoque" ADD CONSTRAINT "parametros_estoque_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_planejada" ADD CONSTRAINT "ordem_planejada_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_planejada" ADD CONSTRAINT "ordem_planejada_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_planejada" ADD CONSTRAINT "ordem_planejada_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_planejada" ADD CONSTRAINT "ordem_planejada_centro_trabalho_id_fkey" FOREIGN KEY ("centro_trabalho_id") REFERENCES "centro_trabalho"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga_capacidade" ADD CONSTRAINT "carga_capacidade_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_planejamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga_capacidade" ADD CONSTRAINT "carga_capacidade_centro_trabalho_id_fkey" FOREIGN KEY ("centro_trabalho_id") REFERENCES "centro_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_sistema" ADD CONSTRAINT "config_sistema_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
