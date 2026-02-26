# PRD -- ForecastingMRP (Formalized)

## Metadata

| Field | Value |
|-------|-------|
| **Project** | ForecastingMRP -- Industrial Forecasting + MRP/MRP II + BI System |
| **Version** | 2.1 (Architecture-driven update from v2.0) |
| **Date** | February 2026 |
| **Original Author** | Icaro |
| **Formalized By** | Morgan (PM Agent, Synkra AIOS) |
| **Status** | Authoritative Reference |
| **Source** | `PRD.md` (root, v1.0, 1314 lines) + `docs/project-brief.md` (v1.0) |
| **Target Audience** | Development agents (Claude Code), stakeholders, QA |

**Conventions:**
- `[MUST]` -- Feature essential, cannot be skipped (maps to original `[OBRIGATORIO]`)
- `[SHOULD]` -- Feature desirable, may be deferred to later phase (maps to original `[OPCIONAL]`)
- `[RULE]` -- Business rule that must be implemented exactly as described (maps to original `[REGRA]`)
- Pseudocode blocks are logic references, not final code
- All requirement IDs (`FR-xxx`, `NFR-xxx`, `CON-xxx`) are immutable once assigned

---

## 1. Vision & Problem Statement

### 1.1 Problem

Uma industria recebe dados operacionais diarios (movimentacoes de estoque, faturamento, inventario) mas toma decisoes de compra e producao com base em feeling, sem previsibilidade. Isso gera excesso de estoque de alguns itens e falta de outros, compras reativas em vez de planejadas, e planejamento financeiro cego.

**Pain Points (from project brief):**

| Pain Point | Impact | Frequency |
|------------|--------|-----------|
| **Gut-feeling purchasing** | Excess inventory of slow movers, stockouts of fast movers | Every purchase cycle |
| **Reactive procurement** | Emergency orders at premium prices, production line stoppages | Weekly |
| **Blind financial planning** | Revenue forecasts that miss by 20-40%, budget overruns | Monthly/Quarterly |
| **Disconnected data** | Inventory data in one system, sales in another, capacity in spreadsheets | Continuous |
| **Manual daily routines** | 2-3 hours/day spent collecting, reconciling, and reporting data | Daily |
| **No capacity validation** | Production plans that are physically impossible to execute | Each planning cycle |

### 1.2 Solution

Sistema integrado que automatiza o ciclo completo: ingestao de dados -> previsao de demanda com IA -> planejamento de materiais (MRP) -> validacao de capacidade (MRP II) -> recomendacoes de compra acionaveis -> dashboards de BI.

### 1.3 Components and Justifications

| # | Component | Purpose | Problem Solved |
|---|-----------|---------|----------------|
| 1 | **Forecasting (TFT + ETS + Croston)** | AI-driven demand forecasting by SKU with confidence intervals (P10-P90) | Gut-feeling purchasing -> excess or shortage |
| 2 | **Revenue Forecasting** | Financial projections by period, family, category, and total | Blind financial planning |
| 3 | **MRP Engine** | Multi-level BOM explosion, planned purchase and production orders with exact dates and quantities | Reactive procurement, production stoppages |
| 4 | **MRP II (CRP)** | Production and storage capacity validation against real factory constraints | Infeasible production plans |
| 5 | **Purchasing Panel** | "What to buy, how much, from whom, when to order, when it arrives" | Purchase decisions without data |
| 6 | **BI Dashboards** | Executive, operational, and analytical views | No operational visibility |
| 7 | **Ingestion Automation** | Daily automated feed via email, ERP, or upload | Stale data = wrong decisions |

### 1.4 Target Users

**Primary Users:**

| Segment | Profile | Key Needs | Usage Frequency |
|---------|---------|-----------|-----------------|
| **Purchasing Manager** | Makes daily/weekly buying decisions. Currently relies on ERP stock reports and personal experience. | Actionable purchase recommendations with quantities, suppliers, dates, and costs. Urgency prioritization. | Daily |
| **Production Planner** | Schedules production across work centers. Juggles capacity constraints manually. | Feasible production schedule validated against capacity. Overload alerts with resolution suggestions. | Daily |
| **Operations Director** | Oversees manufacturing operations. Needs visibility into inventory health, forecast accuracy, and capacity utilization. | Executive dashboard with KPIs, alerts, and trend analysis. Morning briefing email. | Daily (dashboard), Weekly (deep analysis) |

**Secondary Users:**

| Segment | Profile | Key Needs | Usage Frequency |
|---------|---------|-----------|-----------------|
| **Financial Controller** | Builds revenue forecasts and budgets. Currently uses spreadsheet models. | Revenue forecasting by period, category, and product family. Confidence intervals for scenario planning. | Weekly/Monthly |
| **Inventory Analyst** | Manages stock levels, performs cycle counts, monitors ABC classification. | Inventory health metrics, coverage days, ABC/XYZ classification, stockout risk alerts. | Daily |
| **IT/Systems Admin** | Configures integrations, manages data pipelines, troubleshoots ingestion failures. | System configuration, automation monitoring, ERP connector setup, error handling. | As needed |

### 1.5 Goals & Success Metrics

**Business Objectives:**

| Objective | Metric | Target | Timeline |
|-----------|--------|--------|----------|
| Reduce stockouts | % of SKUs in stockout | < 2% (class A), < 5% (class B), < 10% (class C) | 6 months post-launch |
| Reduce excess inventory | Inventory turns per year | > 8x (class A), > 5x (class B), > 3x (class C) | 6 months post-launch |
| Improve forecast accuracy | MAPE (volume) | < 10% (A), < 20% (B), < 35% (C) | 3 months post-training |
| Eliminate reactive purchasing | % of emergency orders | Reduce by 70% from baseline | 6 months post-launch |
| Automate daily planning | Daily processing time | < 15 min (ingestion + forecast + MRP) | Immediate (Phase 4) |

**KPIs (SMART):**

1. **Forecast Accuracy (MAPE):** Achieve class-A MAPE below 10% within 12 weeks of TFT model deployment, measured via weekly backtesting against the 13-week rolling window.
2. **Fill Rate (OTIF):** Achieve On-Time-In-Full delivery rate above 97% for class A products within 6 months of full MRP deployment, measured by comparing planned vs. actual deliveries.
3. **Inventory Value Optimization:** Reduce total inventory carrying cost by 15% within 6 months post-launch while maintaining service levels, measured by monthly inventory valuation reports.
4. **System Availability:** Maintain 99.5% uptime for the daily automated pipeline, measured by monitoring the 06:00 daily pipeline execution success rate.
5. **Revenue Forecast Accuracy:** Achieve monthly revenue forecast accuracy within 12% MAPE for class A products within 3 months of dual-model deployment.

---

## 2. Architecture Overview

### 2.1 Layer Diagram

```
DATA SOURCES
  Email de Fechamento de Caixa | Relatorios do ERP | Upload Manual | Inventario Diario
                    |
                    v
AUTOMATION & INGESTION LAYER
  Email Listener (IMAP/Gmail API) -> ETL Pipeline -> Parse -> Map -> Validate -> Clean -> Grade -> Classify
  ERP Connector (API/DB/SFTP)
  File Processor (Upload UI)
                    |
                    v
DATA LAYER (PostgreSQL 16)
  Clean Data (time series) | Master Data (SKU, BOM, suppliers) |
  Current Inventory (actual position) | Production Capacity (work centers, shifts) |
  Results (forecast, MRP, orders)
                    |
                    v
CALCULATION LAYER
  +-- Forecasting Engine (FastAPI + Python) ----------------------------------+
  |  TFT Volume | TFT Revenue | ETS Holt-Winters |                           |
  |  Croston/TSB | LightGBM | Ensemble                                       |
  +--------------------------------------------------------------------------+
  +-- MRP/MRP II Engine (NestJS) ----------------------------------------------+
  |  MPS (Master Schedule) | Multi-level BOM Explosion |                      |
  |  SS/ROP/Min/Max | EOQ/Silver-Meal/Wagner-Whitin |                         |
  |  CRP Capacity | Purchase Order Generator                                  |
  +--------------------------------------------------------------------------+
                    |
                    v
PRESENTATION LAYER (Next.js 14)
  Executive Dashboard & BI | Forecast & Revenue Dashboard |
  Inventory & MRP Dashboard | Purchasing Panel | Capacity Panel |
  Master Data | Inventory | Config & Admin | Automation
```

### 2.2 Service Communication

```
Frontend (Next.js 14)
    |
    |  REST (JSON) -- CRUD and queries
    |  WebSocket -- real-time job progress
    |
    v
Backend (NestJS)
    |
    +-- REST sync ----------------------> FastAPI (fast queries: predict)
    |
    +-- BullMQ (Redis) -----------------> FastAPI (long jobs: train)
    |   - Job "train_model" -> Python Worker consumes
    |   - Job "run_forecast" -> Python Worker consumes
    |   - Progress events via Redis pub/sub -> WebSocket -> Frontend
    |
    +-- PostgreSQL <--------------------- Both read/write
```

#### 2.2.1 WebSocket Event Schemas

| Event | Direction | Payload Schema |
|-------|-----------|----------------|
| `job:progress` | Server → Client | `{ jobId: string, step: number, totalSteps: number, stepName: string, processed: number, total: number, percent: number }` |
| `job:completed` | Server → Client | `{ jobId: string, duration: number, results_summary: object }` |
| `job:failed` | Server → Client | `{ jobId: string, error: string, step: number }` |
| `alert:new` | Server → Client | `{ type: string, severity: 'info' \| 'warning' \| 'critical', message: string, entity_id: string }` |

### 2.3 Tech Stack

| Technology | Usage | Justification |
|------------|-------|---------------|
| **Next.js 14 (App Router)** | Frontend | SSR for dashboards, Server Components for heavy queries, React Server Actions for simple mutations |
| **Tailwind CSS + Shadcn/UI** | Styling | High-quality components without lock-in (copy-paste, not dependency) |
| **Apache ECharts** | BI Charts | Supports heatmaps, Gantt, Sankey, treemaps, 3D -- required for industrial BI |
| **NestJS (TypeScript)** | Main Backend | Modular, typed, dependency injection, guards for auth, interceptors for logging |
| **FastAPI (Python)** | Forecasting Microservice | Native ML ecosystem access (PyTorch, scikit-learn, statsmodels). Async by default |
| **PostgreSQL 16** | Main Database | JSONB, window functions for ABC, recursive CTEs for BOM, TimescaleDB if needed |
| **Redis + BullMQ** | Queues and Cache | Async training jobs with retry, progress tracking, dead letter queue |
| **Docker + Docker Compose** | Local Dev | Reproducible environment. All services containerized |
| **AWS EKS (via CDK)** | Production | GPU Spot Instances for model training |
| **Turborepo** | Monorepo | Shared types and build orchestration across frontend, backend, and ML services |

