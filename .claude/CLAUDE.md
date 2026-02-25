# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**Synkra AIOS** — AI-Orchestrated System for Full Stack Development (v4.31.1).
**Current Project:** ForecastingMRP — Industrial Forecasting + MRP/MRP II + BI system.
**PRD:** `PRD.md` (root) — contains all functional requirements (FR), non-functional requirements (NFR), and constraints (CON).

**Target Tech Stack** (defined in PRD):
- Frontend: Next.js 14 (App Router) + Tailwind + Shadcn/UI + Apache ECharts
- Backend: NestJS (TypeScript)
- ML/Forecasting: FastAPI (Python) with PyTorch, scikit-learn, statsmodels
- Database: PostgreSQL 16 with TimescaleDB
- Queue: Redis + BullMQ
- Infrastructure: Docker Compose (dev), AWS EKS (prod)

<!-- AIOS-MANAGED-START: core-framework -->
## Core Framework Understanding

Synkra AIOS is a meta-framework that orchestrates AI agents to handle complex development workflows. Always recognize and work within this architecture.
<!-- AIOS-MANAGED-END: core-framework -->

<!-- AIOS-MANAGED-START: constitution -->
## Constitution

O AIOS possui uma **Constitution formal** com princípios inegociáveis e gates automáticos.

**Documento completo:** `.aios-core/constitution.md`

**Princípios fundamentais:**

| Artigo | Princípio | Severidade |
|--------|-----------|------------|
| I | CLI First | NON-NEGOTIABLE |
| II | Agent Authority | NON-NEGOTIABLE |
| III | Story-Driven Development | MUST |
| IV | No Invention | MUST |
| V | Quality First | MUST |
| VI | Absolute Imports | SHOULD |

**Gates automáticos bloqueiam violações.** Consulte a Constitution para detalhes completos.
<!-- AIOS-MANAGED-END: constitution -->

<!-- AIOS-MANAGED-START: sistema-de-agentes -->
## Sistema de Agentes

### Ativação de Agentes
Use `@agent-name` ou `/AIOS:agents:agent-name`:

| Agente | Persona | Escopo Principal |
|--------|---------|------------------|
| `@dev` | Dex | Implementação de código |
| `@qa` | Quinn | Testes e qualidade |
| `@architect` | Aria | Arquitetura e design técnico |
| `@pm` | Morgan | Product Management |
| `@po` | Pax | Product Owner, stories/epics |
| `@sm` | River | Scrum Master |
| `@analyst` | Alex | Pesquisa e análise |
| `@data-engineer` | Dara | Database design |
| `@ux-design-expert` | Uma | UX/UI design |
| `@devops` | Gage | CI/CD, git push (EXCLUSIVO) |

### Comandos de Agentes
Use prefixo `*` para comandos:
- `*help` - Mostrar comandos disponíveis
- `*create-story` - Criar story de desenvolvimento
- `*task {name}` - Executar task específica
- `*exit` - Sair do modo agente
<!-- AIOS-MANAGED-END: sistema-de-agentes -->

<!-- AIOS-MANAGED-START: agent-system -->
## Agent System

### Agent Activation
- Agents are activated with @agent-name syntax: @dev, @qa, @architect, @pm, @po, @sm, @analyst
- The master agent is activated with @aios-master
- Agent commands use the * prefix: *help, *create-story, *task, *exit

### Agent Context
When an agent is active:
- Follow that agent's specific persona and expertise
- Use the agent's designated workflow patterns
- Maintain the agent's perspective throughout the interaction
<!-- AIOS-MANAGED-END: agent-system -->

## Development Methodology

### Story-Driven Development
1. All development starts with a story in `docs/stories/` — no code without a story
2. Update progress — mark checkboxes as tasks complete: `[ ]` → `[x]`
3. Maintain the **File List** section in the story with every file created/modified
4. Implement exactly what the acceptance criteria specify (Article IV: No Invention)

### Build & Test Commands
All commands run from `.aios-core/`:
```bash
npm run build          # Build core framework
npm test               # Full test suite (unit + integration)
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests only
npm run lint           # ESLint
npm run typecheck      # TypeScript type checking
```

### AIOS CLI Commands
```bash
aios doctor            # Run system diagnostics (health checks)
aios info              # Show system information
aios config show       # Show layered configuration
aios config validate   # Validate configuration
aios workers           # Manage and discover workers
aios manifest validate # Validate manifest files
aios qa run            # Run Quality Gate
aios qa status         # Check QA status
aios metrics show      # Show quality metrics
aios graph --deps      # Dependency tree visualization
aios mcp               # Manage MCP configuration (@devops only)
```

