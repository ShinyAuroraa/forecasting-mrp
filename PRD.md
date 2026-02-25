# PRD — Sistema de Forecasting, MRP/MRP II e BI Industrial

**Projeto:** ForecastingMRP
**Versão:** 1.0
**Data:** Fevereiro 2026
**Autor:** Ícaro
**Público-alvo deste documento:** Claude Code (agente de desenvolvimento)

---

## INSTRUÇÕES PARA CLAUDE CODE

Este é o documento de referência definitivo para o desenvolvimento do sistema. Ele contém TUDO que você precisa saber para implementar: arquitetura, modelo de dados, regras de negócio, algoritmos, interfaces e ordem de execução. Siga as fases do roadmap sequencialmente. Ao implementar cada módulo, consulte a seção correspondente para entender o contexto completo. Não improvise regras de negócio — tudo está documentado aqui.

**Convenções deste PRD:**
- `[OBRIGATÓRIO]` — feature essencial, não pode ser ignorada
- `[OPCIONAL]` — feature desejável, pode ser feita em fase posterior
- `[REGRA]` — regra de negócio que deve ser implementada exatamente como descrita
- `⚠️` — atenção especial, armadilha comum ou decisão arquitetural importante
- Blocos de pseudocódigo são referência para a lógica, não código final

---

## 1. VISÃO DO PRODUTO

### 1.1 Problema

Uma indústria recebe dados operacionais diários (movimentações de estoque, faturamento, inventário) mas toma decisões de compra e produção com base em feeling, sem previsibilidade. Isso gera excesso de estoque de alguns itens e falta de outros, compras reativas em vez de planejadas, e planejamento financeiro cego.

### 1.2 Solução

Sistema integrado que automatiza o ciclo completo: ingestão de dados → previsão de demanda com IA → planejamento de materiais (MRP) → validação de capacidade (MRP II) → recomendações de compra acionáveis → dashboards de BI.

### 1.3 Componentes e Justificativas

| # | Componente | O que faz | Problema que resolve |
|---|---|---|---|
| 1 | **Forecasting (TFT + ETS + Croston)** | Previsão de demanda por SKU com intervalos de confiança (P10-P90) | Compra por feeling → excesso ou falta |
| 2 | **Forecasting de Faturamento** | Projeção financeira por período, família, categoria e total | Planejamento financeiro cego |
| 3 | **MRP Completo** | Explosão de BOM multinível, ordens planejadas de compra e produção com datas e quantidades exatas | Compras reativas, paradas de produção |
| 4 | **MRP II** | Validação de capacidade produtiva e de armazenamento contra restrições reais da fábrica | Plano impossível de executar na prática |
| 5 | **Painel de Compras** | "O quê comprar, quanto, de quem, quando pedir, quando chega" | Decisões de compra sem dados |
| 6 | **Dashboards de BI** | Visão executiva, operacional e analítica | Sem visibilidade da operação |
| 7 | **Automação de Ingestão** | Alimentação diária via email, ERP ou upload, sem intervenção manual | Dados defasados = decisões erradas |

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 Diagrama de Camadas

```
FONTES DE DADOS
  Email de Fechamento de Caixa | Relatórios do ERP | Upload Manual | Inventário Diário
                    │
                    ▼
CAMADA DE AUTOMAÇÃO E INGESTÃO
  Email Listener (IMAP/Gmail API) → ETL Pipeline → Parse → Map → Validate → Clean → Grade → Classify
  ERP Connector (API/DB/SFTP)
  File Processor (Upload UI)
                    │
                    ▼
DATA LAYER (PostgreSQL 16)
  Dados Limpos (séries temporais) | Cadastros Mestres (SKU, BOM, fornecedores) |
  Inventário Atual (posição real) | Capacidade Produtiva (centros, turnos) |
  Resultados (forecast, MRP, ordens)
                    │
                    ▼
CAMADA DE CÁLCULO
  ┌─ Motor de Forecasting (FastAPI + Python) ──────────────────────┐
  │  TFT Volume | TFT Faturamento | ETS Holt-Winters |            │
  │  Croston/TSB | LightGBM | Ensemble                            │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Motor MRP/MRP II (NestJS ou Python) ──────────────────────────┐
  │  MPS (Plano Mestre) | Explosão BOM Multinível |                │
  │  SS/ROP/Min/Max | EOQ/Silver-Meal/Wagner-Whitin |              │
  │  CRP Capacidade | Gerador de Ordens de Compra                  │
  └────────────────────────────────────────────────────────────────┘
                    │
                    ▼
CAMADA DE APRESENTAÇÃO (Next.js 14)
  Dashboard Executivo & BI | Dashboard Forecast & Faturamento |
  Dashboard Estoque & MRP | Painel Compras | Painel Capacidade |
  Cadastros | Inventário | Config & Admin | Automação
```

### 2.2 Comunicação entre Serviços

```
Frontend (Next.js 14)
    │
    │  REST (JSON) — CRUD e queries
    │  WebSocket — progresso de jobs em tempo real
    │
    ▼
Backend (NestJS)
    │
    ├── REST síncrono ──────────────▶ FastAPI (queries rápidas: predict)
    │
    ├── BullMQ (Redis) ─────────────▶ FastAPI (jobs longos: train)
    │   - Job "train_model" → Worker Python consome
    │   - Job "run_forecast" → Worker Python consome
    │   - Progress events via Redis pub/sub → WebSocket → Frontend
    │
    └── PostgreSQL ◄────────────────── Ambos leem/escrevem
```

### 2.3 Stack Tecnológico

| Tecnologia | Onde usa | Justificativa |
|---|---|---|
| **Next.js 14 (App Router)** | Frontend | SSR para dashboards, Server Components para queries pesadas, React Server Actions para mutações simples |
| **Tailwind CSS + Shadcn/UI** | Estilização | Componentes de alta qualidade sem lock-in (copy-paste, não dependência) |
| **Apache ECharts** | Gráficos de BI | Suporta heatmaps, Gantt, Sankey, treemaps, 3D — necessário para BI industrial |
| **NestJS (TypeScript)** | Backend principal | Modular, tipado, injeção de dependência, guards para auth, interceptors para logging |
| **FastAPI (Python)** | Microserviço de Forecasting | Acesso nativo ao ecossistema ML (PyTorch, scikit-learn, statsmodels). Async por padrão |
| **PostgreSQL 16** | Banco principal | JSONB, window functions para ABC, CTEs recursivas para BOM, TimescaleDB se necessário |
| **Redis + BullMQ** | Filas e cache | Jobs de treinamento em fila assíncrona com retry, progress tracking e dead letter queue |
| **Docker + Docker Compose** | Dev local | Ambiente reproduzível. Todos os serviços containerizados |
| **AWS EKS (via CDK)** | Produção | GPU Spot Instances para treinamento de modelos |