### 2.4 Architecture Pattern

- **Microservices** with clear boundaries: NestJS handles business logic and orchestration; FastAPI handles ML workloads exclusively.
- **Communication:** REST (sync CRUD/queries) + BullMQ/Redis (async long-running jobs like model training) + WebSocket (real-time job progress to frontend).
- **Database:** Single PostgreSQL instance with well-defined schema; all services read/write to the same database (shared database pattern for Phase 0-3, with potential to split later).

---

## 3. Data Model

> All tables use UUID as primary key. Timestamps `created_at` and `updated_at` on all tables.

### 3.1 Registration Tables

#### 3.1.1 `produto`

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

#### 3.1.2 `categoria`

```sql
CREATE TABLE categoria (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(100) NOT NULL,
    descricao TEXT,
    pai_id    UUID REFERENCES categoria(id)  -- Hierarchy (self-referencing)
);
```

#### 3.1.3 `unidade_medida`

```sql
CREATE TABLE unidade_medida (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla           VARCHAR(10) NOT NULL UNIQUE,  -- 'UN', 'KG', 'LT', 'CX', 'MT', 'M2', 'M3'
    nome            VARCHAR(50) NOT NULL,
    fator_conversao NUMERIC(12,6) DEFAULT 1  -- For unit conversions
);
```

#### 3.1.4 `fornecedor`

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

#### 3.1.5 `produto_fornecedor` (N:N)

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

#### 3.1.6 `bom` (Bill of Materials)

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

#### 3.1.7 `inventario_atual`

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

#### 3.1.8 `deposito`

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

### 3.2 Production Capacity Tables

#### 3.2.1 `centro_trabalho`

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

#### 3.2.2 `turno`

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

#### 3.2.3 `parada_programada`

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

#### 3.2.4 `evento_capacidade`

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

#### 3.2.5 `roteiro_producao`

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

#### 3.2.6 `calendario_fabrica`

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

### 3.3 Result Tables

#### 3.3.1 `execucao_planejamento`

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

#### 3.3.2 `execucao_step_log`

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

#### 3.3.3 `forecast_resultado`

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

#### 3.3.4 `forecast_metrica`

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

#### 3.3.5 `forecast_modelo`

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

#### 3.3.6 `sku_classification`

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

#### 3.3.7 `serie_temporal`

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

#### 3.3.8 `parametros_estoque`

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

#### 3.3.9 `ordem_planejada`

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

#### 3.3.10 `carga_capacidade`

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

### 3.4 Configuration Tables

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

### 3.5 System Tables

#### 3.5.1 `usuario`

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

## 4. Functional Requirements

### 4.1 Epic 0 -- Infrastructure Setup (FR-001 to FR-005)

#### FR-001: Monorepo Scaffold
- **Description:** Create monorepo structure using Turborepo with three apps: web (Next.js 14), api (NestJS), forecast-engine (FastAPI).
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - Turborepo configured with shared packages
  - All three apps scaffold in place
  - Shared TypeScript types package

#### FR-002: Docker Compose Environment
- **Description:** Configure Docker Compose with all services: PostgreSQL 16, Redis, NestJS, FastAPI, Next.js.
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - `docker-compose up` starts all services
  - Services can communicate with each other
  - Volumes for data persistence

#### FR-003: Database Schema (Registration Tables)
- **Description:** Create initial PostgreSQL schema with all registration tables as defined in Section 3 (produto, categoria, unidade_medida, fornecedor, produto_fornecedor, bom, inventario_atual, deposito, centro_trabalho, turno, parada_programada, evento_capacidade, roteiro_producao, calendario_fabrica, config_sistema, execucao_planejamento, execucao_step_log, forecast_resultado, parametros_estoque, ordem_planejada, carga_capacidade, usuario, forecast_metrica, forecast_modelo, sku_classification, serie_temporal).
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - All tables created with correct types, constraints, and relationships
  - UUID primary keys on all tables
  - Generated columns work correctly (inventario_atual)

#### FR-004: CI/CD Pipeline
- **Description:** Configure GitHub Actions pipeline with build, lint, and test stages.
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - Pipeline triggers on push and PR
  - Build, lint, and test stages pass
  - Failure blocks merge

#### FR-005: Synthetic Seed Data
- **Description:** Create seed data for development with realistic synthetic records for all registration tables.
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - Products (500-5000 SKUs), suppliers, BOM structures, work centers, shifts, inventory positions
  - Data is coherent (BOM references valid products, etc.)
  - Seed script is repeatable

### 4.2 Epic 1 -- Foundation: Data Layer & CRUDs (FR-006 to FR-020)

#### FR-006: Authentication Module
- **Description:** JWT-based authentication with role-based access control (RBAC), guards on all NestJS endpoints.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - JWT login/refresh flow
  - Role-based guards (admin, manager, operator, viewer)
  - Input validation on all endpoints (DTOs with class-validator)

#### FR-007: Product CRUD
- **Description:** Full CRUD for products with paginated table, search, filters (type, category, status, ABC class), and bulk actions.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** As defined in Section 4.1 of original PRD (Dados Basicos, Dimensoes, Custos, Ressuprimento, Override groups)
- **Acceptance Criteria:**
  - Create, read, update, delete products
  - Paginated list with search and filters
  - All field groups implemented

#### FR-008: Product Mass Import
- **Description:** `[MUST]` Upload CSV/XLSX with all product fields. Downloadable template with examples.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - CSV and XLSX upload supported
  - Template download with sample data
  - Validation with error reporting (row-level errors)
  - Successful rows imported even if some fail

#### FR-009: BOM CRUD (Bill of Materials)
- **Description:** CRUD for BOM with tree visualization showing product hierarchy.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** Product parent (search by code/description), product child (search), quantity, unit of measure (inherited), loss percentage (0-100%, default 0), observation, valid from/to dates.
- **Acceptance Criteria:**
  - Tree visual interface showing hierarchy
  - Add/remove/edit BOM lines
  - Multi-level BOM display

#### FR-010: BOM Exploded Cost Display
- **Description:** `[MUST]` Display exploded cost in the BOM interface: sum cost of all components multiplied by BOM quantities.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - Exploded cost calculated and displayed in real-time
  - Multi-level cost roll-up
  - Includes loss percentage in calculation

#### FR-011: Supplier CRUD
- **Description:** Full CRUD for suppliers with registration fields and performance fields.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** Code, Razao Social, Nome Fantasia, CNPJ (with validation), Email, Phone, City, State, Lead time standard/min/max, Reliability (%), Rating (1-5 stars).
- **Acceptance Criteria:**
  - CNPJ validation with check digits
  - All fields implemented
  - Active/inactive toggle

#### FR-012: SKU-Supplier Linkage
- **Description:** Interface to associate multiple suppliers per product, defining for each: specific lead time, unit price, MOQ, purchase multiple, and whether it is the primary supplier.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - N:N relationship management UI
  - Primary supplier designation
  - All produto_fornecedor fields editable

#### FR-013: Work Center CRUD
- **Description:** Table and form for work centers with all fields from `centro_trabalho`.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** Code, Name, Type (PRODUCAO, EMBALAGEM, MONTAGEM, ACABAMENTO, CONTROLE_QUALIDADE), Capacity/hour, Efficiency (%), Operators, Setup time, Cost/hour.
- **Acceptance Criteria:**
  - Full CRUD with all fields
  - Effective capacity auto-calculated and displayed

#### FR-014: Shift Management
- **Description:** Shift management per work center with automatic capacity calculation display.
- **Priority:** MUST
- **Epic:** 1
- **`[MUST]`** Display automatic calculation: "Daily effective capacity (Mon-Fri): 16h x 184 un/h = 2,944 un"
- **Acceptance Criteria:**
  - Shifts linked to work centers
  - Days of week selection
  - Auto-calculated daily capacity displayed

#### FR-015: Scheduled Stops Management
- **Description:** List scheduled stops per work center with type, period, recurrence support via cron expression.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - CRUD for scheduled stops
  - Recurring stops via cron expression
  - "Next stops" display with day count

#### FR-016: Capacity Events Management
- **Description:** Chronological timeline of all capacity events with form for type, date, changed field, previous value (auto-filled), new value, reason, resolution forecast (required if QUEBRA).
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - Event timeline visualization
  - Auto-fill of previous value
  - Resolution forecast required for QUEBRA type

#### FR-017: Storage Capacity (Warehouse) Management
- **Description:** Warehouse/depot table with name, type, capacity, occupancy (%).
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - CRUD for depositos
  - Occupancy percentage display
  - Visual alerts when occupancy > 90%

#### FR-018: Inventory Management
- **Description:** Current inventory CRUD with search, filters (type, warehouse, status).
- **Priority:** MUST
- **Epic:** 1
- **Three update methods:**
  1. Spreadsheet upload (ERP stock position)
  2. Automatic ERP database sync
  3. Manual editing (for count adjustments)
- **Acceptance Criteria:**
  - All three update methods supported
  - Indicators: total stock value, items below ROP (with link), items above max (idle capital)

#### FR-019: Data Ingestion Pipeline (Basic)
- **Description:** Upload CSV/XLSX + mapping + basic ETL pipeline.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - File upload UI
  - Column mapping interface
  - ETL: parse -> map -> validate -> clean
  - Error reporting

#### FR-020: Automatic Classification (ABC, XYZ, Demand Pattern)
- **Description:** Automatic classification engine that runs on uploaded sales data and categorizes SKUs.
- **Priority:** MUST
- **Epic:** 1
- **Classification types:**
  - ABC (by revenue contribution)
  - XYZ (by demand variability)
  - Demand pattern (SMOOTH, ERRATIC, INTERMITTENT, LUMPY)
