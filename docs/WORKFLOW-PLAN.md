# Workflow Plan — Greenfield Fullstack

**Projeto:** ForecastingMRP — Industrial Forecasting + MRP/MRP II + BI
**Workflow:** `greenfield-fullstack.yaml`
**Criado:** 2026-02-25
**Status:** DRAFT

---

## Estado Atual

| Item | Status |
|------|--------|
| Repositório Git | Inicializado (branch `master`) |
| PRD | Completo (`PRD.md` — 1313 linhas, 7 componentes, 6 fases) |
| Framework AIOS | Configurado (`.aios-core/`) |
| Docs/Stories | Nenhum artefato criado ainda |
| Infraestrutura | Nada provisionado |

---

## Visão Geral das Fases

```
PHASE 0: Environment Bootstrap     → @devops
PHASE 1: Discovery & Planning      → @analyst → @pm → @ux → @architect → @po
PHASE 2: Document Sharding         → @po
PHASE 3: Development Cycle         → @sm → @dev → @qa (iterativo por epic)
```

---

## PHASE 0 — Environment Bootstrap

**Agente:** `@devops`
**Comando:** `@devops → *environment-bootstrap`
**Duração estimada:** 15-30 min

### Checklist

- [ ] Verificar/instalar CLIs (git, gh, node, docker, pnpm/npm)
- [ ] Autenticar GitHub (`gh auth`)
- [ ] Criar repositório remoto no GitHub
- [ ] Configurar branch strategy (`main` como default, `develop` para work)
- [ ] Scaffold da estrutura monorepo (Turborepo):
  - `apps/web/` (Next.js 14)
  - `apps/api/` (NestJS)
  - `apps/forecast-engine/` (FastAPI)
  - `packages/shared/` (tipos TypeScript)
- [ ] Docker Compose: PostgreSQL 16 + Redis
- [ ] CI/CD básico (GitHub Actions: build + lint + test)
- [ ] `.aios/environment-report.json` gerado

### Artefatos Gerados

| Artefato | Path |
|----------|------|
| Config AIOS | `.aios/config.yaml` |
| Environment Report | `.aios/environment-report.json` |
| Gitignore | `.gitignore` |
| Docker Compose | `docker-compose.yml` |
| Turbo Config | `turbo.json` |
| Package root | `package.json` |

---

## PHASE 1 — Discovery & Planning

### Step 1.1: Project Brief (`@analyst`)

**Comando:** `@analyst → criar project brief`
**Input:** PRD.md (já existente)
**Output:** `docs/project-brief.md`
**Duração:** 30-60 min

> **NOTA:** O PRD já está completo e detalhado. O project brief será um resumo executivo extraído do PRD, não uma pesquisa do zero.

**Opcional:**
- Brainstorming session (identificar gaps no PRD)
- Market research (benchmarking com sistemas ERP/MRP existentes)

### Step 1.2: PRD Refinement (`@pm`)

**Comando:** `@pm → refinar PRD`
**Input:** `PRD.md` + `docs/project-brief.md`
**Output:** `docs/prd.md` (versão validada pelo PM)
**Duração:** 30-60 min

> **NOTA:** O PRD já existe na raiz. Este step valida e formata o PRD para o padrão AIOS, adicionando IDs de FR/NFR/CON conforme necessário.

**Ações esperadas:**
- Converter roadmap em Epics numerados (Epic 1-6 mapeando Fases 0-5)
- Adicionar IDs formais: FR-001, NFR-001, CON-001
- Validar completude vs template AIOS

### Step 1.3: Frontend Spec (`@ux-design-expert`)

**Comando:** `@ux-design-expert → criar front-end spec`
**Input:** `docs/prd.md`
**Output:** `docs/front-end-spec.md`
**Duração:** 30-45 min

**Telas a especificar (do PRD seção 11):**
1. Login/Registro (`(auth)/`)
2. Dashboard Executivo (`dashboard/`)
3. Forecast + Faturamento (`forecast/`)
4. MRP + Gantt (`mrp/`)
5. Painel de Compras (`compras/`)
6. Cadastros: Produtos, BOM (árvore), Fornecedores, Capacidade (`cadastros/`)
7. Inventário + Upload (`inventario/`)
8. Ingestão + Mapeamento ETL (`ingestao/`)
9. Automação + Config (`automacao/`, `config/`)

**Opcional:** Gerar prompt v0/Lovable para prototipagem rápida de UI

### Step 1.4: Architecture (`@architect`)

**Comando:** `@architect → criar fullstack architecture`
**Input:** `docs/prd.md` + `docs/front-end-spec.md`
**Output:** `docs/fullstack-architecture.md`
**Duração:** 30-60 min

