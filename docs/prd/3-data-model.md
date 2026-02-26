# 3. Data Model

> All tables use UUID as primary key. Timestamps `created_at` and `updated_at` on all tables.

## 3.1 Registration Tables

### 3.1.1 `produto`

```sql
CREATE TABLE produto (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                    VARCHAR(50) NOT NULL UNIQUE,  -- SKU
    descricao                 VARCHAR(255) NOT NULL,
    tipo_produto              VARCHAR(20) NOT NULL,
      -- ENUM: 'ACABADO', 'SEMI_ACABADO', 'INSUMO', 'EMBALAGEM', 'MATERIA_PRIMA', 'REVENDA'
    categoria_id              UUID REFERENCES categoria(id),
    unidade_medida_id         UUID REFERENCES unidade_medida(id),
    peso_liquido_kg           NUMERIC(10,4),
    volume_m3                 NUMERIC(10,6),  -- For storage capacity calculation
    ativo                     BOOLEAN DEFAULT true,
    custo_unitario            NUMERIC(12,4),
    custo_pedido              NUMERIC(12,4),  -- Fixed cost per order (K in EOQ)
    custo_manutencao_pct_ano  NUMERIC(5,2) DEFAULT 25.00,  -- % cost/year for holding (h in EOQ)
    preco_venda               NUMERIC(12,4),
    politica_ressuprimento    VARCHAR(30) DEFAULT 'PONTO_PEDIDO',
      -- ENUM: 'PONTO_PEDIDO', 'MIN_MAX', 'REVISAO_PERIODICA', 'KANBAN'
    intervalo_revisao_dias    INTEGER,  -- If policy = REVISAO_PERIODICA
    lote_minimo               NUMERIC(12,4) DEFAULT 1,
    multiplo_compra           NUMERIC(12,4) DEFAULT 1,  -- e.g. only buy in multiples of 100
    estoque_seguranca_manual  NUMERIC(12,4),  -- Manual override (NULL = use system-calculated)
    lead_time_producao_dias   INTEGER,  -- For internally produced items
    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

`[RULE]` If `estoque_seguranca_manual IS NOT NULL`, the system does NOT automatically calculate safety stock for this product -- uses the manual value.

### 3.1.2 `categoria`

```sql
CREATE TABLE categoria (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(100) NOT NULL,
    descricao TEXT,
    pai_id    UUID REFERENCES categoria(id)  -- Hierarchy (self-referencing)
);
```

### 3.1.3 `unidade_medida`

```sql
CREATE TABLE unidade_medida (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla           VARCHAR(10) NOT NULL UNIQUE,  -- 'UN', 'KG', 'LT', 'CX', 'MT', 'M2', 'M3'
    nome            VARCHAR(50) NOT NULL,
    fator_conversao NUMERIC(12,6) DEFAULT 1  -- For unit conversions
);
```

### 3.1.4 `fornecedor`

```sql
CREATE TABLE fornecedor (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                VARCHAR(50) NOT NULL UNIQUE,
    razao_social          VARCHAR(255) NOT NULL,
    nome_fantasia         VARCHAR(255) NOT NULL,
    cnpj                  VARCHAR(18),  -- With digit validation
    email                 VARCHAR(255),
    telefone              VARCHAR(20),
    cidade                VARCHAR(100),
    estado                VARCHAR(2),
    lead_time_padrao_dias INTEGER NOT NULL,
    lead_time_min_dias    INTEGER,  -- For lead time sigma calculation
    lead_time_max_dias    INTEGER,
    confiabilidade_pct    NUMERIC(5,2) DEFAULT 90.00,  -- % on-time deliveries
    avaliacao             SMALLINT DEFAULT 3,  -- 1-5 stars
    ativo                 BOOLEAN DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.1.5 `produto_fornecedor` (N:N)

```sql
CREATE TABLE produto_fornecedor (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id       UUID NOT NULL REFERENCES produto(id),
    fornecedor_id    UUID NOT NULL REFERENCES fornecedor(id),
    lead_time_dias   INTEGER NOT NULL,
    preco_unitario   NUMERIC(12,4) NOT NULL,
    moq              NUMERIC(12,4) DEFAULT 1,  -- Minimum Order Quantity
    multiplo_compra  NUMERIC(12,4) DEFAULT 1,
    is_principal     BOOLEAN DEFAULT false,
    ultima_compra    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(produto_id, fornecedor_id)
);
```

`[RULE]` MRP uses the supplier with `is_principal = true` by default. If the primary supplier cannot fulfill (MOQ > need), falls back to the secondary supplier.

### 3.1.6 `bom` (Bill of Materials)

```sql
CREATE TABLE bom (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_pai_id    UUID NOT NULL REFERENCES produto(id),  -- Finished/semi-finished product
    produto_filho_id  UUID NOT NULL REFERENCES produto(id),  -- Input/component
    quantidade        NUMERIC(12,6) NOT NULL,  -- Qty of child per 1 unit of parent
    unidade_medida_id UUID REFERENCES unidade_medida(id),
    perda_percentual  NUMERIC(5,2) DEFAULT 0,  -- % process loss (scrap)
    nivel             SMALLINT NOT NULL,  -- BOM level (0=parent, 1, 2, ...)
    observacao        TEXT,
    ativo             BOOLEAN DEFAULT true,
    valido_desde      DATE,  -- Versioning
    valido_ate        DATE,  -- NULL = current
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

`[RULE]` **Loss calculation:** `Required qty = BOM_qty x Parent_qty / (1 - loss/100)`
Example: BOM says 0.15 KG of butter with 2% loss -> For 1000 cookies: `0.15 x 1000 / (1 - 0.02) = 153.06 KG`

### 3.1.7 `inventario_atual`

```sql
CREATE TABLE inventario_atual (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id               UUID NOT NULL REFERENCES produto(id),
    deposito_id              UUID NOT NULL REFERENCES deposito(id),
    quantidade_disponivel    NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Available for use
    quantidade_reservada     NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Committed to orders
    quantidade_em_transito   NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Ordered, not yet received
    quantidade_em_quarentena NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Awaiting inspection/release
    quantidade_total         NUMERIC(12,4) GENERATED ALWAYS AS
        (quantidade_disponivel + quantidade_reservada + quantidade_em_quarentena) STORED,
    lote                     VARCHAR(50),
    data_validade            DATE,
    data_ultima_contagem     DATE,
    custo_medio_unitario     NUMERIC(12,4),
    valor_total_estoque      NUMERIC(14,4) GENERATED ALWAYS AS
        (quantidade_total * custo_medio_unitario) STORED,
    fonte_atualizacao        VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
      -- ENUM: 'MANUAL', 'ERP_SYNC', 'CONTAGEM', 'UPLOAD'
    updated_at               TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(produto_id, deposito_id, lote)
);
```

`[RULE]` **MRP uses available stock to calculate net requirement:**
```
Net requirement = Gross requirement
                - Available stock
                - Scheduled receipts (in transit)
                + Safety Stock
```

### 3.1.8 `deposito`

```sql
CREATE TABLE deposito (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                VARCHAR(50) NOT NULL UNIQUE,
    nome                  VARCHAR(100) NOT NULL,
    tipo                  VARCHAR(20) NOT NULL,
      -- ENUM: 'MATERIA_PRIMA', 'PRODUTO_ACABADO', 'WIP', 'EXPEDICAO', 'QUARENTENA'
    capacidade_m3         NUMERIC(10,2),  -- Volumetric capacity
    capacidade_posicoes   INTEGER,        -- Pallet/shelf positions
    capacidade_kg         NUMERIC(12,2),  -- Max weight capacity
    temperatura_min       NUMERIC(5,2),   -- If refrigerated
    temperatura_max       NUMERIC(5,2),
    endereco              TEXT,
    ativo                 BOOLEAN DEFAULT true
);
```

## 3.2 Production Capacity Tables

### 3.2.1 `centro_trabalho`

```sql
CREATE TABLE centro_trabalho (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                   VARCHAR(50) NOT NULL UNIQUE,
    nome                     VARCHAR(100) NOT NULL,
    tipo                     VARCHAR(20) NOT NULL,
      -- ENUM: 'PRODUCAO', 'EMBALAGEM', 'MONTAGEM', 'ACABAMENTO', 'CONTROLE_QUALIDADE'
    descricao                TEXT,
    capacidade_hora_unidades NUMERIC(10,2) NOT NULL,  -- Nominal capacity
    num_operadores           INTEGER,
    eficiencia_percentual    NUMERIC(5,2) NOT NULL DEFAULT 100,  -- Actual vs. nominal
    tempo_setup_minutos      NUMERIC(8,2) DEFAULT 0,  -- Setup between different products
    custo_hora               NUMERIC(10,2),
    ativo                    BOOLEAN DEFAULT true,
    observacoes              TEXT,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);
```

`[RULE]` **Effective capacity = Nominal capacity x Efficiency / 100**
Example: 200 un/hour x 92% = 184 un/hour effective

### 3.2.2 `turno`

```sql
CREATE TABLE turno (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centro_trabalho_id  UUID NOT NULL REFERENCES centro_trabalho(id),
    nome                VARCHAR(50) NOT NULL,  -- "1st Shift", "Night"
    hora_inicio         TIME NOT NULL,
    hora_fim            TIME NOT NULL,
    dias_semana         INTEGER[] NOT NULL,  -- [1,2,3,4,5] = Mon-Fri
    ativo               BOOLEAN DEFAULT true,
    valido_desde        DATE,
    valido_ate          DATE
);
```

### 3.2.3 `parada_programada`

```sql
CREATE TABLE parada_programada (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centro_trabalho_id  UUID NOT NULL REFERENCES centro_trabalho(id),
    tipo                VARCHAR(30) NOT NULL,
      -- ENUM: 'MANUTENCAO', 'FERIAS_COLETIVAS', 'SETUP', 'LIMPEZA', 'OUTRO'
    data_inicio         TIMESTAMPTZ NOT NULL,
    data_fim            TIMESTAMPTZ NOT NULL,
    motivo              TEXT,
    recorrente          BOOLEAN DEFAULT false,
    cron_expression     VARCHAR(100)  -- If recurrent
);
```

### 3.2.4 `evento_capacidade`

```sql
CREATE TABLE evento_capacidade (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centro_trabalho_id  UUID NOT NULL REFERENCES centro_trabalho(id),
    tipo                VARCHAR(30) NOT NULL,
      -- ENUM: 'NOVO_MAQUINARIO', 'QUEBRA', 'REPARO', 'MUDANCA_TURNO',
      --       'MUDANCA_EFICIENCIA', 'AUMENTO_CAPACIDADE', 'REDUCAO_CAPACIDADE'
    data_evento         TIMESTAMPTZ NOT NULL,
    campo_alterado      VARCHAR(50),
    valor_anterior      VARCHAR(100),
    valor_novo          VARCHAR(100),
    motivo              TEXT NOT NULL,
    previsao_resolucao  DATE,  -- Required if tipo = 'QUEBRA'
    usuario_id          UUID REFERENCES usuario(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

`[RULE]` When saving a capacity event, the system AUTOMATICALLY: (1) Recalculates available capacity for upcoming periods, (2) Re-runs CRP, (3) Generates alerts if planned orders were affected.

### 3.2.5 `roteiro_producao`

```sql
CREATE TABLE roteiro_producao (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id             UUID NOT NULL REFERENCES produto(id),
    centro_trabalho_id     UUID NOT NULL REFERENCES centro_trabalho(id),
    sequencia              SMALLINT NOT NULL,  -- Operation order
    operacao               VARCHAR(100) NOT NULL,  -- Step name
    tempo_setup_minutos    NUMERIC(8,2) DEFAULT 0,
    tempo_unitario_minutos NUMERIC(8,4) NOT NULL,
    tempo_espera_minutos   NUMERIC(8,2) DEFAULT 0,
    descricao              TEXT,
    ativo                  BOOLEAN DEFAULT true
);
```

### 3.2.6 `calendario_fabrica`

```sql
CREATE TABLE calendario_fabrica (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data             DATE NOT NULL UNIQUE,
    tipo             VARCHAR(20) NOT NULL,
      -- ENUM: 'UTIL', 'FERIADO', 'PONTO_FACULTATIVO', 'FERIAS_COLETIVAS', 'SABADO', 'DOMINGO'
    descricao        VARCHAR(100),
    horas_produtivas NUMERIC(4,2) DEFAULT 0  -- 0 for holidays, 8 for normal days
);
```

## 3.3 Result Tables

### 3.3.1 `execucao_planejamento`

```sql
CREATE TABLE execucao_planejamento (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo              VARCHAR(20) NOT NULL,  -- 'FORECAST', 'MRP', 'COMPLETO'
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
      -- 'PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'ERRO'
    gatilho           VARCHAR(20) NOT NULL,  -- 'MANUAL', 'AGENDADO', 'AUTO_INGESTAO'
    parametros        JSONB,
    resultado_resumo  JSONB,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    error_message     TEXT,
    created_by        UUID REFERENCES usuario(id),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3.2 `execucao_step_log`

```sql
CREATE TABLE execucao_step_log (
    id                BIGSERIAL PRIMARY KEY,
    execucao_id       UUID REFERENCES execucao_planejamento(id),
    step_name         VARCHAR(50) NOT NULL,
    step_order        SMALLINT NOT NULL,
    status            VARCHAR(20) NOT NULL,
    records_processed BIGINT,
    duration_ms       INTEGER,
    details           JSONB,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ
);
```

### 3.3.3 `forecast_resultado`

```sql
CREATE TABLE forecast_resultado (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id      UUID NOT NULL REFERENCES execucao_planejamento(id),
    produto_id       UUID NOT NULL REFERENCES produto(id),
    periodo          DATE NOT NULL,
    horizonte_semanas INTEGER NOT NULL,
    modelo_usado     VARCHAR(20) NOT NULL,  -- 'TFT', 'ETS', 'CROSTON', 'LGBM', 'ENSEMBLE'
    target_type      VARCHAR(15) NOT NULL,  -- 'VOLUME', 'FATURAMENTO'
    p10              NUMERIC(14,4),
    p25              NUMERIC(14,4),
    p50              NUMERIC(14,4),  -- Central forecast
    p75              NUMERIC(14,4),
    p90              NUMERIC(14,4),
    faturamento_p50  NUMERIC(14,4),  -- Volume P50 x price
    faturamento_p10  NUMERIC(14,4),
    faturamento_p90  NUMERIC(14,4)
);
```

### 3.3.4 `forecast_metrica`

```sql
CREATE TABLE forecast_metrica (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id     UUID NOT NULL REFERENCES execucao_planejamento(id),
    produto_id      UUID NOT NULL REFERENCES produto(id),
    modelo          VARCHAR(50) NOT NULL,
    mape            NUMERIC(8,4),
    mae             NUMERIC(12,4),
    rmse            NUMERIC(12,4),
    bias            NUMERIC(8,4),
    classe_abc      CHAR(1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3.5 `forecast_modelo`

```sql
CREATE TABLE forecast_modelo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id     UUID NOT NULL REFERENCES execucao_planejamento(id),
    tipo_modelo     VARCHAR(50) NOT NULL,
    versao          INTEGER NOT NULL,
    parametros      JSONB,
    metricas_treino JSONB,
    arquivo_path    VARCHAR(500),
    is_champion     BOOLEAN NOT NULL DEFAULT false,
    treinado_em     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3.6 `sku_classification`

```sql
CREATE TABLE sku_classification (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id               UUID NOT NULL REFERENCES produto(id) UNIQUE,
    classe_abc               CHAR(1) NOT NULL CHECK (classe_abc IN ('A', 'B', 'C')),
    classe_xyz               CHAR(1) NOT NULL CHECK (classe_xyz IN ('X', 'Y', 'Z')),
    padrao_demanda           VARCHAR(30) NOT NULL
                             CHECK (padrao_demanda IN ('REGULAR', 'INTERMITENTE', 'ERRATICO', 'LUMPY')),
    modelo_forecast_sugerido VARCHAR(50),
    percentual_receita       NUMERIC(6,4),
    cv_demanda               NUMERIC(6,4),
    calculado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3.7 `serie_temporal`

```sql
CREATE TABLE serie_temporal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id      UUID NOT NULL REFERENCES produto(id),
    data_referencia DATE NOT NULL,
    granularidade   VARCHAR(10) NOT NULL DEFAULT 'semanal'
                    CHECK (granularidade IN ('diario', 'semanal', 'mensal')),
    volume          NUMERIC(14,4) NOT NULL DEFAULT 0,
    receita         NUMERIC(14,4) NOT NULL DEFAULT 0,
    fonte           VARCHAR(30),
    qualidade       NUMERIC(4,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(produto_id, data_referencia, granularidade)
);
```

### 3.3.8 `parametros_estoque`

```sql
CREATE TABLE parametros_estoque (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id         UUID NOT NULL REFERENCES execucao_planejamento(id),
    produto_id          UUID NOT NULL REFERENCES produto(id),
    safety_stock        NUMERIC(12,4),
    reorder_point       NUMERIC(12,4),
    estoque_minimo      NUMERIC(12,4),
    estoque_maximo      NUMERIC(12,4),
    eoq                 NUMERIC(12,4),
    dias_cobertura_atual NUMERIC(8,2),
    metodo_calculo      VARCHAR(20),  -- 'TFT_QUANTIL', 'FORMULA_CLASSICA', 'MONTE_CARLO'
    nivel_servico_usado NUMERIC(5,4),
    calculated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3.9 `ordem_planejada`

```sql
CREATE TABLE ordem_planejada (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id                UUID NOT NULL REFERENCES execucao_planejamento(id),
    produto_id                 UUID NOT NULL REFERENCES produto(id),
    tipo                       VARCHAR(10) NOT NULL,  -- 'COMPRA', 'PRODUCAO'
    quantidade                 NUMERIC(12,4) NOT NULL,
    data_necessidade           DATE NOT NULL,  -- When material is needed
    data_liberacao             DATE NOT NULL,  -- When order must be placed
    data_recebimento_esperado  DATE NOT NULL,  -- data_liberacao + lead_time
    fornecedor_id              UUID REFERENCES fornecedor(id),  -- If tipo = COMPRA
    centro_trabalho_id         UUID REFERENCES centro_trabalho(id),  -- If tipo = PRODUCAO
    custo_estimado             NUMERIC(14,4),
    lotificacao_usada          VARCHAR(20),  -- 'L4L', 'EOQ', 'SILVER_MEAL', 'WAGNER_WHITIN'
    prioridade                 VARCHAR(10) NOT NULL,  -- 'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'
    status                     VARCHAR(15) DEFAULT 'PLANEJADA',
      -- 'PLANEJADA', 'FIRME', 'LIBERADA', 'CANCELADA'
    mensagem_acao              VARCHAR(100),  -- 'NOVA', 'ANTECIPAR 2 SEM', 'CANCELAR', etc.
    motivo                     VARCHAR(100),  -- Origin: forecast, firm order, SS
    observacao                 TEXT
);
```

`[RULE]` **Priorities:**
- `CRITICA`: current stock < 0 (already in stockout)
- `ALTA`: current stock < safety stock
- `MEDIA`: projected stock will fall below ROP within horizon
- `BAIXA`: preventive replenishment

### 3.3.10 `carga_capacidade`

```sql
CREATE TABLE carga_capacidade (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id                 UUID NOT NULL REFERENCES execucao_planejamento(id),
    centro_trabalho_id          UUID NOT NULL REFERENCES centro_trabalho(id),
    periodo                     DATE NOT NULL,
    capacidade_disponivel_horas NUMERIC(8,2),
    carga_planejada_horas       NUMERIC(8,2),
    utilizacao_percentual       NUMERIC(5,2),
    sobrecarga                  BOOLEAN DEFAULT false,
    horas_excedentes            NUMERIC(8,2) DEFAULT 0,
    sugestao                    VARCHAR(50)
      -- 'OK', 'HORA_EXTRA', 'ANTECIPAR', 'SUBCONTRATAR'
);
```

`[RULE]` **Overload suggestions:**
- Utilization <= 100%: sugestao = 'OK'
- Overload <= 10%: sugestao = 'HORA_EXTRA'
- Overload 10-30%: sugestao = 'ANTECIPAR'
- Overload > 30%: sugestao = 'SUBCONTRATAR'

## 3.4 Configuration Tables

```sql
CREATE TABLE config_sistema (
    chave       VARCHAR(100) PRIMARY KEY,
    valor       JSONB NOT NULL,
    descricao   TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_by  UUID
);

-- Initial configuration (seed):
-- 'forecast.horizonte_semanas': 13
-- 'forecast.granularidade': 'semanal'
-- 'forecast.nivel_servico_classe_a': 0.97
-- 'forecast.nivel_servico_classe_b': 0.93
-- 'forecast.nivel_servico_classe_c': 0.85
-- 'mrp.lotificacao_padrao': 'EOQ'
-- 'mrp.considerar_capacidade': true
-- 'automacao.email.ativo': true
-- 'automacao.email.horario_verificacao': '06:00'
```

## 3.5 System Tables

### 3.5.1 `usuario`

```sql
CREATE TABLE usuario (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    nome        VARCHAR(150) NOT NULL,
    senha_hash  VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
    ativo       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`[RULE]` The `usuario` table supports JWT authentication (FR-006) and RBAC. Role hierarchy: `admin` > `manager` > `operator` > `viewer`. All audit fields (`created_by`, `usuario_id`) reference this table.

---