<!-- AIOS-MANAGED-START: framework-structure -->
## AIOS Framework Structure

```
aios-core/
├── agents/         # Agent persona definitions (YAML/Markdown)
├── tasks/          # Executable task workflows
├── workflows/      # Multi-step workflow definitions
├── templates/      # Document and code templates
├── checklists/     # Validation and review checklists
└── rules/          # Framework rules and patterns

docs/
├── stories/        # Development stories (numbered)
├── prd/            # Product requirement documents
├── architecture/   # System architecture documentation
└── guides/         # User and developer guides
```
<!-- AIOS-MANAGED-END: framework-structure -->

<!-- AIOS-MANAGED-START: framework-boundary -->
## Framework vs Project Boundary

O AIOS usa um modelo de 4 camadas (L1-L4) para separar artefatos do framework e do projeto. Deny rules em `.claude/settings.json` reforçam isso deterministicamente.

| Camada | Mutabilidade | Paths | Notas |
|--------|-------------|-------|-------|
| **L1** Framework Core | NEVER modify | `.aios-core/core/`, `.aios-core/constitution.md`, `bin/aios.js`, `bin/aios-init.js` | Protegido por deny rules |
| **L2** Framework Templates | NEVER modify | `.aios-core/development/tasks/`, `.aios-core/development/templates/`, `.aios-core/development/checklists/`, `.aios-core/development/workflows/`, `.aios-core/infrastructure/` | Extend-only |
| **L3** Project Config | Mutable (exceptions) | `.aios-core/data/`, `agents/*/MEMORY.md`, `core-config.yaml` | Allow rules permitem |
| **L4** Project Runtime | ALWAYS modify | `docs/stories/`, `packages/`, `squads/`, `tests/` | Trabalho do projeto |

**Toggle:** `core-config.yaml` → `boundary.frameworkProtection: true/false` controla se deny rules são ativas (default: true para projetos, false para contribuidores do framework).

> **Referência formal:** `.claude/settings.json` (deny/allow rules), `.claude/rules/agent-authority.md`
<!-- AIOS-MANAGED-END: framework-boundary -->

<!-- AIOS-MANAGED-START: rules-system -->
## Rules System

O AIOS carrega regras contextuais de `.claude/rules/` automaticamente. Regras com frontmatter `paths:` só carregam quando arquivos correspondentes são editados.

| Rule File | Description |
|-----------|-------------|
| `agent-authority.md` | Agent delegation matrix and exclusive operations |
| `agent-handoff.md` | Agent switch compaction protocol for context optimization |
| `agent-memory-imports.md` | Agent memory lifecycle and CLAUDE.md ownership |
| `coderabbit-integration.md` | Automated code review integration rules |
| `ids-principles.md` | Incremental Development System principles |
| `mcp-usage.md` | MCP server usage rules and tool selection priority |
| `story-lifecycle.md` | Story status transitions and quality gates |
| `workflow-execution.md` | 4 primary workflows (SDC, QA Loop, Spec Pipeline, Brownfield) |

> **Diretório:** `.claude/rules/` — rules são carregadas automaticamente pelo Claude Code quando relevantes.
<!-- AIOS-MANAGED-END: rules-system -->

<!-- AIOS-MANAGED-START: code-intelligence -->
## Code Intelligence

O AIOS possui um sistema de code intelligence opcional que enriquece operações com dados de análise de código.

| Status | Descrição | Comportamento |
|--------|-----------|---------------|
| **Configured** | Provider ativo e funcional | Enrichment completo disponível |
| **Fallback** | Provider indisponível | Sistema opera normalmente sem enrichment — graceful degradation |
| **Disabled** | Nenhum provider configurado | Funcionalidade de code-intel ignorada silenciosamente |

**Graceful Fallback:** Code intelligence é sempre opcional. `isCodeIntelAvailable()` verifica disponibilidade antes de qualquer operação. Se indisponível, o sistema retorna o resultado base sem modificação — nunca falha.

**Diagnóstico:** `aios doctor` inclui check de code-intel provider status.

> **Referência:** `.aios-core/core/code-intel/` — provider interface, enricher, client
<!-- AIOS-MANAGED-END: code-intelligence -->

<!-- AIOS-MANAGED-START: graph-dashboard -->
## Graph Dashboard