---

## 3. MODELO DE DADOS

### 3.1 Tabelas de Cadastro

⚠️ **Todas as tabelas usam UUID como PK.** Timestamps `created_at` e `updated_at` em todas as tabelas.

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
    volume_m3                 NUMERIC(10,6),  -- Para cálculo de capacidade de armazenamento
    ativo                     BOOLEAN DEFAULT true,
    custo_unitario            NUMERIC(12,4),
    custo_pedido              NUMERIC(12,4),  -- Custo fixo de fazer 1 pedido (K no EOQ)
    custo_manutencao_pct_ano  NUMERIC(5,2) DEFAULT 25.00,  -- % do custo/ano para manter em estoque (h no EOQ)
    preco_venda               NUMERIC(12,4),
    politica_ressuprimento    VARCHAR(30) DEFAULT 'PONTO_PEDIDO',
      -- ENUM: 'PONTO_PEDIDO', 'MIN_MAX', 'REVISAO_PERIODICA', 'KANBAN'
    intervalo_revisao_dias    INTEGER,  -- Se política = REVISAO_PERIODICA
    lote_minimo               NUMERIC(12,4) DEFAULT 1,
    multiplo_compra           NUMERIC(12,4) DEFAULT 1,  -- Ex: só compra em múltiplos de 100
    estoque_seguranca_manual  NUMERIC(12,4),  -- Override manual (NULL = usar calculado pelo sistema)
    lead_time_producao_dias   INTEGER,  -- Para itens de produção própria
    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

`[REGRA]` Se `estoque_seguranca_manual IS NOT NULL`, o sistema NÃO calcula automaticamente o estoque de segurança para este produto — usa o valor manual.

#### 3.1.2 `categoria`

```sql
CREATE TABLE categoria (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(100) NOT NULL,
    descricao TEXT,
    pai_id    UUID REFERENCES categoria(id)  -- Hierarquia (self-referencing)
);
```

#### 3.1.3 `unidade_medida`

```sql
CREATE TABLE unidade_medida (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla           VARCHAR(10) NOT NULL UNIQUE,  -- 'UN', 'KG', 'LT', 'CX', 'MT', 'M2', 'M3'
    nome            VARCHAR(50) NOT NULL,
    fator_conversao NUMERIC(12,6) DEFAULT 1  -- Para conversões entre unidades
);
```

#### 3.1.4 `fornecedor`

```sql
CREATE TABLE fornecedor (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                VARCHAR(50) NOT NULL UNIQUE,
    razao_social          VARCHAR(255) NOT NULL,
    nome_fantasia         VARCHAR(255) NOT NULL,
    cnpj                  VARCHAR(18),  -- Com validação de dígitos
    email                 VARCHAR(255),
    telefone              VARCHAR(20),
    cidade                VARCHAR(100),
    estado                VARCHAR(2),
    lead_time_padrao_dias INTEGER NOT NULL,
    lead_time_min_dias    INTEGER,  -- Para calcular σ do lead time
    lead_time_max_dias    INTEGER,
    confiabilidade_pct    NUMERIC(5,2) DEFAULT 90.00,  -- % de entregas no prazo
    avaliacao             SMALLINT DEFAULT 3,  -- 1-5 estrelas
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

`[REGRA]` O MRP usa o fornecedor com `is_principal = true` por default. Se o fornecedor principal não pode atender (MOQ > necessidade), cai para o secundário.

#### 3.1.6 `bom` (Bill of Materials)

```sql
CREATE TABLE bom (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_pai_id    UUID NOT NULL REFERENCES produto(id),  -- Produto acabado/semi-acabado
    produto_filho_id  UUID NOT NULL REFERENCES produto(id),  -- Insumo/componente
    quantidade        NUMERIC(12,6) NOT NULL,  -- Qtd do filho por 1 unidade do pai
    unidade_medida_id UUID REFERENCES unidade_medida(id),
    perda_percentual  NUMERIC(5,2) DEFAULT 0,  -- % de perda no processo (scrap)
    nivel             SMALLINT NOT NULL,  -- Nível na BOM (0=pai, 1, 2, ...)
    observacao        TEXT,
    ativo             BOOLEAN DEFAULT true,
    valido_desde      DATE,  -- Versionamento
    valido_ate        DATE,  -- NULL = vigente
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

`[REGRA]` **Cálculo com perda:** `Qtd necessária = Qtd_BOM × Qtd_pai ÷ (1 - perda/100)`
Exemplo: BOM diz 0,15 KG de manteiga com 2% de perda → Para 1000 biscoitos: `0,15 × 1000 ÷ (1 - 0,02) = 153,06 KG`

#### 3.1.7 `inventario_atual`

```sql
CREATE TABLE inventario_atual (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id               UUID NOT NULL REFERENCES produto(id),
    deposito_id              UUID NOT NULL REFERENCES deposito(id),
    quantidade_disponivel    NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Livre para uso
    quantidade_reservada     NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Comprometida com pedidos
    quantidade_em_transito   NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Pedida, ainda não recebida
    quantidade_em_quarentena NUMERIC(12,4) NOT NULL DEFAULT 0,  -- Aguardando inspeção/liberação
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

`[REGRA]` **O MRP usa o estoque disponível para calcular necessidade líquida:**
```
Necessidade líquida = Necessidade bruta
                    - Estoque disponível
                    - Recebimentos programados (em trânsito)
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
    capacidade_m3         NUMERIC(10,2),  -- Capacidade volumétrica total
    capacidade_posicoes   INTEGER,        -- Nº de posições pallet/prateleira
    capacidade_kg         NUMERIC(12,2),  -- Capacidade máxima de peso
    temperatura_min       NUMERIC(5,2),   -- Se refrigerado
    temperatura_max       NUMERIC(5,2),
    endereco              TEXT,
    ativo                 BOOLEAN DEFAULT true
);
```

### 3.2 Tabelas de Capacidade Produtiva

#### 3.2.1 `centro_trabalho`

```sql
CREATE TABLE centro_trabalho (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                   VARCHAR(50) NOT NULL UNIQUE,
    nome                     VARCHAR(100) NOT NULL,
    tipo                     VARCHAR(20) NOT NULL,
      -- ENUM: 'PRODUCAO', 'EMBALAGEM', 'MONTAGEM', 'ACABAMENTO', 'CONTROLE_QUALIDADE'
    descricao                TEXT,
    capacidade_hora_unidades NUMERIC(10,2) NOT NULL,  -- Capacidade nominal
    num_operadores           INTEGER,
    eficiencia_percentual    NUMERIC(5,2) NOT NULL DEFAULT 100,  -- Real vs. nominal
    tempo_setup_minutos      NUMERIC(8,2) DEFAULT 0,  -- Setup entre produtos diferentes
    custo_hora               NUMERIC(10,2),
    ativo                    BOOLEAN DEFAULT true,
    observacoes              TEXT,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);