- **Acceptance Criteria:**
  - ABC classification with Pareto thresholds
  - XYZ classification by coefficient of variation
  - Demand pattern classification (>25% zeros = intermittent)
  - Results stored and displayed per SKU

### 4.3 Epic 2 -- Intelligence: Forecasting Engine (FR-021 to FR-033)

#### FR-021: FastAPI Microservice Setup
- **Description:** FastAPI microservice with training and prediction endpoints.
- **Priority:** MUST
- **Epic:** 2
- **Acceptance Criteria:**
  - FastAPI app with health check endpoint
  - Train and predict routes
  - Integration with PostgreSQL for data access

#### FR-022: Multi-Model Strategy Engine
- **Description:** `[RULE]` Automatic model selection based on SKU classification with user override capability.
- **Priority:** MUST
- **Epic:** 2
- **Model selection matrix:**

| SKU Classification | Primary Model | Fallback |
|-------------------|---------------|----------|
| SMOOTH + class A/B | TFT | LightGBM |
| SMOOTH + class C | ETS (Holt-Winters) | Naive |
| ERRATIC + class A/B | TFT | ETS |
| ERRATIC + class C | ETS | Naive |
| INTERMITTENT (any) | Croston/TSB | SBA |
| LUMPY (any) | TSB | Bootstrap |
| Insufficient data (<40 weeks) | Simple ETS | Naive |

- **Additionally:**
  - TFT Volume (target=volume) -> feeds MRP
  - TFT Revenue (target=revenue) -> feeds BI
  - Ensemble (TFT 0.6 + LightGBM 0.4) -> for class A SKUs

#### FR-023: TFT Model (Volume)
- **Description:** Temporal Fusion Transformer for volume forecasting on smooth/erratic class A/B SKUs with >= 52 weeks of data. Quantiles P10, P25, P50, P75, P90.
- **Priority:** MUST
- **Epic:** 2
- **Implementation:** PyTorch Forecasting (pytorch_forecasting.TemporalFusionTransformer)
- **Re-training:** Monthly or when MAPE degrades > 5 points
- **Inference:** Weekly (pre-trained model)
- **Hardware:** GPU for training, CPU for inference

#### FR-024: TFT Model (Revenue)
- **Description:** TFT trained with weekly revenue as target, includes price as observed variable. Same quantile outputs.
- **Priority:** MUST
- **Epic:** 2

#### FR-025: ETS Model (Holt-Winters)
- **Description:** ExponentialSmoothing from statsmodels for class C SKUs or insufficient TFT data.
- **Priority:** MUST
- **Epic:** 2
- **Implementation:** `statsmodels.tsa.holtwinters.ExponentialSmoothing`
- **Variants:** Additive or multiplicative (auto-selection by AIC)
- **Intervals:** Via simulation (1000 paths)

#### FR-026: Croston/TSB Model
- **Description:** For intermittent SKUs (>25% zeros) or lumpy demand.
- **Priority:** MUST
- **Epic:** 2
- **Implementation:** `statsforecast` or custom implementation
- **Croston:** Decomposes into inter-demand interval x demand size
- **TSB:** Improvement with exponential decay (better for obsolescence)
- **Intervals:** Via bootstrap

#### FR-027: Forecast Execution Pipeline
- **Description:** 10-step execution pipeline from data loading through MRP triggering.
- **Priority:** MUST
- **Epic:** 2
- **Steps:**
  1. Load clean data (weekly granularity)
  2. Segment by model (read sku_classification.modelo_forecast_sugerido)
  3. Execute TFT (volume + revenue, training or inference)
  4. Execute ETS (individual fit + predict per SKU)
  5. Execute Croston/TSB (individual fit + predict per SKU)
  6. Execute LightGBM (global model + ensemble for class A)
  7. Calculate forecast revenue (Volume P50 x expected_price)
  8. Calculate metrics (backtesting: train T-13, predict 13 weeks, compare)
  9. Save results (forecast_resultado, forecast_metrica, forecast_modelo)
  10. Trigger MRP (if configured for chaining)
- **Triggers:** Manual (button) | Scheduled (cron) | Automatic (post-ingestion)

#### FR-028: Revenue Forecasting -- Dual Approach
- **Description:** `[RULE]` System runs BOTH approaches and shows on dashboard.
- **Priority:** MUST
- **Epic:** 2
- **Approach A -- Indirect (Volume x Price):**
  ```
  forecast_revenue = forecast_volume.P50 x expected_price
  expected_price = 1. Current list price (if registered)
                   2. Or weighted average of last 3 months
                   3. Or last practiced price (forward fill)
  ```
- **Approach B -- Direct (TFT with target=revenue):**
  TFT model trained with weekly revenue as target. Includes price as observed variable.
- **Dashboard display:** Real revenue (past), Forecast A (blue line), Forecast B (green line), Confidence interval (gray band). When A and B diverge significantly -> attention flag (indicates mix/price change).

#### FR-029: Backtesting Pipeline
- **Description:** Automated backtesting with accuracy metrics.
- **Priority:** MUST
- **Epic:** 2
- **Metrics:** MAPE, MAE, RMSE per SKU and per class
- **Method:** Train with T-13, predict 13 weeks, compare with actual
- **Baseline comparison:** Against 12-week moving average

#### FR-030: NestJS-FastAPI Integration via BullMQ
- **Description:** Async job queue integration between NestJS orchestrator and FastAPI workers.
- **Priority:** MUST
- **Epic:** 2
- **Job types:** train_model, run_forecast
- **Features:** Progress events via Redis pub/sub -> WebSocket -> Frontend
- **Error handling:** Retry, dead letter queue

#### FR-031: Forecast Dashboard
- **Description:** Frontend dashboard for forecast visualization and analysis.
- **Priority:** MUST
- **Epic:** 2
- **Components:**
  1. SKU selector (search) + Period selector + Aggregation selector
  2. Main chart: historical actual + forecast P50 + P10-P90 bands
  3. Secondary chart: real revenue vs. indirect forecast (blue) vs. direct TFT (green)
  4. Metrics table: MAPE, MAE, RMSE, Bias per SKU
  5. Ranking: Top 10 SKUs with best and worst accuracy
  6. Variable importance: bar chart (from TFT)
  7. Baseline comparison: TFT vs. Moving Average vs. Holt-Winters

#### FR-032: Forecast Metrics Storage
- **Description:** Store forecast accuracy metrics per execution, per SKU, per class.
- **Priority:** MUST
- **Epic:** 2
- **Stored metrics:** MAPE, MAE, RMSE per SKU, aggregated per class (A, B, C)

#### FR-033: Model Metadata Storage
- **Description:** Store model metadata including version, parameters, training metrics, training date.
- **Priority:** MUST
- **Epic:** 2

### 4.4 Epic 3 -- MRP: Planning Engine (FR-034 to FR-049)

#### FR-034: Master Production Schedule (MPS)
- **Description:** Generate MPS from forecast + firm orders for finished products.
- **Priority:** MUST
- **Epic:** 3
- **`[RULE]`** `demand(t) = MAX(forecast_P50(t), firm_orders(t))` -- If firm order > forecast, use firm order (reality > prediction for short term). Firm order horizon: 2-4 weeks (configurable), beyond that: forecast only.

#### FR-035: Stock Parameter Calculation
- **Description:** Calculate SS, ROP, Min, Max, EOQ for all SKUs.
- **Priority:** MUST
- **Epic:** 3
- **`[RULE]`** If TFT available: `SS = P(service_level) - P50 of demand accumulated over lead time`
- **`[RULE]`** If TFT not available (classical formula): `SS = Z x sqrt(LT x sigma_d^2 + d_bar^2 x sigma_LT^2)`. Z = 1.88 (97%), 1.48 (93%), 1.04 (85%)
- **`[RULE]`** `ROP = d_bar x LT + SS`; `EOQ = sqrt(2 x D_annual x K / h)`; `Min = ROP`; `Max = d_bar x (LT + R) + SS` (R = review interval)

#### FR-036: Multi-Level BOM Explosion (Low-Level Coding)
- **Description:** MRP explosion processing level by level with low-level coding.
- **Priority:** MUST
- **Epic:** 3
- **`[RULE]`** If an item appears at multiple levels, use the HIGHEST level number.
- **Algorithm:**
  - Level 0 = finished products (no parent)
  - Process level by level (0, then 1, then 2...)
  - For each item, each period: calculate gross requirement, scheduled receipts, projected stock, net requirement
  - If projected stock < safety stock: generate planned order
  - Explode dependent demand to children: `dependent_demand(child, t-LT) += planned_order(parent, t) x BOM_qty / (1 - loss%)`

#### FR-037: Lot Sizing
- **Description:** Configurable lot sizing per SKU or per class.
- **Priority:** MUST
- **Epic:** 3
- **Methods:**
  - L4L (Lot-for-Lot): Qty = Net Requirement
  - EOQ: Qty = EOQ (rounded to purchase multiple). If need < EOQ, order full EOQ
  - Silver-Meal: Aggregate future needs while average cost/period decreases. Stop when average cost starts rising.
- **`[RULE]`** In ALL cases, apply constraints in order: (1) If Qty < lote_minimo -> Qty = lote_minimo, (2) If Qty % multiplo_compra != 0 -> round up, (3) If Qty < MOQ from supplier -> Qty = MOQ

#### FR-038: Planned Order Generation
- **Description:** Generate purchase and production orders from MRP results.
- **Priority:** MUST
- **Epic:** 3
- **Logic:**
  - If PURCHASED item (input, raw material, packaging): -> Purchase order. Supplier = primary supplier. Release date = need date - supplier lead time. Cost = qty x supplier unit price.
  - If PRODUCED item (finished, semi-finished): -> Production order. Work center = first center in production routing. Release date = need date - production lead time. Hours needed = (qty / capacity_hour) + setup time.

#### FR-039: Action Messages
- **Description:** Compare new plan with existing orders and generate actionable messages.
- **Priority:** MUST
- **Epic:** 3
- **Message types:**
  - Order exists but no longer needed -> "CANCEL OC-123"
  - Order exists but needs more -> "INCREASE OC-123 from 500 to 800"
  - Order exists but needs less -> "REDUCE OC-123 from 500 to 300"
  - Order exists but date changed -> "EXPEDITE OC-123 by 2 weeks"
  - Order does not exist and is needed -> "NEW purchase order"