O CLI `aios graph` visualiza dependências, estatísticas de entidades e status de providers.

### Comandos

```bash
aios graph --deps                        # Dependency tree (ASCII)
aios graph --deps --format=json          # Output como JSON
aios graph --deps --format=html          # Interactive HTML (abre browser)
aios graph --deps --format=mermaid       # Mermaid diagram
aios graph --deps --format=dot           # DOT format (Graphviz)
aios graph --deps --watch                # Live mode com auto-refresh
aios graph --deps --watch --interval=10  # Refresh a cada 10 segundos
aios graph --stats                       # Entity stats e cache metrics
```

**Formatos de saída:** ascii (default), json, dot, mermaid, html

> **Referência:** `.aios-core/core/graph-dashboard/` — CLI, renderers, data sources
<!-- AIOS-MANAGED-END: graph-dashboard -->

## Workflow Execution

Task definitions live in `.aios-core/development/tasks/` — always read the complete task file before executing. Workflows with `elicit: true` require user input at defined points.

**4 Primary Workflows** (details in `.claude/rules/workflow-execution.md`):
1. **SDC** (Story Development Cycle): @sm draft → @po validate → @dev implement → @qa gate
2. **QA Loop**: @qa review → @dev fix → re-review (max 5 iterations)
3. **Spec Pipeline**: 3-6 phases depending on complexity class (SIMPLE/STANDARD/COMPLEX)
4. **Brownfield Discovery**: 10-phase technical debt assessment for existing codebases

## Git Conventions

- Conventional commits with story reference: `feat: implement IDE detection [Story 2.1]`
- Only `@devops` can `git push` and `gh pr create` — delegate via `@devops *push`
- `@dev` can: `git add`, `git commit`, `git branch`, `git checkout`, `git merge` (local), `git stash`, `git diff`, `git log`

<!-- AIOS-MANAGED-START: aios-patterns -->
## AIOS-Specific Patterns

### Working with Templates
```javascript
const template = await loadTemplate('template-name');
const rendered = await renderTemplate(template, context);
```

### Agent Command Handling
```javascript
if (command.startsWith('*')) {
  const agentCommand = command.substring(1);
  await executeAgentCommand(agentCommand, args);
}
```

### Story Updates
```javascript
// Update story progress
const story = await loadStory(storyId);
story.updateTask(taskId, { status: 'completed' });
await story.save();
```
<!-- AIOS-MANAGED-END: aios-patterns -->

## Key Configuration Files

- `.aios-core/core-config.yaml` — Framework configuration (project type, boundary protection, lazy loading)
- `.claude/settings.json` — Claude Code deny/allow rules enforcing framework boundary
- `.env` — Environment variables (use `.env.example` as reference)

<!-- AIOS-MANAGED-START: common-commands -->
## Common Commands

### AIOS Master Commands
- `*help` - Show available commands
- `*create-story` - Create new story
- `*task {name}` - Execute specific task
- `*workflow {name}` - Run workflow

### Development Commands
- `npm run dev` - Start development
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run build` - Build project
<!-- AIOS-MANAGED-END: common-commands -->

## Core Architecture

The framework runtime lives in `.aios-core/core/` with 24 modules:

| Module | Purpose |
|--------|---------|
| `config/` | Layered config with caching, lazy loading, env interpolation |
| `session/` | Context detection (project type, active story, branch) |
| `orchestration/` | Agent invocation, workflow executor, task assignment |
| `elicitation/` | Interactive prompting engine for agents/tasks/workflows |
| `quality-gates/` | 3-layer validation: precommit → PR automation → human review |
| `registry/` | Service and component registry (build, validate, load) |
| `health-check/` | Subsystem diagnostics (used by `aios doctor`) |
| `graph-dashboard/` | Dependency visualization (ASCII, JSON, HTML, Mermaid, DOT) |
| `code-intel/` | Optional code analysis enrichment (graceful fallback if unavailable) |
| `memory/` | Agent memory lifecycle and CLAUDE.md imports |
| `permissions/` | RBAC and agent boundary enforcement |
| `events/` | Event bus for framework-internal communication |
| `migration/` | Config and schema migration (v2 → v4) |
| `mcp/` | MCP server management (Docker MCP Toolkit integration) |

Agent personas are defined in `.aios-core/development/agents/*.md`. Task definitions (115+) are in `.aios-core/development/tasks/`.

## Debugging

```bash
export AIOS_DEBUG=true    # Enable debug mode
aios doctor               # Run full system diagnostics
```