**Decisões arquiteturais a definir:**
- Monorepo structure (Turborepo) — confirmado pelo PRD
- API design patterns (REST + WebSocket para jobs)
- Database schema strategy (Prisma ORM)
- ML pipeline architecture (FastAPI + BullMQ workers)
- Auth strategy (JWT + roles)
- Caching strategy (Redis)
- Deploy strategy (Docker Compose dev → EKS prod)

### Step 1.5: PRD Update (condicional)

**Agente:** `@pm`
**Condição:** Se `@architect` sugerir mudanças no PRD
**Output:** `docs/prd.md` (atualizado)

### Step 1.6: Validation (`@po`)

**Comando:** `@po → validar artefatos`
**Checklist:** `po-master-checklist.md`
**Duração:** 15-30 min

**Valida:**
- Consistência PRD ↔ Architecture ↔ Frontend Spec
- Completude dos requisitos (FR/NFR/CON)
- Rastreabilidade (cada feature → requisito)
- Factibilidade técnica

---

## PHASE 2 — Document Sharding

**Agente:** `@po`
**Comando:** `@po → *shard-doc docs/prd.md`
**Duração:** 15-30 min

### Shards Esperados

```
docs/
├── prd/
│   ├── epic-0-setup.md
│   ├── epic-1-fundacao.md
│   ├── epic-2-inteligencia.md
│   ├── epic-3-mrp.md
│   ├── epic-4-automacao-bi.md
│   └── epic-5-refinamento.md
├── architecture/
│   ├── source-tree.md
│   ├── tech-stack.md
│   └── coding-standards.md
├── front-end-spec.md
├── fullstack-architecture.md
├── project-brief.md
└── prd.md
```

---

## PHASE 3 — Development Cycle

### Mapeamento PRD Roadmap → Epics

| Epic | PRD Fase | Escopo | Stories Est. |
|------|----------|--------|-------------|
| **Epic 0** | Fase 0 — Setup | Monorepo, Docker, schema, CI/CD, seed | 3-5 |
| **Epic 1** | Fase 1 — Fundação | Auth, CRUDs, cadastros, inventário, ingestão, classificação | 8-12 |
| **Epic 2** | Fase 2 — Inteligência | FastAPI, TFT, ETS, Croston, backtesting, BullMQ, dashboard forecast | 8-10 |
| **Epic 3** | Fase 3 — MRP | MPS, explosão BOM, lotificação, SS/ROP, CRP, ordens, painel compras | 10-12 |
| **Epic 4** | Fase 4 — Automação & BI | Email listener, ERP connector, pipeline automático, dashboards BI | 8-10 |
| **Epic 5** | Fase 5 — Refinamento | Wagner-Whitin, Monte Carlo, champion-challenger, drift, deploy prod | 8-10 |

**Total estimado:** 45-59 stories

### Ciclo por Story (SDC)

```
Para cada Epic:
  Para cada Story:
    1. @sm → *create-next-story    (15-30 min)
    2. @po → validate story        (10-20 min, opcional)
    3. @dev → implement story      (1-4 horas)
    4. @qa → review implementation (20-40 min, opcional)
    5. @dev → address QA feedback  (30-60 min, se necessário)
    6. @devops → *push             (quando pronto para merge)
```

### Prioridade de Implementação

| Prioridade | Epic | Justificativa |
|-----------|------|---------------|
| 1 | Epic 0 (Setup) | Infraestrutura base para tudo |
| 2 | Epic 1 (Fundação) | CRUDs e dados mestres necessários para forecast/MRP |
| 3 | Epic 2 (Inteligência) | Forecast alimenta MRP |
| 4 | Epic 3 (MRP) | Depende de forecast + dados mestres |
| 5 | Epic 4 (Automação/BI) | Depende de todos os motores funcionando |
| 6 | Epic 5 (Refinamento) | Otimizações e deploy final |

---

## Decisões Pendentes

| # | Decisão | Responsável | Impacto |
|---|---------|-------------|---------|
| 1 | Usar Turborepo ou pnpm workspaces? | @architect | Estrutura monorepo |
| 2 | Prisma ou TypeORM para NestJS? | @architect | Data layer |
| 3 | TimescaleDB ativado desde o início? | @data-engineer | Séries temporais |
| 4 | Gerar UI com v0/Lovable? | Usuário | Velocidade de frontend |
| 5 | GitHub org ou repo pessoal? | @devops | CI/CD setup |

---

## Próximo Passo

**Iniciar Phase 0:** `@devops → *environment-bootstrap`

Ou, se o ambiente já estiver parcialmente configurado, pular para **Phase 1** com `@analyst`.

---

*Plano gerado por Orion (aios-master) — Workflow: greenfield-fullstack v1.0*