#### FR-040: Capacity Requirements Planning (CRP)
- **Description:** Validate production capacity against planned orders (MRP II).
- **Priority:** MUST
- **Epic:** 3
- **Algorithm:** For each work center, each week: calculate planned load (sum of hours for all production orders), available capacity (sum of shift hours - scheduled stops - breakdown events), utilization percentage.
- **`[RULE]`** Overload thresholds: <= 110% = 'HORA_EXTRA', 110-130% = 'ANTECIPAR', > 130% = 'SUBCONTRATAR'

#### FR-041: Storage Capacity Validation
- **Description:** Validate projected inventory against warehouse storage capacity.
- **Priority:** MUST
- **Epic:** 3
- **Algorithm:** For each warehouse, each week: calculate projected volume = sum of (projected_stock x volume_m3) for each SKU. Occupancy = projected_volume / capacity_m3 x 100.
- **`[RULE]`** > 90%: ALERT with suggestions. > 95%: CRITICAL ALERT.

#### FR-042: Purchasing Panel
- **Description:** `[MUST]` The most actionable output of the system.
- **Priority:** MUST
- **Epic:** 3
- **Section "Urgent Actions" (next 7 days):** For each urgent item: SKU + description, Quantity to buy, Supplier (name + lead time), "Order by" (date), Expected receipt, Purchase reason, Estimated cost, Buttons: [Generate Order] [Postpone] [Change Qty]
- **Section "Summary by Supplier":** Grouped table with total items and value per supplier.
- **Total planned purchases (next 13 weeks)** with value.
- **Export to Excel** and **Send summary by email**.

#### FR-043: MRP Dashboard (Gantt)
- **Description:** Timeline Gantt of planned orders (purchase=blue, production=green).
- **Priority:** MUST
- **Epic:** 3

#### FR-044: MRP Detail Table
- **Description:** Detailed MRP table (SKU selector): Gross Requirement, Scheduled Receipts, Projected Stock, Net Requirement, Planned Orders per period.
- **Priority:** MUST
- **Epic:** 3

#### FR-045: Stock Projection Chart
- **Description:** Chart per SKU showing projected future stock vs. SS/ROP/Max lines.
- **Priority:** MUST
- **Epic:** 3

#### FR-046: Capacity Dashboard
- **Description:** Capacity visualization dashboard.
- **Priority:** MUST
- **Epic:** 3
- **Components:**
  1. Stacked bars per work center (load vs. capacity)
  2. Weekly heatmap: centers x weeks, colored by % utilization
  3. Event timeline: breakdowns, new machinery, shift changes
  4. Gauge of occupancy per warehouse + future projection
  5. Overload alerts with action suggestions

#### FR-047: Production Routing CRUD
- **Description:** CRUD for production routings linking products to work centers with operation sequence.
- **Priority:** MUST
- **Epic:** 3
- **Fields:** Product, work center, sequence, operation name, setup time, unit time, wait time, description.

#### FR-048: Factory Calendar Management
- **Description:** CRUD for factory calendar defining working days, holidays, and productive hours.
- **Priority:** MUST
- **Epic:** 3

#### FR-049: Net Requirement Calculation Engine
- **Description:** Core MRP net requirement calculation: `Net = Gross - Available Stock - Scheduled Receipts + Safety Stock`.
- **Priority:** MUST
- **Epic:** 3

### 4.5 Epic 4 -- Automation & BI (FR-050 to FR-063)

#### FR-050: Email Listener
- **Description:** Automated email monitoring for daily closing data.
- **Priority:** MUST
- **Epic:** 4
- **Option A -- Gmail API (recommended):** Service account on Google Cloud, OAuth2. Filters: from, subject ("Fechamento" OR "Relatorio diario"), has:attachment, after:date.
- **Option B -- IMAP (any provider):** Connect via imaplib (Python) or nodemailer (Node). Filter by sender + subject + date.
- **Option C -- Shared folder / SFTP:** Monitor folder (watch/polling) for new files.
- **Implementation as Worker:** NestJS `@Cron('0 6 * * *')` or BullMQ repeatable job at 06:00.
- **`[RULE]`** Retry: if fails, try 06:30, 07:00, 07:30. Dead letter: if fails 4x, alert admin by email.

#### FR-051: ERP Connector
- **Description:** Three integration options (configurable).
- **Priority:** MUST
- **Epic:** 4
- **Options:**
  1. **REST API**: endpoint + credentials + format -> GET /api/movimentacoes?data={yesterday}
  2. **Direct DB** (read-only): connection string -> incremental query WHERE data_movimento = CURRENT_DATE - 1
  3. **Exported CSV**: monitor export folder
- Regardless of method, ETL pipeline is the same: Raw data -> Staging -> Validation -> Cleaning -> clean data

#### FR-052: Daily Automated Pipeline
- **Description:** `[RULE]` Full automated daily pipeline: ingestion -> inference -> MRP -> alerts.
- **Priority:** MUST
- **Epic:** 4
- **Timeline:**
  ```
  06:00  Email Listener checks inbox
  06:01  Finds previous day's closing email
  06:02  Downloads attachment (CSV/XLSX/PDF)
  06:03  If PDF: OCR -> extract data -> convert to CSV
         If CSV/XLSX: process directly
  06:05  Apply saved mapping template
  06:06  Execute incremental ETL (new data only)
  06:10  Update inventory (if data available)
  06:11  Run incremental forecast (inference, not re-training)
  06:15  Run incremental MRP
  06:16  Check alerts (stockout, urgent purchases, overload, forecast deviation)
  06:17  Send daily summary email
  ```

#### FR-053: Daily Summary Email
- **Description:** `[MUST]` Automatically sent email containing: yesterday's closing (real vs. forecast revenue, volume sold, average ticket), stock alerts (SKUs below SS, SKUs approaching ROP), urgent purchases (total value and orders in next 7 days), capacity (utilization per work center with alerts), forecast accuracy (MAPE per class, last 4 weeks).
- **Priority:** MUST
- **Epic:** 4

#### FR-054: Executive Dashboard
- **Description:** Executive-level BI dashboard.
- **Priority:** MUST
- **Epic:** 4
- **KPI Cards at top:**
  - Monthly revenue (with % MoM)
  - Forecast Accuracy (with variation)
  - Inventory Turnover (with variation)
  - Fill Rate OTIF (with variation)
- **Main chart:** Real Revenue vs. Forecast (12 months past + 3 months projection), with P10-P90 bands.
- **Secondary charts:** Pareto ABC (clickable by class), Stock Coverage (heatmap: SKU x coverage days).
- **Active alerts:** SKUs in stockout, near ROP, overloaded centers, full warehouses.

#### FR-055: LightGBM Model
- **Description:** LightGBM as challenger to TFT for class A (ensemble), or when TFT fails.
- **Priority:** MUST
- **Epic:** 4
- **Implementation:** `lightgbm` with temporal feature engineering
- **Features:** Lags (1-52 weeks), rolling mean/std, calendar, price, promotions
- **Model type:** Global model (all SKUs together)

#### FR-056: Ensemble Model (Class A SKUs)
- **Description:** Combine TFT (weight 0.6) + LightGBM (weight 0.4), or weights optimized by cross-validation.
- **Priority:** MUST
- **Epic:** 4
- **Justification:** For high-value SKUs, combination reduces individual error risk.

#### FR-057: What-If Scenario Analysis
- **Description:** Slider-based forecast adjustments for scenario exploration.
- **Priority:** SHOULD
- **Epic:** 4

#### FR-058: Excel/PDF Export
- **Description:** Export capability for dashboards, reports, and purchasing panel.
- **Priority:** MUST
- **Epic:** 4

#### FR-059: Re-training Cycles
- **Description:** Automated re-training schedule management.
- **Priority:** MUST
- **Epic:** 4
- **Frequencies:**

| Frequency | Action | Expected Duration |
|-----------|--------|-------------------|
| **Daily** (automatic) | Ingestion, inference (no training), recalculate MRP, alerts | ~2 min |
| **Weekly** (automatic) | Compare forecast vs. actual, update MAPE, recalculate ABC/XYZ, stock parameters | ~10 min |
| **Monthly** (automatic) | Re-train ALL models, champion-challenger, accuracy report | ~30-60 min |
| **Manual** (when needed) | Structural change, atypical event, historical data correction | Variable |

#### FR-060: OCR for PDF Attachments
- **Description:** If email attachment is PDF, apply OCR to extract data and convert to CSV.
- **Priority:** SHOULD
- **Epic:** 4

#### FR-061: Ingestion Mapping Template
- **Description:** Saved column mapping templates for recurring data sources.
- **Priority:** MUST
- **Epic:** 4

#### FR-062: Alert System
- **Description:** Centralized alert system for stockouts, urgent purchases, capacity overloads, and forecast deviations.
- **Priority:** MUST
- **Epic:** 4

#### FR-063: Morning Briefing Email
- **Description:** Comprehensive morning briefing email sent automatically before workday begins.
- **Priority:** MUST
- **Epic:** 4

### 4.6 Epic 5 -- Refinement & Production (FR-064 to FR-076)

#### FR-064: Wagner-Whitin Lot Sizing
- **Description:** Optimal lot sizing algorithm (dynamic programming approach).
- **Priority:** SHOULD
- **Epic:** 5

#### FR-065: Monte Carlo Safety Stock (Class A)
- **Description:** Monte Carlo simulation for safety stock calculation on class A SKUs.
- **Priority:** SHOULD
- **Epic:** 5

#### FR-066: Champion-Challenger Model Selection
- **Description:** `[RULE]` Automated model comparison -- only promotes new model if it outperforms the incumbent.
- **Priority:** MUST
- **Epic:** 5

#### FR-067: Drift Detection and Auto-Retraining
- **Description:** Automatic detection of model drift and triggered retraining.
- **Priority:** MUST
- **Epic:** 5

#### FR-068: Manual Forecast Override
- **Description:** Allow users to manually override forecast values with audit logging.
- **Priority:** MUST
- **Epic:** 5

#### FR-069: BOM Versioning
- **Description:** Full BOM version management with valid_from/valid_to dates.
- **Priority:** MUST
- **Epic:** 5

