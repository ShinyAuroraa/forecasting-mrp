# 10. Architecture Decision Records (ADRs)

## ADR-001: Monorepo with Turborepo

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | The system has three services (Next.js, NestJS, FastAPI) sharing types and deployed together. Need to coordinate builds and share code. |
| **Decision** | Use Turborepo monorepo with pnpm workspaces. Python project included in monorepo but managed outside pnpm (standalone pip/poetry). |
| **Alternatives Considered** | Nx (heavier, more opinionated), Lerna (deprecated for build orchestration), separate repos (coordination overhead) |
| **Consequences** | Single PR for cross-service changes. Shared TypeScript types via `packages/shared`. Python types must be manually synchronized (mitigated by sync script). CI pipeline handles both JS and Python in one workflow. |
| **PRD Reference** | FR-001, CON-011 |

## ADR-002: Separate FastAPI Service for ML (Not NestJS)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | ML forecasting requires PyTorch, scikit-learn, statsmodels -- Python-native libraries. Running Python models inside NestJS (via child processes or Python bridges) adds complexity and fragility. |
| **Decision** | Dedicated FastAPI microservice (`apps/forecast-engine`) for all ML workloads. NestJS orchestrates via REST (sync prediction) and BullMQ (async training). |
| **Alternatives Considered** | Python child processes in NestJS (brittle, no GPU support), gRPC (added complexity for this project size), all-Python backend (loses NestJS ecosystem benefits for CRUD/auth) |
| **Consequences** | Clear separation: NestJS owns business logic, FastAPI owns ML. Two database clients (Prisma + SQLAlchemy). Two deployment units. Requires shared queue (BullMQ/Redis) for async communication. |
| **PRD Reference** | PRD Section 2.2, FR-021 |

## ADR-003: BullMQ for Async Job Processing

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | ML training jobs run 30-60 minutes. Cannot block API requests. Need progress tracking, retry logic, and dead letter queue. |
| **Decision** | BullMQ (Redis-backed) for all async job processing: model training, forecast execution, data ingestion ETL, daily pipeline. |
| **Alternatives Considered** | Celery (Python-only, adds RabbitMQ dependency), AWS SQS (cloud-specific), custom Redis pub/sub (no retry/DLQ built-in) |
| **Consequences** | Redis becomes a critical infrastructure component (both cache and queue). BullMQ provides built-in retry, backoff, progress events, dead letter queue, and rate limiting. Python consumer uses `bullmq` Python package for job consumption. |
| **PRD Reference** | FR-030, NFR-014, NFR-015 |

## ADR-004: Prisma as ORM

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need type-safe database access for NestJS with PostgreSQL. Schema is well-defined (21 tables, all in PRD). Need migrations and seed data support. |
| **Decision** | Prisma ORM for NestJS backend. SQLAlchemy for FastAPI (Python). Prisma schema is the source of truth for database schema. |
| **Alternatives Considered** | TypeORM (less type-safe, decorator-heavy), MikroORM (smaller community), Drizzle (newer, less mature), raw SQL (no type safety) |
| **Consequences** | Prisma generates TypeScript types from schema (excellent DX). Migration workflow built-in. Some advanced PostgreSQL features (CTEs, window functions) require `$queryRaw`. FastAPI uses SQLAlchemy for read-heavy queries with no ORM overhead. |
| **PRD Reference** | CON-011 |

## ADR-005: Apache ECharts Over Other Chart Libraries

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Industrial BI requires diverse chart types: line (time series), bar (Pareto), heatmap (capacity), Gantt (MRP timeline), gauge (warehouse occupancy), treemap (inventory value), Sankey (BOM cost flow). |
| **Decision** | Apache ECharts with `echarts-for-react` wrapper, loaded via `next/dynamic` for SSR safety. Selective module registration to control bundle size. |
| **Alternatives Considered** | Recharts (limited chart types, no Gantt/heatmap), Chart.js (limited industrial charts), D3.js (low-level, high development cost), Highcharts (commercial license) |
| **Consequences** | Single library covers all chart types needed. Canvas rendering handles large datasets (5,000 SKUs). Bundle size managed via tree-shaking (target < 200KB gzipped). Must handle SSR incompatibility with dynamic imports. |
| **PRD Reference** | FR-031, FR-043, FR-046, FR-054, CON-011 |

## ADR-006: TimescaleDB for Time Series Optimization

| Field | Value |
|-------|-------|
| **Status** | Accepted (deferred activation) |
| **Context** | Forecast results and time series data grow linearly with SKU count and execution frequency. With 5,000 SKUs x 13 weeks x weekly execution = 65K rows per forecast run. |
| **Decision** | Use `timescale/timescaledb:latest-pg16` Docker image from day one (already configured). Defer hypertable conversion to Phase 5 when query performance data is available. |
| **Alternatives Considered** | Standard PostgreSQL with partitioning (more manual management), InfluxDB (separate database, added complexity), keep everything in standard PostgreSQL (may hit performance limits at scale) |
| **Consequences** | No additional infrastructure -- TimescaleDB is a PostgreSQL extension. Zero-cost until activated. When enabled, provides automatic chunk-based partitioning, continuous aggregates, and compression for time series data. |
| **PRD Reference** | NFR-027, CON-011 |

## ADR-007: Shadcn/UI as Component Foundation

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need high-quality, accessible UI components that can be customized for industrial BI styling. Full component library lock-in is undesirable. |
| **Decision** | Shadcn/UI (copy-paste components built on Radix UI primitives + Tailwind CSS). Components are owned by the project, not imported as dependencies. |
| **Alternatives Considered** | Material UI (heavy, opinionated styling), Ant Design (enterprise-grade but large bundle), Chakra UI (good DX but less customizable), custom from scratch (too expensive) |
| **Consequences** | Full control over component code. Radix primitives provide accessibility (WCAG 2.1 AA) out of the box. Tailwind utility classes enable rapid customization. No version lock-in. Must maintain components ourselves. |
| **PRD Reference** | CON-011, Frontend Spec Section 5 |

## ADR-008: Server Components Strategy for Next.js 14

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Next.js 14 App Router defaults to Server Components. Need to decide the boundary between server-rendered and client-interactive parts of the application. |
| **Decision** | Server Components by default for all data-fetching pages. Client Components only for: charts (require `window`), interactive forms, real-time WebSocket consumers, client-side state (filters, sorting). Streaming SSR with `<Suspense>` for parallel loading. |
| **Alternatives Considered** | Full CSR (loses SSR benefits for dashboards), hybrid SSR/CSR without Suspense (slower initial paint), static generation (data changes too frequently) |
| **Consequences** | Reduced client-side JavaScript bundle. Dashboard pages render faster (data fetched on server). Charts loaded dynamically. Forms and interactive tables are Client Components. Need careful boundary management between Server and Client Components. |
| **PRD Reference** | CON-011, Frontend Spec Section 10.3 |

---
