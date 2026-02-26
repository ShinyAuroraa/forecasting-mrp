# Source Tree — ForecastingMRP

> Quick reference for project directory structure. Full details in [2-monorepo-structure.md](./2-monorepo-structure.md).

```
forecasting-mrp/
|-- turbo.json                          # Build pipeline configuration
|-- package.json                        # Root workspace (pnpm)
|-- pnpm-workspace.yaml                 # Workspace definition
|-- docker-compose.yml                  # Dev environment services
|-- .env.example                        # Environment variable template
|-- .github/
|   |-- workflows/
|   |   |-- ci.yml                      # PR pipeline: lint + typecheck + test + build
|   |   |-- deploy.yml                  # Main: build + deploy
|   |   |-- forecast-engine.yml         # Python-specific CI (pytest, mypy, ruff)
|
|-- apps/
|   |-- web/                            # Next.js 14 (App Router) — Frontend
|   |   |-- src/
|   |   |   |-- app/                    # App Router pages and layouts
|   |   |   |   |-- (auth)/             # Auth routes (login, register)
|   |   |   |   |-- (dashboard)/        # Protected dashboard routes
|   |   |   |   |-- layout.tsx          # Root layout with providers
|   |   |   |-- components/             # Shared UI components
|   |   |   |   |-- ui/                 # Shadcn/UI base components
|   |   |   |   |-- charts/            # ECharts wrapper components
|   |   |   |   |-- forms/             # Form components with validation
|   |   |   |   |-- layout/            # Layout components (sidebar, header)
|   |   |   |-- lib/                    # Utilities, API client, hooks
|   |   |   |-- styles/                 # Global styles, Tailwind config
|   |   |-- next.config.js
|   |   |-- tailwind.config.ts
|   |   |-- package.json
|   |
|   |-- api/                            # NestJS — Backend API
|   |   |-- src/
|   |   |   |-- modules/                # Feature modules (one per domain)
|   |   |   |   |-- auth/               # Authentication (JWT)
|   |   |   |   |-- produtos/           # Product management
|   |   |   |   |-- bom/                # Bill of Materials
|   |   |   |   |-- fornecedores/       # Supplier management
|   |   |   |   |-- capacidade/         # Production capacity
|   |   |   |   |-- inventario/         # Inventory & warehouses
|   |   |   |   |-- ingestao/           # Data ingestion
|   |   |   |   |-- forecast/           # Forecast orchestration
|   |   |   |   |-- mrp/                # MRP/MRP II engine
|   |   |   |   |-- automacao/          # Daily automation
|   |   |   |   |-- notificacao/        # Alert & notification system
|   |   |   |-- common/                 # Shared: filters, interceptors, DTOs
|   |   |   |-- config/                 # Configuration module
|   |   |   |-- prisma/                 # Prisma service, migrations
|   |   |   |-- main.ts                 # Bootstrap
|   |   |   |-- app.module.ts           # Root module
|   |   |-- prisma/
|   |   |   |-- schema.prisma           # Database schema (26 tables)
|   |   |   |-- migrations/             # Prisma migrations
|   |   |   |-- seed.ts                 # Synthetic seed data (FR-005)
|   |   |-- test/                       # Integration tests
|   |   |-- package.json
|   |
|   |-- forecast-engine/                # FastAPI — ML/Forecasting Service
|   |   |-- src/
|   |   |   |-- api/                    # FastAPI routes (train, predict, health)
|   |   |   |-- models/                 # ML model implementations
|   |   |   |   |-- tft/               # Temporal Fusion Transformer
|   |   |   |   |-- ets/               # ETS/Holt-Winters
|   |   |   |   |-- croston/           # Croston/TSB
|   |   |   |   |-- lgbm/             # LightGBM
|   |   |   |-- pipeline/               # Execution pipeline steps
|   |   |   |-- features/               # Feature engineering
|   |   |   |-- backtesting/            # Backtesting framework
|   |   |   |-- workers/                # BullMQ job consumers
|   |   |   |-- db/                     # Database access (SQLAlchemy)
|   |   |   |-- config.py               # Configuration
|   |   |   |-- main.py                 # FastAPI app bootstrap
|   |   |-- tests/                      # Python tests (pytest)
|   |   |-- requirements.txt
|   |   |-- Dockerfile
|   |   |-- pyproject.toml
|
|-- packages/
|   |-- shared/                         # Shared TypeScript types and utilities
|   |   |-- src/
|   |   |   |-- types/
|   |   |   |   |-- entities/           # Entity types (Product, Supplier, BOM, etc.)
|   |   |   |   |-- api/               # API request/response types
|   |   |   |   |-- enums.ts           # Shared enums
|   |   |   |-- utils/                 # Shared utility functions
|   |   |   |-- constants/             # Shared constants (roles, config keys)
|   |   |   |-- index.ts               # Barrel export
|   |   |-- package.json
|
|-- docs/                               # Project documentation
|   |-- prd.md                          # PRD v2.1
|   |-- prd/                            # Sharded PRD (by section)
|   |-- fullstack-architecture.md       # Architecture v1.0
|   |-- architecture/                   # Sharded architecture (by section)
|   |-- front-end-spec.md              # Frontend UI/UX Specification
|   |-- project-brief.md              # Project brief
|   |-- stories/                       # Development stories
```