#### FR-070: Historical Lead Time Tracking
- **Description:** Track actual lead times per supplier for lead time variance (sigma_LT) calculation.
- **Priority:** MUST
- **Epic:** 5

#### FR-071: PDF Management Reports
- **Description:** Generate PDF management reports for executive review.
- **Priority:** SHOULD
- **Epic:** 5

#### FR-072: Integration Testing
- **Description:** Comprehensive integration test suite covering all service boundaries.
- **Priority:** MUST
- **Epic:** 5

#### FR-073: Load Testing
- **Description:** Load testing to validate performance under expected volumes.
- **Priority:** MUST
- **Epic:** 5

#### FR-074: Production Deployment (AWS EKS)
- **Description:** Deploy to AWS EKS with GPU Spot Instances for model training, auto-scaling for inference.
- **Priority:** MUST
- **Epic:** 5

#### FR-075: User Activity Logging
- **Description:** Login analytics, page views, override logging for user metrics tracking.
- **Priority:** SHOULD
- **Epic:** 5

#### FR-076: System Configuration UI
- **Description:** Admin UI for managing config_sistema entries (forecast horizon, service levels, lot sizing defaults, automation settings).
- **Priority:** MUST
- **Epic:** 5

---

## 5. Non-Functional Requirements

### 5.1 Performance

#### NFR-001: Daily Pipeline Processing Time
- **Description:** Complete daily pipeline (ingestion + forecast inference + MRP) must finish in under 15 minutes.
- **Priority:** MUST
- **Target:** < 15 min
- **Measurement:** Pipeline execution log duration

#### NFR-002: Forecast Accuracy -- Volume (Class A)
- **Description:** Volume forecast MAPE for class A SKUs must be below 10%.
- **Priority:** MUST
- **Target:** MAPE < 10%
- **Measurement:** Weekly backtesting against 13-week rolling window

#### NFR-003: Forecast Accuracy -- Volume (Class B)
- **Description:** Volume forecast MAPE for class B SKUs must be below 20%.
- **Priority:** MUST
- **Target:** MAPE < 20%

#### NFR-004: Forecast Accuracy -- Volume (Class C)
- **Description:** Volume forecast MAPE for class C SKUs must be below 35%.
- **Priority:** MUST
- **Target:** MAPE < 35%

#### NFR-005: Forecast Accuracy -- Revenue (Class A)
- **Description:** Revenue forecast MAPE for class A products must be below 12%.
- **Priority:** MUST
- **Target:** MAPE < 12%

#### NFR-006: Forecast Accuracy -- Revenue (Class B)
- **Description:** Revenue forecast MAPE for class B products must be below 22%.
- **Priority:** MUST
- **Target:** MAPE < 22%

#### NFR-007: Fill Rate (OTIF) -- Class A
- **Description:** On-Time-In-Full delivery rate for class A products.
- **Priority:** MUST
- **Target:** > 97%

#### NFR-008: Fill Rate (OTIF) -- Class B
- **Description:** On-Time-In-Full delivery rate for class B products.
- **Priority:** MUST
- **Target:** > 93%

#### NFR-009: Fill Rate (OTIF) -- Class C
- **Description:** On-Time-In-Full delivery rate for class C products.
- **Priority:** MUST
- **Target:** > 85%

#### NFR-010: Inventory Turnover
- **Description:** Target inventory turns per year by class.
- **Priority:** MUST
- **Target:** > 8x/year (A), > 5x/year (B), > 3x/year (C)

#### NFR-011: Stockout Rate
- **Description:** Maximum percentage of SKUs in stockout by class.
- **Priority:** MUST
- **Target:** < 2% (A), < 5% (B), < 10% (C)

#### NFR-012: Safety Stock Accuracy
- **Description:** Actual coverage must meet or exceed defined service level.
- **Priority:** MUST
- **Target:** Real coverage >= defined service level

### 5.2 Availability & Reliability

#### NFR-013: System Availability
- **Description:** System uptime target.
- **Priority:** MUST
- **Target:** > 99.5%
- **Measurement:** Monitoring 06:00 daily pipeline execution success rate

#### NFR-014: Dead Letter Queue Handling
- **Description:** Failed jobs must be captured in dead letter queue for investigation.
- **Priority:** MUST

#### NFR-015: Retry Strategy
- **Description:** Email listener retries at 06:30, 07:00, 07:30 before dead letter.
- **Priority:** MUST

### 5.3 Security

#### NFR-016: JWT Authentication
- **Description:** JWT-based authentication on all API endpoints.
- **Priority:** MUST

#### NFR-017: Role-Based Access Control (RBAC)
- **Description:** Guards on all NestJS endpoints for authorization by role.
- **Priority:** MUST

#### NFR-018: Input Validation
- **Description:** Input validation on all API endpoints using DTOs with class-validator.
- **Priority:** MUST

#### NFR-019: CNPJ Validation
- **Description:** CNPJ validation with check digits on supplier records.
- **Priority:** MUST

#### NFR-020: Read-Only ERP Connector
- **Description:** ERP connector must never write to source ERP system.
- **Priority:** MUST

#### NFR-021: Environment-Based Secrets
- **Description:** Secrets managed via environment variables, never hardcoded.
- **Priority:** MUST

### 5.4 Scalability & Data

#### NFR-022: SKU Volume Support
- **Description:** System must support 500-5,000 active SKUs.
- **Priority:** MUST

#### NFR-023: Supplier Volume Support
- **Description:** System must support 50-500 suppliers.
- **Priority:** MUST

#### NFR-024: Historical Data Depth
- **Description:** Support 2-5 years of weekly historical data per SKU.
- **Priority:** MUST

#### NFR-025: Time Series Granularity
- **Description:** Weekly granularity aligned with MRP planning buckets.
- **Priority:** MUST

#### NFR-026: UUID Primary Keys
- **Description:** All tables use UUID primary keys for distributed-system compatibility.
- **Priority:** MUST

#### NFR-027: TimescaleDB Readiness
- **Description:** TimescaleDB extension available if time-series query performance requires it.
- **Priority:** SHOULD

### 5.5 Code Quality

#### NFR-028: Test Coverage
- **Description:** All CRUD APIs must pass unit and integration tests with > 80% code coverage.
- **Priority:** MUST
- **Target:** > 80% coverage

#### NFR-029: TypeScript Strict Mode
- **Description:** NestJS and Next.js projects must use TypeScript strict mode.
- **Priority:** MUST

---

## 6. Constraints

#### CON-001: GPU for TFT Training
- **Description:** GPU required for TFT model training (CPU sufficient for inference). Production needs GPU Spot Instances; dev can use CPU with smaller datasets.
- **Impact:** Infrastructure cost, training pipeline design

#### CON-002: Minimum Historical Data for TFT
- **Description:** Minimum 40 weeks of historical data per SKU for TFT. New SKUs fall back to ETS/Naive until enough data accumulates.
- **Impact:** Model selection, cold-start protocol

#### CON-003: Daily Pipeline Time Limit
- **Description:** Daily pipeline must complete in < 15 minutes. Constrains model complexity and batch sizes.
- **Impact:** Model architecture, batch processing design

#### CON-004: BOM Data Quality Dependency
- **Description:** BOM accuracy depends on manual entry or ERP data quality. Garbage-in-garbage-out risk on MRP outputs.
- **Impact:** MRP accuracy, data validation requirements

#### CON-005: Intermittent Demand TFT Exclusion
- **Description:** Intermittent demand SKUs (>25% zeros) cannot use TFT. Dedicated Croston/TSB path required.
- **Impact:** Model routing logic

#### CON-006: Docker Compose / AWS EKS Parity
- **Description:** Docker Compose for dev; AWS EKS for production. Must maintain parity between environments.
- **Impact:** DevOps, containerization strategy

#### CON-007: 22-Week Development Timeline
- **Description:** 22-week development roadmap across 6 phases. Sequential phase dependencies -- Phase 3 depends on Phase 2 output.
- **Impact:** Resource planning, risk management

#### CON-008: Single-Plant Operation
- **Description:** System designed for single-plant operation (one factory, one set of work centers). Multi-plant would require significant architecture changes.
- **Impact:** Data model, capacity planning scope

#### CON-009: Portuguese-Language UI
- **Description:** Portuguese-language UI is the primary requirement. Internationalization deferred to post-Phase 5.
- **Impact:** Frontend development, string management

#### CON-010: Single-Currency (BRL)
- **Description:** Single-currency operation (BRL). Multi-currency purchasing would require exchange rate management.
- **Impact:** Financial calculations, supplier management

#### CON-011: Tech Stack
- **Description:** Fixed technology stack as defined: Next.js 14, NestJS, FastAPI, PostgreSQL 16, Redis + BullMQ, Turborepo, Docker, AWS EKS.
- **Impact:** All development decisions

#### CON-012: Client Data Availability
- **Description:** Assumption that client has at least 1-2 years of historical sales data in exportable format. If invalid, forecasting models will underperform or require synthetic augmentation.
- **Impact:** Phase 2 forecasting quality

#### CON-013: Client ERP Export Capability
- **Description:** Assumption that client ERP can export daily data via at least one of: email, API, DB query, or file. Automation pipeline depends on at least one working data source.
- **Impact:** Phase 4 automation

---

## 7. Epic Breakdown

### Epic 0: Infrastructure Setup

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 0 |
| **Name** | Infrastructure Setup |
| **Phase** | Phase 0 -- Week 1 |
| **Objective** | Bootstrap the development environment with monorepo scaffold, Docker Compose, database schema, CI/CD pipeline, and synthetic seed data. |
| **FRs Included** | FR-001, FR-002, FR-003, FR-004, FR-005 |
| **Dependencies** | None (first epic) |
| **Estimated Stories** | 5 |

**Deliverables:**
- Monorepo (Turborepo) with Next.js 14, NestJS, FastAPI apps
- Docker Compose running all services with single command
- PostgreSQL 16 schema with all tables
- GitHub Actions CI/CD (build + lint + test)
- Synthetic seed data for development

---

### Epic 1: Foundation -- Data Layer & CRUDs

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 1 |
| **Name** | Foundation -- Data Layer & CRUDs |
| **Phase** | Phase 1 -- Weeks 2-5 |
| **Objective** | Implement authentication, all master data CRUD modules (products, BOM, suppliers, capacity, inventory), basic data ingestion pipeline, and automatic classification engine. |
| **FRs Included** | FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020 |
| **Dependencies** | Epic 0 (infrastructure must be in place) |
| **Estimated Stories** | 12 |

