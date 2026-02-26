# Tech Stack — ForecastingMRP

> Quick reference for technology decisions. Full rationale in the [Architecture Document](../fullstack-architecture.md).

## Core Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 14 (App Router) | SSR, Server Components, React Server Actions |
| **Styling** | Tailwind CSS + Shadcn/UI | Latest | Utility-first CSS + copy-paste component library |
| **Charts** | Apache ECharts | Latest | Industrial BI visualizations (heatmaps, Gantt, treemaps) |
| **Backend** | NestJS | Latest | Modular TypeScript API with DI, guards, interceptors |
| **ML Service** | FastAPI | Latest | Python ML ecosystem (async, high-performance) |
| **Database** | PostgreSQL | 16 | JSONB, window functions, recursive CTEs, TimescaleDB |
| **Cache/Queue** | Redis + BullMQ | 7 | Async job queue with retry, progress tracking, DLQ |
| **ORM (TS)** | Prisma | Latest | Type-safe DB access, migrations, connection pooling |
| **ORM (Python)** | SQLAlchemy + asyncpg | Latest | Async DB access for ML service |
| **Monorepo** | Turborepo + pnpm | Latest | Build orchestration, workspace management |
| **Containers** | Docker + Docker Compose | Latest | Reproducible dev environment |

## Frontend Stack Details

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Server state management, caching |
| `react-hook-form` + `zod` | Form management + schema validation |
| `socket.io-client` | WebSocket client for real-time events |
| `@tanstack/react-table` | Data tables with sorting, filtering, pagination |
| `date-fns` | Date manipulation (pt-BR locale) |
| `nuqs` | URL state management for filters |

## Backend Stack Details

| Package | Purpose |
|---------|---------|
| `@nestjs/passport` + `passport-jwt` | JWT authentication |
| `@nestjs/websockets` + `socket.io` | WebSocket gateway |
| `bullmq` | Job queue (training, forecast) |
| `ioredis` | Redis client |
| `class-validator` + `class-transformer` | DTO validation |
| `@nestjs/swagger` | OpenAPI documentation |

## ML/Python Stack Details

| Package | Purpose |
|---------|---------|
| `pytorch-forecasting` | Temporal Fusion Transformer (TFT) |
| `statsmodels` | ETS/Holt-Winters, Croston/TSB |
| `lightgbm` | LightGBM ensemble member |
| `scikit-learn` | Preprocessing, metrics |
| `pandas` + `numpy` | Data manipulation |
| `bullmq` (Python) | Job consumer |
| `redis` | Pub/sub progress events |

## Infrastructure

| Component | Technology | Notes |
|-----------|-----------|-------|
| Dev environment | Docker Compose | PostgreSQL + Redis + all services |
| CI/CD | GitHub Actions | PR: lint+test+build, Main: deploy |
| Production | AWS EKS (Phase 5) | GPU Spot Instances for training |
| Image Registry | GitHub Container Registry | Docker images |

## Architecture Decisions (ADRs)

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Turborepo monorepo | Shared types, coordinated deploys |
| ADR-002 | NestJS for API | Type safety, modularity, DI |
| ADR-003 | FastAPI for ML | Python ecosystem, async performance |
| ADR-004 | PostgreSQL single DB | Simplicity for Phase 0-3 |
| ADR-005 | Prisma ORM | Type-safe, migrations, pooling |
| ADR-006 | BullMQ for async | Redis-backed, progress tracking |
| ADR-007 | Socket.IO for realtime | Fallback support, rooms, namespaces |
| ADR-008 | MRP in NestJS | Deterministic algo, not ML |