```

`[REGRA]` **Capacidade efetiva = Capacidade nominal × Eficiência / 100**
Exemplo: 200 un/hora × 92% = 184 un/hora efetivas

#### 3.2.2 `turno`

```sql
CREATE TABLE turno (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centro_trabalho_id  UUID NOT NULL REFERENCES centro_trabalho(id),
    nome                VARCHAR(50) NOT NULL,  -- "1º Turno", "Noturno"
    hora_inicio         TIME NOT NULL,
    hora_fim            TIME NOT NULL,
    dias_semana         INTEGER[] NOT NULL,  -- [1,2,3,4,5] = seg-sex
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
    cron_expression     VARCHAR(100)  -- Se recorrente
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
    previsao_resolucao  DATE,  -- Obrigatório se tipo = 'QUEBRA'
    usuario_id          UUID REFERENCES usuario(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

`[REGRA]` Ao salvar um evento de capacidade, o sistema AUTOMATICAMENTE: (1) Recalcula capacidade disponível dos próximos períodos, (2) Re-roda o CRP, (3) Gera alertas se ordens planejadas foram afetadas.

#### 3.2.5 `roteiro_producao`

```sql
CREATE TABLE roteiro_producao (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id             UUID NOT NULL REFERENCES produto(id),
    centro_trabalho_id     UUID NOT NULL REFERENCES centro_trabalho(id),
    sequencia              SMALLINT NOT NULL,  -- Ordem da operação
    operacao               VARCHAR(100) NOT NULL,  -- Nome da etapa
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
    horas_produtivas NUMERIC(4,2) DEFAULT 0  -- 0 para feriados, 8 para dias normais
);
```

### 3.3 Tabelas de Resultado

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
    p50              NUMERIC(14,4),  -- Previsão central
    p75              NUMERIC(14,4),
    p90              NUMERIC(14,4),
    faturamento_p50  NUMERIC(14,4),  -- Volume P50 × preço
    faturamento_p10  NUMERIC(14,4),
    faturamento_p90  NUMERIC(14,4)
);
```

#### 3.3.4 `parametros_estoque`

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

#### 3.3.5 `ordem_planejada`

```sql
CREATE TABLE ordem_planejada (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execucao_id                UUID NOT NULL REFERENCES execucao_planejamento(id),
    produto_id                 UUID NOT NULL REFERENCES produto(id),
    tipo                       VARCHAR(10) NOT NULL,  -- 'COMPRA', 'PRODUCAO'
    quantidade                 NUMERIC(12,4) NOT NULL,
    data_necessidade           DATE NOT NULL,  -- Quando o material é necessário
    data_liberacao             DATE NOT NULL,  -- Quando o pedido deve ser feito
    data_recebimento_esperado  DATE NOT NULL,  -- data_liberacao + lead_time
    fornecedor_id              UUID REFERENCES fornecedor(id),  -- Se tipo = COMPRA
    centro_trabalho_id         UUID REFERENCES centro_trabalho(id),  -- Se tipo = PRODUCAO
    custo_estimado             NUMERIC(14,4),
    lotificacao_usada          VARCHAR(20),  -- 'L4L', 'EOQ', 'SILVER_MEAL', 'WAGNER_WHITIN'
    prioridade                 VARCHAR(10) NOT NULL,  -- 'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'
    status                     VARCHAR(15) DEFAULT 'PLANEJADA',
      -- 'PLANEJADA', 'FIRME', 'LIBERADA', 'CANCELADA'
    mensagem_acao              VARCHAR(100),  -- 'NOVA', 'ANTECIPAR 2 SEM', 'CANCELAR', etc.
    motivo                     VARCHAR(100),  -- Origem: forecast, pedido firme, SS
    observacao                 TEXT
);
```

`[REGRA]` **Prioridades:**
- `CRITICA`: estoque atual < 0 (já em ruptura)
- `ALTA`: estoque atual < safety stock
- `MEDIA`: estoque projetado ficará < ROP no horizonte
- `BAIXA`: reposição preventiva

#### 3.3.6 `carga_capacidade`

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

`[REGRA]` **Sugestões de sobrecarga:**
- Utilização ≤ 100%: sugestao = 'OK'
- Sobrecarga ≤ 10%: sugestao = 'HORA_EXTRA'
- Sobrecarga 10-30%: sugestao = 'ANTECIPAR'
- Sobrecarga > 30%: sugestao = 'SUBCONTRATAR'

### 3.4 Tabelas de Configuração

```sql
CREATE TABLE config_sistema (
    chave       VARCHAR(100) PRIMARY KEY,
    valor       JSONB NOT NULL,
    descricao   TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_by  UUID
);

-- Configurações iniciais (seed):
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

---

## 4. MÓDULO: CADASTROS E CONFIGURAÇÃO

### 4.1 Cadastro de Produtos

**Tela:** Tabela paginada com busca, filtros (tipo, categoria, status, classe ABC) e ações em massa.

**Campos do formulário:**

| Grupo | Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|---|
| Dados Básicos | Código (SKU) | string | Sim, único | |
| | Descrição | string | Sim | |
| | Tipo | enum | Sim | ACABADO, SEMI_ACABADO, INSUMO, EMBALAGEM, MATERIA_PRIMA, REVENDA |
| | Categoria | dropdown hierárquico | Não | |
| | Unidade de Medida | enum | Sim | UN, KG, LT, CX, MT, M2, M3 |
| | Status | enum | Sim | ATIVO, INATIVO |
| Dimensões | Peso líquido (kg) | numeric | Não | |
| | Volume (m³) | numeric | Não | Essencial para calcular ocupação do depósito |
| Custos | Custo unitário (R$) | numeric | Não | |
| | Custo por pedido (R$) | numeric | Não | Custo fixo de fazer 1 pedido (K no EOQ) |
| | Custo manutenção (%/ano) | numeric | Default 25% | h no EOQ |
| | Preço de venda (R$) | numeric | Não | |
| Ressuprimento | Política | enum | Default PONTO_PEDIDO | PONTO_PEDIDO, MIN_MAX, REVISAO_PERIODICA |
| | Lead time produção (dias) | integer | Se produção própria | |
| | Lote mínimo | numeric | Default 1 | |
| | Múltiplo de compra | numeric | Default 1 | Ex: compra em múltiplos de 100 |
| | Intervalo revisão (dias) | integer | Se REVISAO_PERIODICA | |
| Override | Estoque segurança fixo | numeric | Opcional | NULL = usar calculado |

`[OBRIGATÓRIO]` **Importação em massa:** Upload de planilha CSV/XLSX com todos os campos. Template para download com exemplos.

### 4.2 Cadastro de BOM (Estrutura de Produto)

**Interface:** Árvore visual mostrando a hierarquia do produto.

**Campos por linha da BOM:**

| Campo | Tipo | Notas |
|---|---|---|
| Produto pai | busca por código/descrição | |
| Produto filho | busca por código/descrição | |
| Quantidade | numeric | Qtd do filho por 1 unidade do pai |
| Unidade de medida | herdada do produto filho | Com conversão se necessário |
| Percentual de perda | 0-100%, default 0 | Ex: 3% = para cada 100 precisa pedir 103 |
| Observação | texto livre | |
| Válido desde | date | Para versionamento |
| Válido até | date | NULL = vigente |

`[OBRIGATÓRIO]` Exibir **custo explodido** na interface: somar custo de todos os componentes multiplicado pelas quantidades na BOM.

### 4.3 Cadastro de Fornecedores

**Campos cadastrais:** Código, Razão Social, Nome Fantasia, CNPJ (com validação), Email, Telefone, Cidade, Estado.

**Campos de desempenho:** Lead time padrão (dias), Lead time mín/máx (para calcular σ), Confiabilidade (%), Avaliação (1-5 estrelas).

**Vínculo SKU × Fornecedor:** Interface para associar múltiplos fornecedores por produto, definindo para cada um: lead time específico, preço unitário, MOQ, múltiplo de compra, e se é o fornecedor principal.

### 4.4 Cadastro de Capacidade Produtiva

Dividido em sub-abas:

#### Sub-aba "Centros de Trabalho"
Tabela com: Código, Nome, Tipo, Capacidade/hora, Eficiência (%), Status.
Formulário de edição com todos os campos de `centro_trabalho`.

#### Sub-aba "Turnos"
Tabela por centro de trabalho: Nome, Horário, Dias da semana, Status.
`[OBRIGATÓRIO]` Exibir cálculo automático: "Capacidade diária efetiva (Seg-Sex): 16h × 184 un/h = 2.944 un"

`[REGRA]` **Cálculo de capacidade disponível por período:**
```
Para cada centro de trabalho, para cada dia:
  horas_disponiveis = Σ(horas de cada turno ativo naquele dia da semana)
                    - paradas programadas naquele dia
                    - feriados (calendário da fábrica)

  capacidade_unidades = horas_disponiveis × capacidade_hora × eficiencia / 100

Para cada semana (período do MRP):
  capacidade_semanal = Σ capacidade_unidades de cada dia da semana
```

#### Sub-aba "Paradas Programadas"
Lista por centro de trabalho com: Tipo, Período, Recorrência.
Suportar paradas recorrentes via cron expression.
Exibir "Próximas paradas" com contagem de dias.

#### Sub-aba "Eventos de Capacidade"
Timeline cronológica de todos os eventos. Formulário com: Tipo, Data, Campo alterado, Valor anterior (auto-preenchido), Valor novo, Motivo, Previsão de resolução (obrigatório se QUEBRA).

#### Sub-aba "Capacidade de Armazenamento"
Tabela de depósitos com: Nome, Tipo, Capacidade, Ocupação (%).
Alertas visuais quando ocupação > 90%.

### 4.5 Cadastro de Inventário Atual

**Tela:** Tabela com busca, filtros (Tipo, Depósito, Status).

**Três formas de atualização:**
1. Upload de planilha (posição de estoque do ERP)
2. Sincronização automática com banco do ERP
3. Edição manual (para ajustes de contagem)

**Indicadores na tela:** Valor total em estoque, Itens abaixo do ROP (com link para lista), Itens acima do máximo (capital parado).

---

## 5. MÓDULO: MOTOR DE FORECASTING

### 5.1 Estratégia Multi-Modelo

`[REGRA]` A seleção de modelo é automática baseada na classificação do SKU, mas o usuário pode fazer override.

| Classificação do SKU | Modelo Primário | Fallback |
|---|---|---|
| SUAVE + classe A/B | TFT | LightGBM |
| SUAVE + classe C | ETS (Holt-Winters) | Naive |
| ERRÁTICA + classe A/B | TFT | ETS |
| ERRÁTICA + classe C | ETS | Naive |
| INTERMITENTE (qualquer) | Croston/TSB | SBA |
| LUMPY (qualquer) | TSB | Bootstrap |
| Dados insuficientes (<40 sem) | ETS simples | Naive |

**Adicionalmente:**
- TFT Volume (target=volume) → alimenta MRP
- TFT Faturamento (target=faturamento) → alimenta BI
- Ensemble (TFT 0.6 + LightGBM 0.4) → para SKUs classe A

### 5.2 Modelos Implementados

#### Modelo 1 — TFT (Temporal Fusion Transformer)
- **Quando:** SKUs suave/errática, classe A/B, ≥52 semanas de dados
- **Target volume:** alimenta MRP. Quantis P10, P25, P50, P75, P90
- **Target faturamento:** alimenta BI. Mesmo modelo, target diferente
- **Re-treino:** mensal ou quando MAPE degradar >5 pontos
- **Inference:** semanal (modelo já treinado)
- **Hardware:** GPU para treino. CPU para inference
- **Implementação:** PyTorch Forecasting (pytorch_forecasting.TemporalFusionTransformer)

#### Modelo 2 — ETS (Holt-Winters)
- **Quando:** SKUs classe C, ou dados insuficientes para TFT
- **Implementação:** `statsmodels.tsa.holtwinters.ExponentialSmoothing`
- **Variantes:** aditivo ou multiplicativo (auto-seleção por AIC)
- **Intervalos:** via simulação (1000 paths)

#### Modelo 3 — Croston/TSB
- **Quando:** SKUs intermitentes (>25% de zeros) ou lumpy
- **Implementação:** `statsforecast` ou implementação própria
- **Croston:** decompõe em intervalo entre demandas × tamanho da demanda
- **TSB:** melhoria com decaimento exponencial (melhor para obsolescência)
- **Intervalos:** via bootstrap

#### Modelo 4 — LightGBM
- **Quando:** challenger do TFT para classe A (ensemble), ou quando TFT falha
- **Implementação:** `lightgbm` com feature engineering temporal
- **Features:** lags (1-52 semanas), rolling mean/std, calendário, preço, promoções
- **Modelo global:** todos SKUs juntos

#### Modelo 5 — Ensemble (SKUs classe A)
- **Combina:** TFT (peso 0.6) + LightGBM (peso 0.4), ou pesos otimizados por cross-validation
- **Justificativa:** Para SKUs de alto valor, a combinação reduz o risco de erro individual

### 5.3 Pipeline de Execução

```
TRIGGER: Manual (botão) | Agendado (cron) | Automático (pós-ingestão)

1. CARREGAR DADOS LIMPOS
   Query: dados_limpos WHERE granularidade = 'semanal' ORDER BY sku_id, time_idx
   Incluir: variáveis de calendário, preço, classificação

2. SEGMENTAR POR MODELO
   Ler sku_classification.modelo_forecast_sugerido
   Separar em 4 grupos: TFT, ETS, Croston, LightGBM

3. EXECUTAR TFT (grupo 1)
   Se modelo já treinado E não expirado: apenas inference (predict)
   Se modelo não existe OU expirado OU forçar re-treino: treinar primeiro
   Gerar: P10, P25, P50, P75, P90 para cada SKU × horizonte
   Rodar TFT Volume E TFT Faturamento (2 modelos separados)

4. EXECUTAR ETS (grupo 2)
   Para cada SKU: fit + predict individual
   Gerar intervalos via simulação (1000 paths)

5. EXECUTAR CROSTON/TSB (grupo 3)
   Para cada SKU: fit + predict individual
   Gerar intervalos via bootstrap

6. EXECUTAR LIGHTGBM (grupo 4 + ensemble classe A)
   Treinar modelo global (todos SKUs juntos)
   Predict por SKU
   Para classe A: combinar com TFT (ensemble)

7. CALCULAR FATURAMENTO PREVISTO
   Volume P50 × preço_esperado → Faturamento P50
   Volume P10 × preço_esperado → Faturamento P10 (pessimista)
   Volume P90 × preço_esperado → Faturamento P90 (otimista)
   Comparar com TFT Faturamento direto

8. CALCULAR MÉTRICAS
   Backtesting: treinar com T-13, prever 13 semanas, comparar com real
   MAPE, MAE, RMSE por SKU e por classe
   Comparar com baseline (média móvel 12 semanas)

9. SALVAR RESULTADOS
   forecast_resultado: previsões por SKU × período × quantil
   forecast_metrica: MAPE, MAE por SKU e por classe
   forecast_modelo: metadados (versão, parâmetros, métricas)

10. DISPARAR MRP (se configurado para encadear)
```

### 5.4 Previsão de Faturamento — Duas Abordagens Paralelas

`[REGRA]` O sistema roda AMBAS e mostra no dashboard:

**Abordagem A — Indireta (Volume × Preço):**
```
faturamento_previsto = forecast_volume.P50 × preco_esperado

preco_esperado =
  1. Preço de tabela vigente (se cadastrado)
  2. Ou média ponderada dos últimos 3 meses
  3. Ou último preço praticado (forward fill)
```

**Abordagem B — Direta (TFT com target=faturamento):**
Modelo TFT treinado com faturamento semanal como target. Inclui preço como variável observada.

**No dashboard:** Faturamento real (passado), Previsão A (linha azul), Previsão B (linha verde), Intervalo de confiança (faixa cinza). Quando A e B divergem muito → flag de atenção (indica mudança de mix/preço).

---

## 6. MÓDULO: MOTOR MRP E MRP II

### 6.1 Fluxo Completo do MRP

**INPUTS:**
- Forecast (P50 por SKU por semana)
- Pedidos firmes (carteira de pedidos confirmados)
- Inventário atual (posição real)
- BOM (estrutura de produto multinível)
- Parâmetros de ressuprimento (lead time, MOQ, lote mínimo, SS)
- Recebimentos programados (ordens já emitidas, em trânsito)

**PROCESSO (8 etapas):**

#### Etapa 1: Gerar MPS (Master Production Schedule)

```
Para cada produto ACABADO, para cada semana t:
  demanda(t) = MAX(forecast_P50(t), pedidos_firmes(t))

  [REGRA] Se pedido firme > forecast, usar pedido firme
          (realidade > previsão para o curto prazo)

  Horizonte de pedido firme: geralmente 2-4 semanas
  Além disso: só forecast
```

#### Etapa 2: Calcular Parâmetros de Estoque

```
Para cada SKU (acabado, semi-acabado, insumo):

  Se TFT disponível:
    SS = P(nivel_servico) - P50 da demanda acumulada no lead time
    Ex: nivel_servico=97% para classe A → usar P97

  Se TFT não disponível (fórmula clássica):
    SS = Z × √(LT × σ²_d + d̄² × σ²_LT)
    Z = 1.88 (97%), 1.48 (93%), 1.04 (85%)

  ROP = d̄ × LT + SS
  EOQ = √(2 × D_anual × K / h)
  Min = ROP
  Max = d̄ × (LT + R) + SS    (R = intervalo de revisão)
```

#### Etapa 3: Explosão MRP Multinível (Low-Level Coding)

```
a) Atribuir nível a cada item:
   Nível 0 = produtos acabados (sem pai)
   Nível 1 = componentes diretos dos acabados
   Nível N = componentes de componentes
   [REGRA] Se um item aparece em múltiplos níveis, usar o MAIOR nível

b) Processar nível a nível (0, depois 1, depois 2...):

Para cada item, para cada período t:

  Necessidade Bruta(t) =
    Demanda independente(t)           [do MPS, se acabado]
    + Σ Demanda dependente(t)         [dos pais na BOM]

  Recebimentos Programados(t) =
    ordens já emitidas com recebimento em t

  Estoque Projetado(t) =
    Estoque Projetado(t-1)
    + Recebimentos Programados(t)
    + Ordens Planejadas Recebidas(t)
    - Necessidade Bruta(t)

  Se Estoque Projetado(t) < Safety Stock:
    Necessidade Líquida(t) =
      Necessidade Bruta(t)
      - Estoque Projetado(t-1)
      - Recebimentos Programados(t)
      + Safety Stock

    Aplicar lotificação → Ordem Planejada de Recebimento(t)
    Calcular data de liberação: t - Lead Time → Ordem Planejada de Liberação(t - LT)

    Se o item é PAI na BOM:
      Explodir demanda dependente para cada filho:
      Demanda dependente(filho, t-LT) +=
        Ordem Planejada(pai, t) × Qtd_BOM / (1 - perda%)
```

#### Etapa 4: Aplicar Lotificação

```
Escolha configurável por SKU ou por classe:

L4L (Lot-for-Lot): Qtd = Necessidade Líquida

EOQ: Qtd = EOQ (arredondado ao múltiplo de compra)
     Se necessidade < EOQ, pedir EOQ inteiro

Silver-Meal: Agregar necessidades futuras enquanto custo médio/período diminuir
             Parar quando custo médio começar a subir

[REGRA] Em TODOS os casos, aplicar restrições na seguinte ordem:
  1. Se Qtd < lote_minimo → Qtd = lote_minimo
  2. Se Qtd % multiplo_compra ≠ 0 → arredondar para cima
  3. Se Qtd < MOQ do fornecedor → Qtd = MOQ
```

#### Etapa 5: Gerar Ordens Planejadas

```
Para cada necessidade líquida > 0:

Se item COMPRADO (insumo, matéria-prima, embalagem):
  → Ordem de COMPRA
  fornecedor = fornecedor principal do SKU
  data_liberacao = data_necessidade - lead_time_fornecedor
  custo = quantidade × preco_unitario_fornecedor

Se item PRODUZIDO (acabado, semi-acabado):
  → Ordem de PRODUÇÃO
  centro_trabalho = primeiro centro do roteiro de produção
  data_liberacao = data_necessidade - lead_time_producao
  horas_necessarias = (quantidade / capacidade_hora) + tempo_setup
```

#### Etapa 6: Validar Capacidade (MRP II)

```
Para cada centro de trabalho, para cada semana t:

  carga_planejada(t) = Σ para cada ordem de produção em t:
    (quantidade / capacidade_hora_efetiva) + tempo_setup

  capacidade_disponivel(t) =
    Σ horas de turnos ativos - paradas programadas - eventos de quebra

  utilizacao(t) = carga / capacidade × 100

  Se utilizacao > 100%: → SOBRECARGA
    ≤ 110%: sugestao = 'HORA_EXTRA'
    110-130%: sugestao = 'ANTECIPAR'
    > 130%: sugestao = 'SUBCONTRATAR'
```

#### Etapa 7: Validar Capacidade de Armazenamento

```
Para cada depósito, para cada semana t:

  estoque_projetado_volume(t) = Σ para cada SKU no depósito:
    estoque_projetado(t) × volume_unitario_m3

  ocupacao_projetada(t) = estoque_projetado_volume / capacidade_m3 × 100

  Se ocupacao > 90%: ALERTA com sugestões
  Se ocupacao > 95%: ALERTA CRÍTICO
```

#### Etapa 8: Gerar Mensagens de Ação

```
Comparar plano novo com ordens existentes:
  - Ordem existe mas não é mais necessária → "CANCELAR OC-123"
  - Ordem existe mas precisa de mais → "AUMENTAR OC-123 de 500 para 800"
  - Ordem existe mas precisa de menos → "REDUZIR OC-123 de 500 para 300"
  - Ordem existe mas data mudou → "ANTECIPAR OC-123 em 2 semanas"
  - Ordem não existe e é necessária → "NOVA ordem de compra"
```

### 6.2 Painel de Compras

`[OBRIGATÓRIO]` Este é o output mais acionável do sistema. Mostrar:

**Seção "Ações Urgentes" (próximos 7 dias):** Para cada item urgente mostrar: SKU + descrição, Quantidade a comprar, Fornecedor (nome + lead time), "Pedir até" (data), Recebimento esperado, Motivo da compra, Custo estimado, Botões: [Gerar Pedido] [Postergar] [Alterar Qtd]

**Seção "Resumo por Fornecedor":** Tabela agrupada com total de itens e valor por fornecedor.

**Total de compras planejadas (próximas 13 semanas)** com valor.

**Exportar para Excel** e **Enviar resumo por email**.

---

## 7. MÓDULO: AUTOMAÇÃO E INGESTÃO

### 7.1 Pipeline de Automação Diário

```
06:00  Email Listener verifica caixa de entrada
06:01  Encontra email de fechamento de caixa do dia anterior
06:02  Baixa anexo (CSV/XLSX/PDF)
06:03  Se PDF: OCR → extrai dados → converte para CSV
       Se CSV/XLSX: processa diretamente
06:05  Aplica template de mapeamento salvo
06:06  Executa ETL incremental (só dados novos)
06:10  Atualiza inventário (se dados disponíveis)
06:11  Roda forecast incremental (inference, não re-treino)
06:15  Roda MRP incremental
06:16  Verifica alertas (ruptura, compras urgentes, sobrecarga, desvio de forecast)
06:17  Envia resumo diário por email
```

### 7.2 Email Listener

**Opção A — Gmail API (recomendada):**
- Conta de serviço no Google Cloud, OAuth2
- Filtros: from, subject ("Fechamento" OR "Relatório diário"), has:attachment, after:date

**Opção B — IMAP (qualquer provedor):**
- Conectar via imaplib (Python) ou nodemailer (Node)
- Filtrar por remetente + subject + data

**Opção C — Pasta compartilhada / SFTP:**
- Monitorar pasta (watch/polling) por novos arquivos

**Implementação como Worker:**
- NestJS: `@Cron('0 6 * * *')` no controller de automação
- Ou: BullMQ repeatable job configurado para 06:00
- Retry: se falhar, tentar 06:30, 07:00, 07:30
- Dead letter: se falhar 4x, alertar admin por email

### 7.3 Conector ERP

Três opções de integração (configurável):
1. **API REST**: endpoint + credenciais + formato → GET /api/movimentacoes?data={ontem}
2. **Banco direto** (read-only): connection string → query incremental WHERE data_movimento = CURRENT_DATE - 1
3. **CSV exportado**: monitorar pasta de exportação

Independente do método, o pipeline ETL é o mesmo: Dados brutos → Staging → Validação → Limpeza → dados_limpos

### 7.4 Ciclos de Re-treino

| Frequência | O que faz | Duração esperada |
|---|---|---|
| **Diário** (automático) | Ingestão, inference (não treina), recalcular MRP, alertas | ~2 min |
| **Semanal** (automático) | Comparar forecast × real, atualizar MAPE, recalcular ABC/XYZ, parâmetros de estoque | ~10 min |
| **Mensal** (automático) | Re-treinar TODOS os modelos, champion-challenger, relatório de accuracy | ~30-60 min |
| **Manual** (quando necessário) | Mudança estrutural, evento atípico, correção de dados históricos | Variável |

### 7.5 Resumo Diário Automático

`[OBRIGATÓRIO]` Email enviado automaticamente contendo:
- Fechamento de ontem: faturamento real vs. previsto, volume vendido, ticket médio
- Alertas de estoque: SKUs abaixo do SS, SKUs chegando ao ROP
- Compras urgentes: total de valor e pedidos nos próximos 7 dias
- Capacidade: utilização por centro de trabalho com alertas
- Forecast accuracy: MAPE por classe (últimas 4 semanas)

---

## 8. MÓDULO: DASHBOARDS DE BI

### 8.1 Dashboard Executivo

**KPI Cards no topo:**
- Faturamento do mês (com % MoM)
- Forecast Accuracy (com variação)
- Giro de Estoque (com variação)
- Fill Rate OTIF (com variação)

**Gráfico principal:** Faturamento Real vs. Previsto (12 meses passados + projeção 3 meses), com bandas P10-P90.

**Gráficos secundários:**
- Pareto ABC (clicável por classe)
- Cobertura de Estoque (mapa de calor: SKU × dias de cobertura)

**Alertas ativos:** SKUs em ruptura, próximos ao ROP, centros sobrecarregados, armazéns cheios.

### 8.2 Dashboard Forecast e Faturamento

1. Seletor de SKU (busca) + Seletor de período + Seletor de agregação
2. Gráfico principal: histórico real + previsão P50 + bandas P10-P90
3. Gráfico secundário: faturamento real vs. previsão indireta (azul) vs. TFT direto (verde)
4. Tabela de métricas: MAPE, MAE, RMSE, Bias por SKU
5. Ranking: Top 10 SKUs com melhor e pior accuracy
6. Importância de variáveis: gráfico de barras (do TFT)
7. Comparação com baseline: TFT vs. Média Móvel vs. Holt-Winters

### 8.3 Dashboard MRP e Compras

1. Timeline Gantt de ordens planejadas (compra=azul, produção=verde)
2. Tabela MRP detalhada (seletor de SKU): NB, RP, EP, NL, OP por período
3. Painel de compras agrupado por fornecedor com ações
4. Mensagens de ação: lista priorizada
5. Projeção de estoque: gráfico por SKU mostrando estoque futuro vs. SS/ROP/Max

### 8.4 Dashboard de Capacidade

1. Barras empilhadas por centro de trabalho (carga vs. capacidade)
2. Heatmap semanal: centros × semanas, colorido por % utilização
3. Timeline de eventos: quebras, novos maquinários, mudanças de turno
4. Gauge de ocupação por depósito + projeção futura
5. Alertas de sobrecarga com sugestões de ação

---

## 9. CRITÉRIOS DE QUALIDADE

| Métrica | Meta Classe A | Meta Classe B | Meta Classe C |
|---|---|---|---|
| Forecast MAPE (volume) | < 10% | < 20% | < 35% |
| Forecast MAPE (faturamento) | < 12% | < 22% | < 35% |
| Fill Rate (OTIF) | > 97% | > 93% | > 85% |
| Giro de Estoque | > 8x/ano | > 5x/ano | > 3x/ano |
| Ruptura de Estoque | < 2% dos SKUs | < 5% | < 10% |
| Acurácia do SS | Cobertura real ≥ nível de serviço definido | | |
| Tempo processamento diário | < 15 min (ingestão + forecast + MRP) | | |
| Disponibilidade do sistema | > 99,5% | | |

---

## 10. ROADMAP DE IMPLEMENTAÇÃO

### Fase 0 — Setup (Semana 1)

- [ ] Criar repositório monorepo (Turborepo)
- [ ] Setup Docker Compose: PostgreSQL 16, Redis, NestJS, FastAPI, Next.js
- [ ] Criar schema inicial do banco (todas as tabelas de cadastro)
- [ ] Configurar CI/CD básico (GitHub Actions → build + lint + test)
- [ ] Criar seed de dados para desenvolvimento (dados sintéticos)

### Fase 1 — Fundação (Semanas 2-5)

- [ ] Backend NestJS: módulos auth (JWT, guards, roles), CRUD produtos, BOM, fornecedores
- [ ] Backend NestJS: módulo inventário (CRUD + upload de planilha)
- [ ] Backend NestJS: módulo capacidade (centros, turnos, paradas, eventos)
- [ ] Frontend: telas de cadastro (produtos, BOM com árvore, fornecedores)
- [ ] Frontend: tela de capacidade (centros, turnos, eventos dinâmicos)
- [ ] Frontend: tela de inventário (tabela + upload)
- [ ] Pipeline de ingestão: upload CSV/XLSX + mapeamento + ETL básico
- [ ] Classificação automática: ABC, XYZ, padrão de demanda

### Fase 2 — Inteligência (Semanas 6-9)

- [ ] Microserviço FastAPI: endpoints de treino e predição
- [ ] Implementar TFT (volume) com pipeline completo
- [ ] Implementar TFT (faturamento) como segundo modelo
- [ ] Implementar ETS (Holt-Winters) como fallback
- [ ] Implementar Croston/TSB para intermitentes
- [ ] Backtesting automático + métricas de accuracy
- [ ] Integração NestJS ↔ FastAPI via BullMQ
- [ ] Frontend: dashboard de forecast (gráficos, métricas, comparação)

### Fase 3 — MRP (Semanas 10-13)

- [ ] Motor MRP: MPS, explosão multinível, necessidade líquida
- [ ] Motor MRP: lotificação (L4L, EOQ, Silver-Meal)
- [ ] Motor MRP: cálculo de SS/ROP/Min/Max (quantis TFT + fórmula clássica)
- [ ] Motor MRP: geração de ordens de compra e produção
- [ ] Motor MRP: mensagens de ação
- [ ] CRP: cálculo de carga vs. capacidade
- [ ] Validação de capacidade de armazenamento
- [ ] Frontend: dashboard MRP (Gantt, tabela detalhada)
- [ ] Frontend: painel de compras (o quê, quando, de quem)
- [ ] Frontend: dashboard de capacidade (carga, alertas)

### Fase 4 — Automação e BI (Semanas 14-17)

- [ ] Email Listener (Gmail API ou IMAP)
- [ ] Conector ERP (API ou banco direto)
- [ ] Pipeline automático diário (ingestão → forecast → MRP → alertas)
- [ ] Resumo diário por email
- [ ] Dashboard executivo (KPIs, faturamento, Pareto, alertas)
- [ ] LightGBM + Ensemble para classe A
- [ ] Cenários what-if (slider de ajuste)
- [ ] Exportação Excel/PDF

### Fase 5 — Refinamento (Semanas 18-22)

- [ ] Wagner-Whitin (lotificação ótima)
- [ ] Monte Carlo para SS de classe A
- [ ] Champion-challenger automático de modelos
- [ ] Detecção de drift e re-treino automático
- [ ] Override manual de forecast com log
- [ ] Versionamento de BOM
- [ ] Histórico de lead time real (cálculo de σ_LT)
- [ ] Relatórios PDF gerenciais
- [ ] Testes de integração e carga
- [ ] Deploy em produção (EKS)

---

## 11. ESTRUTURA DE PASTAS DO PROJETO

```
forecasting-mrp/
├── apps/
│   ├── web/                          # Next.js 14 (frontend)
│   │   ├── app/
│   │   │   ├── (auth)/              # Login, registro
│   │   │   ├── dashboard/           # Dashboard executivo
│   │   │   ├── forecast/            # Telas de forecast
│   │   │   ├── mrp/                 # Telas de MRP
│   │   │   ├── compras/             # Painel de compras
│   │   │   ├── cadastros/
│   │   │   │   ├── produtos/
│   │   │   │   ├── bom/
│   │   │   │   ├── fornecedores/
│   │   │   │   └── capacidade/      # Centros, turnos, eventos
│   │   │   ├── inventario/
│   │   │   ├── ingestao/            # Upload, mapeamento, ETL
│   │   │   ├── automacao/           # Config de email, agendamentos
│   │   │   └── config/              # Settings do sistema
│   │   ├── components/
│   │   │   ├── charts/              # Wrappers ECharts
│   │   │   ├── tables/              # DataTables com filtros
│   │   │   └── forms/               # Formulários reutilizáveis
│   │   └── lib/                     # API client, utils
│   │
│   ├── api/                          # NestJS (backend principal)
│   │   ├── src/
│   │   │   ├── auth/                # JWT, guards, roles
│   │   │   ├── produtos/            # CRUD produtos
│   │   │   ├── bom/                 # CRUD BOM + explosão
│   │   │   ├── fornecedores/        # CRUD fornecedores
│   │   │   ├── capacidade/          # Centros, turnos, eventos, calendário
│   │   │   ├── inventario/          # Posição de estoque
│   │   │   ├── ingestao/            # Upload, mapeamento, ETL
│   │   │   ├── mrp/                 # Motor MRP completo
│   │   │   ├── forecast/            # Orquestração (chama FastAPI)
│   │   │   ├── automacao/           # Email listener, scheduler
│   │   │   ├── notificacao/         # Email, webhook
│   │   │   └── common/              # Filtros, interceptors, DTOs
│   │   └── prisma/                  # Schema Prisma (ORM)
│   │
│   └── forecast-engine/              # FastAPI (microserviço Python)
│       ├── app/
│       │   ├── models/
│       │   │   ├── tft_trainer.py
│       │   │   ├── tft_predictor.py
│       │   │   ├── ets_model.py
│       │   │   ├── croston_model.py
│       │   │   ├── lightgbm_model.py
│       │   │   └── ensemble.py
│       │   ├── etl/
│       │   │   ├── feature_engineering.py
│       │   │   └── data_preparation.py
│       │   ├── metrics/
│       │   │   ├── accuracy.py
│       │   │   └── backtesting.py
│       │   ├── routes/
│       │   │   ├── train.py
│       │   │   ├── predict.py
│       │   │   └── metrics.py
│       │   └── workers/
│       │       └── training_worker.py
│       ├── models/                   # Modelos treinados (.ckpt)
│       └── requirements.txt
│
├── packages/
│   └── shared/                       # Tipos TypeScript compartilhados
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── turbo.json
└── README.md
```

---

## 12. REFERÊNCIA RÁPIDA DE REGRAS DE NEGÓCIO

Esta seção consolida TODAS as regras de negócio para referência rápida durante o desenvolvimento.

### Forecasting
- `[R-F01]` Seleção de modelo é automática por classificação ABC/XYZ mas permite override manual
- `[R-F02]` TFT re-treina mensalmente OU quando MAPE degradar >5 pontos percentuais
- `[R-F03]` Inference semanal usa modelo já treinado (não re-treina)
- `[R-F04]` Faturamento previsto usa DUAS abordagens em paralelo (indireta + TFT direto)
- `[R-F05]` Quando as duas previsões de faturamento divergem muito → flag de atenção
- `[R-F06]` SKUs com <40 semanas de dados usam ETS simples, não TFT
- `[R-F07]` SKUs intermitentes (>25% zeros) usam Croston/TSB, nunca TFT

### MRP
- `[R-M01]` MPS: demanda(t) = MAX(forecast_P50(t), pedidos_firmes(t))
- `[R-M02]` Horizonte de pedido firme: 2-4 semanas (configurável)
- `[R-M03]` Low-Level Coding: se item aparece em múltiplos níveis, usar o MAIOR
- `[R-M04]` Cálculo com perda: Qtd = Qtd_BOM × Qtd_pai ÷ (1 - perda/100)
- `[R-M05]` Lotificação respeita: lote_minimo → multiplo_compra → MOQ (nesta ordem)
- `[R-M06]` Fornecedor principal primeiro; se MOQ > necessidade, usar secundário
- `[R-M07]` Prioridade: CRITICA (ruptura) > ALTA (abaixo SS) > MEDIA (projeção < ROP) > BAIXA

### Estoque
- `[R-E01]` Se TFT disponível: SS = P(nivel_servico) - P50 acumulada no LT
- `[R-E02]` Se TFT não disponível: SS = Z × √(LT × σ²_d + d̄² × σ²_LT)
- `[R-E03]` estoque_seguranca_manual IS NOT NULL → usa valor manual, não calcula
- `[R-E04]` Z: 1.88 (97% classe A), 1.48 (93% classe B), 1.04 (85% classe C)

### Capacidade
- `[R-C01]` Cap. efetiva = Cap. nominal × Eficiência / 100
- `[R-C02]` Cap. diária = Σ horas turnos ativos - paradas - feriados
- `[R-C03]` Evento de capacidade → recalcular automaticamente CRP
- `[R-C04]` Sobrecarga ≤10%: hora extra | 10-30%: antecipar | >30%: subcontratar
- `[R-C05]` Armazém > 90%: alerta | > 95%: alerta crítico

### Automação
- `[R-A01]` Pipeline diário: ingestão → inference → MRP → alertas
- `[R-A02]` Email listener: retry 06:30, 07:00, 07:30. Dead letter após 4 falhas
- `[R-A03]` Re-treino mensal: champion-challenger (só promove se melhor)
- `[R-A04]` Resumo diário enviado automaticamente com faturamento, alertas, compras, capacidade

---

*Este PRD é o documento definitivo para Claude Code. Cada módulo está completamente especificado com regras de negócio, modelo de dados, algoritmos e interfaces. Siga o roadmap sequencialmente e consulte a seção de referência rápida durante a implementação.*