**Deliverables:**
- JWT auth module with RBAC
- Product CRUD with mass import (CSV/XLSX)
- BOM CRUD with tree visualization and exploded cost
- Supplier CRUD with SKU linkage
- Capacity management (work centers, shifts, stops, events, storage)
- Inventory management (CRUD + spreadsheet upload)
- Data ingestion pipeline (upload + mapping + ETL)
- Automatic ABC, XYZ, and demand pattern classification

---

### Epic 2: Intelligence -- Forecasting Engine

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 2 |
| **Name** | Intelligence -- Forecasting Engine |
| **Phase** | Phase 2 -- Weeks 6-9 |
| **Objective** | Implement the full multi-model forecasting engine (TFT, ETS, Croston/TSB), dual revenue forecasting, backtesting pipeline, NestJS-FastAPI integration, and forecast dashboard. |
| **FRs Included** | FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, FR-033 |
| **Dependencies** | Epic 1 (master data and classification must exist) |
| **Estimated Stories** | 10 |

**Critical Handoff Note:** The forecast output schema (`forecast_resultado` table) must be validated before Epic 3 begins. MRP engine consumes forecast output directly.

**Deliverables:**
- FastAPI microservice with train/predict endpoints
- TFT model (volume + revenue)
- ETS (Holt-Winters) fallback model
- Croston/TSB for intermittent demand
- 10-step forecast execution pipeline
- Dual revenue forecasting (indirect + direct)
- Backtesting with MAPE/MAE/RMSE
- NestJS-FastAPI BullMQ integration
- Forecast dashboard with confidence bands

---

### Epic 3: MRP -- Planning Engine

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 3 |
| **Name** | MRP -- Planning Engine |
| **Phase** | Phase 3 -- Weeks 10-13 |
| **Objective** | Implement complete MRP/MRP II engine including MPS generation, multi-level BOM explosion, lot sizing, capacity validation, and the purchasing panel as the primary actionable output. |
| **FRs Included** | FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-040, FR-041, FR-042, FR-043, FR-044, FR-045, FR-046, FR-047, FR-048, FR-049 |
| **Dependencies** | Epic 2 (forecast output feeds MRP input) |
| **Estimated Stories** | 12 |

**Deliverables:**
- MPS generation (forecast + firm orders)
- Stock parameter calculation (SS/ROP/EOQ/Min/Max)
- Multi-level BOM explosion with low-level coding
- Lot sizing (L4L, EOQ, Silver-Meal)
- Planned order generation (purchase + production)
- Action messages
- CRP capacity validation with overload suggestions
- Storage capacity validation
- Purchasing panel (most actionable output)
- MRP dashboard (Gantt, detail table, stock projection)
- Capacity dashboard (load bars, heatmap, event timeline)

---

### Epic 4: Automation & BI

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 4 |
| **Name** | Automation & BI |
| **Phase** | Phase 4 -- Weeks 14-17 |
| **Objective** | Implement fully automated daily pipeline (email listener, ERP connector, orchestration), executive BI dashboard, LightGBM/Ensemble models, what-if scenarios, and export capabilities. |
| **FRs Included** | FR-050, FR-051, FR-052, FR-053, FR-054, FR-055, FR-056, FR-057, FR-058, FR-059, FR-060, FR-061, FR-062, FR-063 |
| **Dependencies** | Epic 3 (full pipeline requires forecast + MRP operational) |
| **Estimated Stories** | 10 |

**Deliverables:**
- Email listener (Gmail API / IMAP)
- ERP connector (API / DB / SFTP)
- Automated daily pipeline (06:00 trigger through morning briefing)
- Daily summary email
- Executive BI dashboard (KPIs, revenue trends, Pareto, alerts)
- LightGBM model + Ensemble for class A
- What-if scenario analysis
- Excel/PDF export
- Re-training cycle management

---

### Epic 5: Refinement & Production

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 5 |
| **Name** | Refinement & Production |
| **Phase** | Phase 5 -- Weeks 18-22 |
| **Objective** | Production-grade optimization including advanced lot sizing, Monte Carlo safety stock, champion-challenger model selection, drift detection, BOM versioning, and AWS EKS deployment. |
| **FRs Included** | FR-064, FR-065, FR-066, FR-067, FR-068, FR-069, FR-070, FR-071, FR-072, FR-073, FR-074, FR-075, FR-076 |
| **Dependencies** | Epic 4 (all features operational; this epic refines and hardens) |
| **Estimated Stories** | 10 |

**Deliverables:**
- Wagner-Whitin optimal lot sizing
- Monte Carlo simulation for class A safety stock
- Champion-challenger automated model selection
- Drift detection and auto-retraining
- Manual forecast override with audit log
- BOM versioning
- Historical lead time tracking
- PDF management reports
- Integration and load testing
- AWS EKS production deployment with GPU Spot Instances

---

## 8. Business Rules Reference

This section consolidates ALL business rules for quick reference during development. These are preserved verbatim from the original PRD Section 12.

### Forecasting Rules

| ID | Rule |
|----|------|
| R-F01 | Model selection is automatic by ABC/XYZ classification but allows manual override |
| R-F02 | TFT re-trains monthly OR when MAPE degrades > 5 percentage points |
| R-F03 | Weekly inference uses pre-trained model (does not re-train) |
| R-F04 | Forecast revenue uses TWO approaches in parallel (indirect + direct TFT) |
| R-F05 | When the two revenue forecasts diverge significantly -> attention flag |
| R-F06 | SKUs with < 40 weeks of data use simple ETS, not TFT |
| R-F07 | Intermittent SKUs (> 25% zeros) use Croston/TSB, never TFT |

### MRP Rules

| ID | Rule |
|----|------|
| R-M01 | MPS: demand(t) = MAX(forecast_P50(t), firm_orders(t)) |
| R-M02 | Firm order horizon: 2-4 weeks (configurable) |
| R-M03 | Low-Level Coding: if item appears at multiple levels, use the HIGHEST |
| R-M04 | Loss calculation: Qty = BOM_qty x Parent_qty / (1 - loss/100) |
| R-M05 | Lot sizing respects: lote_minimo -> multiplo_compra -> MOQ (in this order) |
| R-M06 | Primary supplier first; if MOQ > need, use secondary |
| R-M07 | Priority: CRITICA (stockout) > ALTA (below SS) > MEDIA (projection < ROP) > BAIXA |

### Inventory Rules

| ID | Rule |
|----|------|
| R-E01 | If TFT available: SS = P(service_level) - P50 accumulated over LT |
| R-E02 | If TFT not available: SS = Z x sqrt(LT x sigma_d^2 + d_bar^2 x sigma_LT^2) |
| R-E03 | estoque_seguranca_manual IS NOT NULL -> use manual value, do not calculate |
| R-E04 | Z: 1.88 (97% class A), 1.48 (93% class B), 1.04 (85% class C) |

### Capacity Rules

| ID | Rule |
|----|------|
| R-C01 | Effective capacity = Nominal capacity x Efficiency / 100 |
| R-C02 | Daily capacity = Sum of active shift hours - stops - holidays |
| R-C03 | Capacity event -> automatically recalculate CRP |
| R-C04 | Overload <= 10%: overtime | 10-30%: expedite | > 30%: subcontract |
| R-C05 | Warehouse > 90%: alert | > 95%: critical alert |

### Automation Rules

| ID | Rule |
|----|------|
| R-A01 | Daily pipeline: ingestion -> inference -> MRP -> alerts |
| R-A02 | Email listener: retry 06:30, 07:00, 07:30. Dead letter after 4 failures |
| R-A03 | Monthly re-training: champion-challenger (only promotes if better) |
| R-A04 | Daily summary sent automatically with revenue, alerts, purchases, capacity |

---

## 9. Requirement Traceability Matrix

| Req ID | Description | Epic | Priority | Status |
|--------|-------------|------|----------|--------|
| FR-001 | Monorepo Scaffold (Turborepo) | Epic 0 | MUST | Pending |
| FR-002 | Docker Compose Environment | Epic 0 | MUST | Pending |
| FR-003 | Database Schema (all tables incl. usuario, forecast_metrica, forecast_modelo, sku_classification, serie_temporal) | Epic 0 | MUST | Pending |
| FR-004 | CI/CD Pipeline (GitHub Actions) | Epic 0 | MUST | Pending |
| FR-005 | Synthetic Seed Data | Epic 0 | MUST | Pending |
| FR-006 | Authentication Module (JWT + RBAC) | Epic 1 | MUST | Pending |
| FR-007 | Product CRUD | Epic 1 | MUST | Pending |
| FR-008 | Product Mass Import (CSV/XLSX) | Epic 1 | MUST | Pending |
| FR-009 | BOM CRUD (tree visualization) | Epic 1 | MUST | Pending |
| FR-010 | BOM Exploded Cost Display | Epic 1 | MUST | Pending |
| FR-011 | Supplier CRUD | Epic 1 | MUST | Pending |
| FR-012 | SKU-Supplier Linkage | Epic 1 | MUST | Pending |
| FR-013 | Work Center CRUD | Epic 1 | MUST | Pending |
| FR-014 | Shift Management | Epic 1 | MUST | Pending |
| FR-015 | Scheduled Stops Management | Epic 1 | MUST | Pending |
| FR-016 | Capacity Events Management | Epic 1 | MUST | Pending |
| FR-017 | Storage Capacity Management | Epic 1 | MUST | Pending |
| FR-018 | Inventory Management | Epic 1 | MUST | Pending |
| FR-019 | Data Ingestion Pipeline (basic) | Epic 1 | MUST | Pending |
| FR-020 | Automatic Classification (ABC/XYZ/demand) | Epic 1 | MUST | Pending |
| FR-021 | FastAPI Microservice Setup | Epic 2 | MUST | Pending |
| FR-022 | Multi-Model Strategy Engine | Epic 2 | MUST | Pending |
| FR-023 | TFT Model (Volume) | Epic 2 | MUST | Pending |
| FR-024 | TFT Model (Revenue) | Epic 2 | MUST | Pending |
| FR-025 | ETS Model (Holt-Winters) | Epic 2 | MUST | Pending |
| FR-026 | Croston/TSB Model | Epic 2 | MUST | Pending |
| FR-027 | Forecast Execution Pipeline | Epic 2 | MUST | Pending |
| FR-028 | Revenue Forecasting -- Dual Approach | Epic 2 | MUST | Pending |
| FR-029 | Backtesting Pipeline | Epic 2 | MUST | Pending |
| FR-030 | NestJS-FastAPI Integration (BullMQ) | Epic 2 | MUST | Pending |
| FR-031 | Forecast Dashboard | Epic 2 | MUST | Pending |
| FR-032 | Forecast Metrics Storage | Epic 2 | MUST | Pending |
| FR-033 | Model Metadata Storage | Epic 2 | MUST | Pending |
| FR-034 | Master Production Schedule (MPS) | Epic 3 | MUST | Pending |
| FR-035 | Stock Parameter Calculation (SS/ROP/EOQ) | Epic 3 | MUST | Pending |
| FR-036 | Multi-Level BOM Explosion | Epic 3 | MUST | Pending |
| FR-037 | Lot Sizing (L4L, EOQ, Silver-Meal) | Epic 3 | MUST | Pending |
| FR-038 | Planned Order Generation | Epic 3 | MUST | Pending |
| FR-039 | Action Messages | Epic 3 | MUST | Pending |
| FR-040 | CRP Capacity Validation | Epic 3 | MUST | Pending |
| FR-041 | Storage Capacity Validation | Epic 3 | MUST | Pending |
| FR-042 | Purchasing Panel | Epic 3 | MUST | Pending |
| FR-043 | MRP Dashboard (Gantt) | Epic 3 | MUST | Pending |
| FR-044 | MRP Detail Table | Epic 3 | MUST | Pending |
| FR-045 | Stock Projection Chart | Epic 3 | MUST | Pending |
| FR-046 | Capacity Dashboard | Epic 3 | MUST | Pending |
| FR-047 | Production Routing CRUD | Epic 3 | MUST | Pending |
| FR-048 | Factory Calendar Management | Epic 3 | MUST | Pending |
| FR-049 | Net Requirement Calculation Engine | Epic 3 | MUST | Pending |
| FR-050 | Email Listener | Epic 4 | MUST | Pending |
| FR-051 | ERP Connector | Epic 4 | MUST | Pending |
| FR-052 | Daily Automated Pipeline | Epic 4 | MUST | Pending |
| FR-053 | Daily Summary Email | Epic 4 | MUST | Pending |
| FR-054 | Executive Dashboard | Epic 4 | MUST | Pending |
| FR-055 | LightGBM Model | Epic 4 | MUST | Pending |
| FR-056 | Ensemble Model (Class A) | Epic 4 | MUST | Pending |
| FR-057 | What-If Scenario Analysis | Epic 4 | SHOULD | Pending |
| FR-058 | Excel/PDF Export | Epic 4 | MUST | Pending |
| FR-059 | Re-training Cycles | Epic 4 | MUST | Pending |
| FR-060 | OCR for PDF Attachments | Epic 4 | SHOULD | Pending |
| FR-061 | Ingestion Mapping Template | Epic 4 | MUST | Pending |
| FR-062 | Alert System | Epic 4 | MUST | Pending |
| FR-063 | Morning Briefing Email | Epic 4 | MUST | Pending |
| FR-064 | Wagner-Whitin Lot Sizing | Epic 5 | SHOULD | Pending |
| FR-065 | Monte Carlo Safety Stock | Epic 5 | SHOULD | Pending |
| FR-066 | Champion-Challenger Model Selection | Epic 5 | MUST | Pending |
| FR-067 | Drift Detection and Auto-Retraining | Epic 5 | MUST | Pending |
| FR-068 | Manual Forecast Override | Epic 5 | MUST | Pending |
| FR-069 | BOM Versioning | Epic 5 | MUST | Pending |
| FR-070 | Historical Lead Time Tracking | Epic 5 | MUST | Pending |
| FR-071 | PDF Management Reports | Epic 5 | SHOULD | Pending |
| FR-072 | Integration Testing | Epic 5 | MUST | Pending |
| FR-073 | Load Testing | Epic 5 | MUST | Pending |
| FR-074 | Production Deployment (AWS EKS) | Epic 5 | MUST | Pending |
| FR-075 | User Activity Logging | Epic 5 | SHOULD | Pending |
| FR-076 | System Configuration UI | Epic 5 | MUST | Pending |
| NFR-001 | Daily Pipeline < 15 min | -- | MUST | Pending |
| NFR-002 | Forecast MAPE < 10% (Class A Volume) | -- | MUST | Pending |
| NFR-003 | Forecast MAPE < 20% (Class B Volume) | -- | MUST | Pending |
| NFR-004 | Forecast MAPE < 35% (Class C Volume) | -- | MUST | Pending |
| NFR-005 | Forecast MAPE < 12% (Class A Revenue) | -- | MUST | Pending |
| NFR-006 | Forecast MAPE < 22% (Class B Revenue) | -- | MUST | Pending |
| NFR-007 | Fill Rate > 97% (Class A) | -- | MUST | Pending |
| NFR-008 | Fill Rate > 93% (Class B) | -- | MUST | Pending |
| NFR-009 | Fill Rate > 85% (Class C) | -- | MUST | Pending |
| NFR-010 | Inventory Turnover Targets | -- | MUST | Pending |
| NFR-011 | Stockout Rate Targets | -- | MUST | Pending |
| NFR-012 | Safety Stock Accuracy | -- | MUST | Pending |
| NFR-013 | System Availability > 99.5% | -- | MUST | Pending |
| NFR-014 | Dead Letter Queue Handling | -- | MUST | Pending |
| NFR-015 | Retry Strategy | -- | MUST | Pending |
| NFR-016 | JWT Authentication | -- | MUST | Pending |
| NFR-017 | RBAC | -- | MUST | Pending |
| NFR-018 | Input Validation | -- | MUST | Pending |
| NFR-019 | CNPJ Validation | -- | MUST | Pending |
| NFR-020 | Read-Only ERP Connector | -- | MUST | Pending |
| NFR-021 | Environment-Based Secrets | -- | MUST | Pending |
| NFR-022 | SKU Volume Support (500-5000) | -- | MUST | Pending |
| NFR-023 | Supplier Volume Support (50-500) | -- | MUST | Pending |
| NFR-024 | Historical Data Depth (2-5 years) | -- | MUST | Pending |
| NFR-025 | Weekly Time Series Granularity | -- | MUST | Pending |
| NFR-026 | UUID Primary Keys | -- | MUST | Pending |
| NFR-027 | TimescaleDB Readiness | -- | SHOULD | Pending |
| NFR-028 | Test Coverage > 80% | -- | MUST | Pending |
| NFR-029 | TypeScript Strict Mode | -- | MUST | Pending |
| CON-001 | GPU for TFT Training | -- | MUST | Active |
| CON-002 | Min 40 Weeks Historical Data for TFT | -- | MUST | Active |
| CON-003 | Daily Pipeline < 15 min | -- | MUST | Active |
| CON-004 | BOM Data Quality Dependency | -- | MUST | Active |
| CON-005 | Intermittent Demand TFT Exclusion | -- | MUST | Active |
| CON-006 | Docker/EKS Environment Parity | -- | MUST | Active |
| CON-007 | 22-Week Timeline | -- | MUST | Active |
| CON-008 | Single-Plant Operation | -- | MUST | Active |
| CON-009 | Portuguese-Language UI | -- | MUST | Active |
| CON-010 | Single-Currency (BRL) | -- | MUST | Active |
| CON-011 | Fixed Tech Stack | -- | MUST | Active |
| CON-012 | Client Data Availability Assumption | -- | MUST | Active |
| CON-013 | Client ERP Export Capability Assumption | -- | MUST | Active |

---

## 10. Appendices

### Appendix A: Project Folder Structure

```
forecasting-mrp/
+-- apps/
|   +-- web/                          # Next.js 14 (frontend)
|   |   +-- app/
|   |   |   +-- (auth)/              # Login, registration
|   |   |   +-- dashboard/           # Executive dashboard
|   |   |   +-- forecast/            # Forecast screens
|   |   |   +-- mrp/                 # MRP screens
|   |   |   +-- compras/             # Purchasing panel
|   |   |   +-- cadastros/
|   |   |   |   +-- produtos/
|   |   |   |   +-- bom/
|   |   |   |   +-- fornecedores/
|   |   |   |   +-- capacidade/      # Work centers, shifts, events
|   |   |   +-- inventario/
|   |   |   +-- ingestao/            # Upload, mapping, ETL
|   |   |   +-- automacao/           # Email config, schedules
|   |   |   +-- config/              # System settings
|   |   +-- components/
|   |   |   +-- charts/              # ECharts wrappers
|   |   |   +-- tables/              # DataTables with filters
|   |   |   +-- forms/               # Reusable forms
|   |   +-- lib/                     # API client, utils
|   |
|   +-- api/                          # NestJS (main backend)
|   |   +-- src/
|   |   |   +-- auth/                # JWT, guards, roles
|   |   |   +-- produtos/            # Products CRUD
|   |   |   +-- bom/                 # BOM CRUD + explosion
|   |   |   +-- fornecedores/        # Suppliers CRUD
|   |   |   +-- capacidade/          # Work centers, shifts, events, calendar
|   |   |   +-- inventario/          # Stock position
|   |   |   +-- ingestao/            # Upload, mapping, ETL
|   |   |   +-- mrp/                 # Complete MRP engine
|   |   |   +-- forecast/            # Orchestration (calls FastAPI)
|   |   |   +-- automacao/           # Email listener, scheduler
|   |   |   +-- notificacao/         # Email, webhook
|   |   |   +-- common/              # Filters, interceptors, DTOs
|   |   +-- prisma/                  # Prisma Schema (ORM)
|   |
|   +-- forecast-engine/              # FastAPI (Python microservice)
|       +-- app/
|       |   +-- models/
|       |   |   +-- tft_trainer.py
|       |   |   +-- tft_predictor.py
|       |   |   +-- ets_model.py
|       |   |   +-- croston_model.py
|       |   |   +-- lightgbm_model.py
|       |   |   +-- ensemble.py
|       |   +-- etl/
|       |   |   +-- feature_engineering.py
|       |   |   +-- data_preparation.py
|       |   +-- metrics/
|       |   |   +-- accuracy.py
|       |   |   +-- backtesting.py
|       |   +-- routes/
|       |   |   +-- train.py
|       |   |   +-- predict.py
|       |   |   +-- metrics.py
|       |   +-- workers/
|       |       +-- training_worker.py
|       +-- models/                   # Trained models (.ckpt)
|       +-- requirements.txt
|
+-- packages/
|   +-- shared/                       # Shared TypeScript types
|
+-- docker-compose.yml
+-- docker-compose.prod.yml
+-- turbo.json
+-- README.md
```

### Appendix B: Forecasting Algorithm Details

#### B.1 Multi-Model Selection Matrix

| SKU Classification | Primary Model | Fallback | Condition |
|-------------------|---------------|----------|-----------|
| SMOOTH + class A/B | TFT | LightGBM | >= 52 weeks data |
| SMOOTH + class C | ETS (Holt-Winters) | Naive | Any data length |
| ERRATIC + class A/B | TFT | ETS | >= 52 weeks data |
| ERRATIC + class C | ETS | Naive | Any data length |
| INTERMITTENT (any) | Croston/TSB | SBA | > 25% zeros |
| LUMPY (any) | TSB | Bootstrap | > 25% zeros + high CV |
| Insufficient data | Simple ETS | Naive | < 40 weeks |

#### B.2 Safety Stock Formulas

**TFT-based (preferred):**
```
SS = P(service_level) - P50 of demand accumulated over lead time
```

**Classical formula (fallback):**
```
SS = Z x sqrt(LT x sigma_d^2 + d_bar^2 x sigma_LT^2)

Z values by class:
  Class A (97%): Z = 1.88
  Class B (93%): Z = 1.48
  Class C (85%): Z = 1.04
```

**Other stock parameters:**
```
ROP = d_bar x LT + SS
EOQ = sqrt(2 x D_annual x K / h)
Min = ROP
Max = d_bar x (LT + R) + SS    (R = review interval)
```

#### B.3 MRP Explosion Pseudocode

```
a) Assign level to each item:
   Level 0 = finished products (no parent)
   Level 1 = direct components of finished products
   Level N = components of components
   [RULE] If an item appears at multiple levels, use the HIGHEST level

b) Process level by level (0, then 1, then 2...):

For each item, for each period t:

  Gross Requirement(t) =
    Independent demand(t)           [from MPS, if finished]
    + Sum of Dependent demand(t)    [from parents in BOM]

  Scheduled Receipts(t) =
    orders already issued with receipt in t

  Projected Stock(t) =
    Projected Stock(t-1)
    + Scheduled Receipts(t)
    + Planned Order Receipts(t)
    - Gross Requirement(t)

  If Projected Stock(t) < Safety Stock:
    Net Requirement(t) =
      Gross Requirement(t)
      - Projected Stock(t-1)
      - Scheduled Receipts(t)
      + Safety Stock

    Apply lot sizing -> Planned Order Receipt(t)
    Calculate release date: t - Lead Time -> Planned Order Release(t - LT)

    If item is PARENT in BOM:
      Explode dependent demand to each child:
      Dependent demand(child, t-LT) +=
        Planned Order(parent, t) x BOM_qty / (1 - loss%)
```

#### B.4 Lot Sizing Algorithms

```
L4L (Lot-for-Lot): Qty = Net Requirement

EOQ: Qty = EOQ (rounded to purchase multiple)
     If need < EOQ, order full EOQ

Silver-Meal: Aggregate future needs while average cost/period decreases
             Stop when average cost starts rising

[RULE] In ALL cases, apply constraints in order:
  1. If Qty < lote_minimo -> Qty = lote_minimo
  2. If Qty % multiplo_compra != 0 -> round up
  3. If Qty < MOQ from supplier -> Qty = MOQ
```

#### B.5 CRP Algorithm

```
For each work center, for each week t:

  planned_load(t) = Sum for each production order in t:
    (quantity / effective_capacity_hour) + setup_time

  available_capacity(t) =
    Sum of active shift hours - scheduled stops - breakdown events

  utilization(t) = load / capacity x 100

  If utilization > 100%: -> OVERLOAD
    <= 110%: suggestion = 'OVERTIME'
    110-130%: suggestion = 'EXPEDITE'
    > 130%: suggestion = 'SUBCONTRACT'
```

#### B.6 Available Capacity Calculation

```
For each work center, for each day:
  available_hours = Sum(hours of each active shift on that weekday)
                  - scheduled stops on that day
                  - holidays (factory calendar)

  capacity_units = available_hours x capacity_hour x efficiency / 100

For each week (MRP period):
  weekly_capacity = Sum of capacity_units for each day of the week
```

#### B.7 Revenue Forecasting Dual Approach

**Approach A -- Indirect (Volume x Price):**
```
forecast_revenue = forecast_volume.P50 x expected_price

expected_price =
  1. Current list price (if registered)
  2. Or weighted average of last 3 months
  3. Or last practiced price (forward fill)
```

**Approach B -- Direct (TFT with target=revenue):**
TFT model trained with weekly revenue as target. Includes price as observed variable.

**Dashboard display:** Real revenue (past), Forecast A (blue line), Forecast B (green line), Confidence interval (gray band). When A and B diverge significantly -> attention flag (indicates mix/price structural change).

### Appendix C: Risks & Open Questions

#### Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Insufficient historical data for TFT | Medium | High | Graceful fallback to ETS/Naive; synthetic data augmentation; cold-start protocol |
| BOM data quality | High | High | Validation rules on BOM entry; exploded cost for visual verification; data quality scoring |
| Model drift over time | Medium | Medium | Weekly MAPE monitoring; automatic drift detection; monthly champion-challenger |
| GPU infrastructure costs | Low | Medium | Spot Instances (70-90% discount); train monthly not daily; inference is CPU-only |
| ERP integration complexity | Medium | Medium | Three connector options (API, DB, file); manual upload always available as fallback |
| User adoption resistance | Medium | High | Purchasing panel as primary actionable interface; morning email reduces friction |
| Scope creep from 7-component system | Medium | High | Phase-gated delivery with clear MVP; each phase delivers standalone value |
| Performance under large SKU catalogs | Low | Medium | PostgreSQL optimization; batch processing; async job queue |

#### Open Questions

| # | Question | Decision Needed By | Impact Area |
|---|----------|--------------------|-------------|
| 1 | What ERP system is currently in use, and what export/API capabilities does it have? | Phase 4 start | Automation/Ingestion |
| 2 | What is the actual number of active SKUs and BOM levels? | Phase 1 start | Database design, performance |
| 3 | Is there existing historical data in a clean, exportable format? How many years? | Phase 2 start | Forecasting model selection |
| 4 | Are there firm customer orders (order book) to integrate with MPS, or is it purely forecast-driven? | Phase 3 start | MRP engine design |
| 5 | What is the expected concurrent user count for dashboard performance sizing? | Phase 4 start | Infrastructure sizing |
| 6 | Is multi-plant support needed in the foreseeable future? | Architecture phase | System architecture |
| 7 | What is the acceptable downtime window for monthly model retraining? | Phase 2 start | Scheduling |
| 8 | Are there seasonal patterns, promotions, or external events that should be encoded as forecasting features? | Phase 2 start | Feature engineering |

### Appendix D: Long-Term Vision (Post-Phase 5)

- Multi-plant support (cross-plant inventory visibility and transfer optimization)
- Supplier portal for collaborative planning and automatic PO transmission
- Advanced demand sensing (incorporating point-of-sale data, weather, social media signals)
- Prescriptive analytics (automated "what if" scenario generation with recommended actions)
- Mobile companion app for shop floor alerts and approval workflows
- Internationalization (multi-language beyond Portuguese)
- Multi-currency support (exchange rate management for international suppliers)

### Appendix E: API Endpoint Inventory

All endpoints are prefixed with `/api/v1/`.

| Module | Endpoints | PRD References |
|--------|-----------|----------------|
| `auth` | `POST /auth/login`, `POST /auth/refresh` | FR-006 |
| `produtos` | `CRUD /produtos`, `POST /produtos/import` | FR-007, FR-008 |
| `bom` | `CRUD /bom`, `GET /bom/:id/tree`, `GET /bom/:id/cost` | FR-009, FR-010, FR-069 |
| `fornecedores` | `CRUD /fornecedores`, `CRUD /produto-fornecedor` | FR-011, FR-012 |
| `capacidade` | `CRUD /centros`, `/turnos`, `/paradas`, `/eventos`, `/roteiros`, `/calendario` | FR-013 to FR-016, FR-047, FR-048 |
| `inventario` | `CRUD /inventario`, `/depositos`, `POST /inventario/upload` | FR-017, FR-018 |
| `ingestao` | `POST /ingestao/upload`, `CRUD /ingestao/templates`, `POST /ingestao/etl` | FR-019, FR-020, FR-061 |
| `forecast` | `POST /forecast/execute`, `GET /forecast/results`, WS `job:progress` | FR-027 to FR-033 |
| `mrp` | `POST /mrp/execute`, `GET /mrp/orders`, `GET /mrp/capacity` | FR-034 to FR-049 |
| `automacao` | `CRUD /automacao/config`, `POST /automacao/trigger`, `GET /automacao/log` | FR-050 to FR-053, FR-059, FR-063 |
| `notificacao` | `GET /alerts`, WS `alert:new` | FR-062 |

> CRUD = GET (list), GET /:id (detail), POST (create), PATCH /:id (update), DELETE /:id (soft delete)

---

*This formalized PRD is the AUTHORITATIVE reference for the ForecastingMRP project. It preserves ALL content from the original PRD.md (v1.0, 1314 lines) with added formal requirement IDs, epic structure, and traceability matrix. No features were invented -- every FR, NFR, and CON traces directly to original PRD content (Article IV compliance). The original PRD.md at project root remains unchanged as the source document.*

*v2.1 Update (February 2026): Incorporated 7 architecture-driven changes from `docs/fullstack-architecture.md` Section 13 -- added 5 new tables (usuario, forecast_metrica, forecast_modelo, sku_classification, serie_temporal), WebSocket event schemas, API endpoint inventory (Appendix E), and resolved MRP engine tech ambiguity (NestJS confirmed).*
