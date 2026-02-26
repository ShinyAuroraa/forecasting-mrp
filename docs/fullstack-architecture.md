# Fullstack Architecture Document -- ForecastingMRP

## Metadata

| Field | Value |
|-------|-------|
| **Project** | ForecastingMRP -- Industrial Forecasting + MRP/MRP II + BI System |
| **Document** | Fullstack Architecture Specification |
| **Version** | 1.0 |
| **Date** | February 2026 |
| **Author** | Aria (System Architect Agent, Synkra AIOS) |
| **Status** | Authoritative Reference |
| **PRD Reference** | `docs/prd.md` v2.1 (76 FR, 29 NFR, 13 CON) |
| **Frontend Spec Reference** | `docs/front-end-spec.md` v1.0 (8 screens, 47 components, 5 user flows) |
| **Project Brief Reference** | `docs/project-brief.md` v1.0 |

---

## 1. Architecture Overview

### 1.1 High-Level System Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        BROWSER["Browser (Desktop / Tablet)"]
    end

    subgraph "Presentation Layer (apps/web)"
        NEXTJS["Next.js 14<br/>App Router<br/>SSR + Server Components"]
    end

    subgraph "Business Logic Layer (apps/api)"
        NESTJS["NestJS<br/>REST API + WebSocket Gateway"]
    end

    subgraph "ML Layer (apps/forecast-engine)"
        FASTAPI["FastAPI<br/>Training + Inference"]
    end

    subgraph "Data Layer"
        PG["PostgreSQL 16<br/>+ TimescaleDB"]
        REDIS["Redis 7<br/>Cache + Queue Broker"]
    end

    subgraph "Queue Layer"
        BULLMQ["BullMQ<br/>Job Queue (Redis-backed)"]
    end

    subgraph "External Integrations"
        EMAIL["Gmail API / IMAP"]
        ERP["ERP Connector<br/>(API / DB / SFTP)"]
        SMTP["SMTP / Email Service"]
    end

    BROWSER -->|"HTTPS (REST + WebSocket)"| NEXTJS
    NEXTJS -->|"REST JSON"| NESTJS
    NEXTJS -->|"WebSocket (Socket.IO)"| NESTJS
    NESTJS -->|"REST (sync: predict)"| FASTAPI
    NESTJS -->|"BullMQ (async: train)"| BULLMQ
    BULLMQ -->|"Job consume"| FASTAPI
    FASTAPI -->|"Redis pub/sub progress"| REDIS
    REDIS -->|"Progress events"| NESTJS
    NESTJS -->|"Prisma ORM"| PG
    FASTAPI -->|"SQLAlchemy / asyncpg"| PG
    NESTJS -->|"ioredis"| REDIS
    NESTJS -->|"Ingestion"| EMAIL
    NESTJS -->|"Ingestion"| ERP
    NESTJS -->|"Notifications"| SMTP
```

### 1.2 Service Communication Patterns

| Channel | Protocol | Direction | Purpose | Latency Target |
|---------|----------|-----------|---------|---------------|
| Frontend <-> Backend | REST (JSON over HTTPS) | Bidirectional | CRUD operations, queries, mutations | < 200ms (p95) |
| Frontend <-> Backend | WebSocket (Socket.IO) | Server-push | Real-time job progress, alerts | < 100ms |
| Backend -> FastAPI | REST (HTTP/JSON) | Sync | Prediction requests (inference) | < 5s (NFR-001) |
| Backend -> FastAPI | BullMQ (Redis) | Async | Training jobs (minutes to hours) | N/A (async) |
| FastAPI -> Backend | Redis pub/sub | Events | Training progress updates | < 100ms |
| Backend -> PostgreSQL | Prisma (TCP) | Bidirectional | All data persistence | < 50ms (p95) |
| FastAPI -> PostgreSQL | SQLAlchemy (TCP) | Bidirectional | Time series reads, result writes | < 100ms (p95) |

### 1.3 Deployment Topology

**Development (Docker Compose):**

```
docker-compose.yml
  |-- postgres (timescale/timescaledb:latest-pg16) .... port 5432
  |-- redis (redis:7-alpine) .......................... port 6379
  |-- api (NestJS) .................................... port 3001
  |-- web (Next.js) ................................... port 3000
  |-- forecast-engine (FastAPI) ....................... port 8000
```

**Production (AWS EKS -- Phase 5):**

```
AWS EKS Cluster
  |-- Namespace: forecasting-mrp
  |   |-- Deployment: web (Next.js) .................. 2-4 replicas, ALB ingress
  |   |-- Deployment: api (NestJS) ................... 2-4 replicas, internal LB
  |   |-- Deployment: forecast-engine (FastAPI) ...... 1-2 replicas (CPU inference)
  |   |-- Deployment: forecast-trainer (FastAPI) ..... 0-1 replicas (GPU Spot Instance)
  |   |-- StatefulSet: postgres ....................... RDS PostgreSQL 16 (managed)
  |   |-- Deployment: redis .......................... ElastiCache Redis (managed)
  |-- Namespace: monitoring
  |   |-- Prometheus + Grafana
  |   |-- CloudWatch integration
```

---

## 2. Monorepo Structure

### 2.1 Turborepo Configuration Rationale

The monorepo uses **Turborepo** to orchestrate builds across three distinct runtimes (TypeScript/Node.js, TypeScript/Node.js, and Python) while sharing types and configurations.

**Why Turborepo:**
- Task-based build orchestration with dependency graph awareness (`dependsOn: ["^build"]`)
- Remote caching support for CI/CD (speeds up builds by 40-60%)
- Parallel execution of independent tasks across workspaces
- Single repository for coordinated deployments and shared type definitions
- Simplified PR reviews: one PR can contain frontend + backend + types changes

### 2.2 Directory Structure

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
|   |-- web/                            # Next.js 14 (App Router) -- Frontend
|   |   |-- src/
|   |   |   |-- app/                    # App Router pages and layouts
|   |   |   |-- components/             # Shared UI components
|   |   |   |-- lib/                    # Utilities, API client, hooks
|   |   |   |-- styles/                 # Global styles, Tailwind config
|   |   |-- next.config.js
|   |   |-- tailwind.config.ts
|   |   |-- tsconfig.json
|   |   |-- package.json
|   |
|   |-- api/                            # NestJS -- Backend API
|   |   |-- src/
|   |   |   |-- modules/                # Feature modules (one per domain)
|   |   |   |-- common/                 # Shared: filters, interceptors, DTOs
|   |   |   |-- config/                 # Configuration module
|   |   |   |-- prisma/                 # Prisma service, migrations
|   |   |   |-- main.ts                 # Bootstrap
|   |   |   |-- app.module.ts           # Root module
|   |   |-- prisma/
|   |   |   |-- schema.prisma           # Database schema
|   |   |   |-- migrations/             # Prisma migrations
|   |   |   |-- seed.ts                 # Synthetic seed data (FR-005)
|   |   |-- test/                       # Integration tests
|   |   |-- tsconfig.json
|   |   |-- package.json
|   |
|   |-- forecast-engine/                # FastAPI -- ML/Forecasting Service
|   |   |-- src/
|   |   |   |-- api/                    # FastAPI routes (train, predict, health)
|   |   |   |-- models/                 # ML model implementations
|   |   |   |-- pipeline/               # Execution pipeline steps
|   |   |   |-- features/               # Feature engineering
|   |   |   |-- backtesting/            # Backtesting framework
|   |   |   |-- workers/                # BullMQ job consumers
|   |   |   |-- db/                     # Database access (SQLAlchemy)
|   |   |   |-- config.py               # Configuration
|   |   |   |-- main.py                 # FastAPI app bootstrap
|   |   |-- tests/                      # Python tests (pytest)
|   |   |-- requirements.txt            # Python dependencies
|   |   |-- Dockerfile
|   |   |-- pyproject.toml
|
|-- packages/
|   |-- shared/                         # Shared TypeScript types and utilities
|   |   |-- src/
|   |   |   |-- types/                  # Shared type definitions
|   |   |   |   |-- entities/           # Entity types (Product, Supplier, BOM, etc.)
|   |   |   |   |-- api/               # API request/response types
|   |   |   |   |-- enums.ts           # Shared enums (TipoProduto, PrioridadeOrdem, etc.)
|   |   |   |-- utils/                 # Shared utility functions
|   |   |   |-- constants/             # Shared constants (roles, config keys)
|   |   |   |-- index.ts               # Barrel export
|   |   |-- tsconfig.json
|   |   |-- package.json
|
|-- docs/                               # Project documentation
|   |-- prd.md                          # Formalized PRD v2.1
|   |-- front-end-spec.md              # Frontend UI/UX Specification
|   |-- project-brief.md              # Project brief
|   |-- fullstack-architecture.md      # This document
|   |-- stories/                       # Development stories
```

### 2.3 Package Dependency Graph

```mermaid
graph TD
    WEB["apps/web<br/>(Next.js 14)"] -->|"imports types"| SHARED["packages/shared"]
    API["apps/api<br/>(NestJS)"] -->|"imports types"| SHARED
    FE["apps/forecast-engine<br/>(FastAPI)"] -.->|"mirrors types<br/>(Python dataclasses)"| SHARED

    WEB -->|"REST + WS"| API
    API -->|"REST + BullMQ"| FE
    API -->|"Prisma"| PG["PostgreSQL 16"]
    FE -->|"SQLAlchemy"| PG
    API -->|"ioredis/BullMQ"| REDIS["Redis 7"]
    FE -->|"redis-py/BullMQ"| REDIS
```

### 2.4 Build Pipeline (turbo.json)

| Task | Dependencies | Outputs | Cache | Purpose |
|------|-------------|---------|-------|---------|
| `dev` | None | N/A | No | Hot-reload development servers |
| `build` | `^build` (shared first) | `dist/**`, `.next/**` | Yes | Production builds |
| `lint` | `^build` | N/A | Yes | ESLint + Prettier checks |
| `test` | `build` | N/A | Yes | Unit + integration tests |
| `typecheck` | `^build` | N/A | Yes | TypeScript strict mode validation |
| `clean` | None | N/A | No | Remove build artifacts |

### 2.5 Shared Types Strategy (packages/shared)

The `packages/shared` package acts as the single source of truth for entity types, enums, and API contracts used by both frontend and backend. The FastAPI service mirrors these types using Python dataclasses/Pydantic models.

**Key shared types:**

```typescript
// packages/shared/src/types/enums.ts
export enum TipoProduto {
  ACABADO = 'ACABADO',
  SEMI_ACABADO = 'SEMI_ACABADO',
  INSUMO = 'INSUMO',
  EMBALAGEM = 'EMBALAGEM',
  MATERIA_PRIMA = 'MATERIA_PRIMA',
  REVENDA = 'REVENDA',
}

export enum PrioridadeOrdem {
  CRITICA = 'CRITICA',
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAIXA = 'BAIXA',
}

export enum ModeloForecast {
  TFT = 'TFT',
  ETS = 'ETS',
  CROSTON = 'CROSTON',
  LGBM = 'LGBM',
  ENSEMBLE = 'ENSEMBLE',
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}
```

**Synchronization with Python:** A code generation script (`scripts/sync-types-to-python.ts`) converts TypeScript enums and interfaces to Python dataclasses and Enums. This runs as a pre-build step for `apps/forecast-engine`.

---

## 3. Frontend Architecture (apps/web)

### 3.1 Next.js 14 App Router Structure

The frontend uses Next.js 14 with the App Router, leveraging Server Components for data-heavy pages and Client Components only where interactivity is required. This follows the frontend spec URL structure exactly (Section 2.3).

```
apps/web/src/
|-- app/
|   |-- (auth)/
|   |   |-- login/page.tsx                 # Login page (Client Component)
|   |   |-- layout.tsx                     # Auth layout (no sidebar)
|   |
|   |-- (main)/
|   |   |-- layout.tsx                     # Main shell: sidebar + topbar + content
|   |   |-- dashboard/page.tsx             # FR-054: Executive Dashboard
|   |   |-- forecast/
|   |   |   |-- page.tsx                   # FR-031: Forecast Dashboard (Volume)
|   |   |   |-- revenue/page.tsx           # FR-028: Revenue Forecast
|   |   |   |-- metrics/page.tsx           # FR-032: Metrics & Backtest
|   |   |   |-- models/page.tsx            # FR-033: Model Metadata
|   |   |   |-- scenarios/page.tsx         # FR-057: What-If
|   |   |-- mrp/
|   |   |   |-- page.tsx                   # FR-043: MRP Gantt
|   |   |   |-- detail/page.tsx            # FR-044: MRP Detail Table
|   |   |   |-- stock/page.tsx             # FR-045: Stock Projection
|   |   |   |-- capacity/page.tsx          # FR-046: Capacity Dashboard
|   |   |   |-- calendar/page.tsx          # FR-048: Factory Calendar
|   |   |-- compras/
|   |   |   |-- page.tsx                   # FR-042: Purchasing Panel
|   |   |   |-- supplier/[id]/page.tsx     # Supplier Summary
|   |   |   |-- history/page.tsx           # Order History
|   |   |-- cadastros/
|   |   |   |-- produtos/
|   |   |   |   |-- page.tsx               # FR-007: Product list
|   |   |   |   |-- [id]/page.tsx          # Product detail/edit
|   |   |   |   |-- import/page.tsx        # FR-008: Mass import
|   |   |   |-- bom/
|   |   |   |   |-- page.tsx               # FR-009/FR-010: BOM tree
|   |   |   |   |-- [id]/page.tsx          # BOM detail
|   |   |   |-- fornecedores/
|   |   |   |   |-- page.tsx               # FR-011: Supplier list
|   |   |   |   |-- [id]/page.tsx          # FR-012: Supplier detail + SKU linkage
|   |   |   |-- capacidade/
|   |   |   |   |-- centros/page.tsx        # FR-013: Work Centers
|   |   |   |   |-- turnos/page.tsx         # FR-014: Shifts
|   |   |   |   |-- paradas/page.tsx        # FR-015: Scheduled Stops
|   |   |   |   |-- eventos/page.tsx        # FR-016: Capacity Events
|   |   |   |   |-- roteiros/page.tsx       # FR-047: Production Routings
|   |   |   |-- depositos/page.tsx          # FR-017: Warehouses
|   |   |-- inventario/
|   |   |   |-- page.tsx                   # FR-018: Inventory table
|   |   |   |-- upload/page.tsx            # FR-018: Spreadsheet upload
|   |   |   |-- classificacao/page.tsx     # FR-020: ABC/XYZ classification
|   |   |-- ingestao/
|   |   |   |-- page.tsx                   # FR-019: Upload + mapping
|   |   |   |-- templates/page.tsx         # FR-061: Saved templates
|   |   |   |-- pipeline/page.tsx          # ETL pipeline status
|   |   |-- automacao/
|   |   |   |-- page.tsx                   # FR-050/FR-051: Email + ERP config
|   |   |   |-- schedule/page.tsx          # FR-052: Pipeline scheduling
|   |   |   |-- log/page.tsx              # Execution log
|   |   |-- config/
|   |   |   |-- page.tsx                   # FR-076: System config
|   |   |   |-- users/page.tsx             # User management
|   |
|   |-- layout.tsx                         # Root layout: providers, fonts
|   |-- globals.css                        # Tailwind base + custom tokens
|
|-- components/
|   |-- ui/                                # Shadcn/UI components (copy-pasted)
|   |   |-- button.tsx
|   |   |-- input.tsx
|   |   |-- badge.tsx
|   |   |-- dialog.tsx
|   |   |-- sheet.tsx
|   |   |-- table.tsx
|   |   |-- select.tsx
|   |   |-- ... (all Shadcn primitives)
|   |
|   |-- molecules/                         # Composed elements
|   |   |-- kpi-card.tsx
|   |   |-- form-field.tsx
|   |   |-- search-input.tsx
|   |   |-- file-upload-zone.tsx
|   |   |-- alert-banner.tsx
|   |   |-- status-badge.tsx
|   |   |-- priority-badge.tsx
|   |   |-- progress-bar.tsx
|   |   |-- currency-display.tsx
|   |   |-- trend-indicator.tsx
|   |
|   |-- organisms/                         # Complex elements
|   |   |-- data-table/
|   |   |   |-- data-table.tsx            # TanStack React Table wrapper
|   |   |   |-- data-table-toolbar.tsx    # Search + filters + bulk actions
|   |   |   |-- data-table-pagination.tsx # Pagination controls
|   |   |   |-- data-table-column-header.tsx
|   |   |-- charts/                        # ECharts wrappers
|   |   |   |-- time-series-chart.tsx
|   |   |   |-- bar-chart.tsx
|   |   |   |-- heatmap-chart.tsx
|   |   |   |-- gantt-chart.tsx
|   |   |   |-- gauge-chart.tsx
|   |   |   |-- pareto-chart.tsx
|   |   |   |-- sparkline-chart.tsx
|   |   |   |-- chart-base.tsx            # Base ECharts component
|   |   |-- forms/                         # Domain-specific forms
|   |   |   |-- product-form.tsx
|   |   |   |-- bom-form.tsx
|   |   |   |-- supplier-form.tsx
|   |   |   |-- work-center-form.tsx
|   |   |-- bom-tree-view.tsx
|   |   |-- column-mapper.tsx
|   |   |-- reconciliation-table.tsx
|   |   |-- alert-center.tsx
|   |   |-- job-progress-panel.tsx
|   |   |-- command-palette.tsx
|   |
|   |-- layouts/                           # Page layout templates
|   |   |-- dashboard-layout.tsx
|   |   |-- crud-list-layout.tsx
|   |   |-- crud-detail-layout.tsx
|   |   |-- split-panel-layout.tsx
|   |   |-- action-panel-layout.tsx
|   |   |-- upload-flow-layout.tsx
|   |
|   |-- shell/                             # Application shell
|   |   |-- sidebar.tsx
|   |   |-- topbar.tsx
|   |   |-- breadcrumbs.tsx
|
|-- lib/
|   |-- api/
|   |   |-- client.ts                      # Axios/fetch API client with interceptors
|   |   |-- endpoints.ts                   # API endpoint definitions
|   |   |-- types.ts                       # Re-export from packages/shared
|   |-- hooks/
|   |   |-- use-debounce.ts
|   |   |-- use-websocket.ts              # WebSocket connection hook
|   |   |-- use-job-progress.ts           # ML job progress hook
|   |-- queries/                           # React Query query/mutation definitions
|   |   |-- products.ts
|   |   |-- suppliers.ts
|   |   |-- forecasts.ts
|   |   |-- mrp.ts
|   |   |-- ... (per domain)
|   |-- stores/                            # Zustand stores (minimal client state)
|   |   |-- sidebar-store.ts
|   |   |-- filter-store.ts
|   |   |-- auth-store.ts
|   |-- utils/
|   |   |-- format.ts                      # Brazilian number/date/currency formatting
|   |   |-- cn.ts                          # Tailwind class merge utility
|   |   |-- validators.ts                  # CNPJ validation, etc.
|
|-- providers/
|   |-- query-provider.tsx                 # React Query provider
|   |-- auth-provider.tsx                  # Authentication context
|   |-- theme-provider.tsx                 # Light/dark theme
|   |-- websocket-provider.tsx             # Socket.IO connection
```

### 3.2 Server Components vs Client Components Strategy

**Design principle:** Server Components by default. Client Components only when the component requires browser APIs, user interaction state, or real-time updates.

| Component Type | Rendering | When to Use | Examples |
|---------------|-----------|-------------|---------|
| **Server Component** | Server-side (default) | Data fetching, static display, SEO-relevant content | Dashboard page, CRUD list pages, KPI cards |
| **Client Component** | Client-side (`"use client"`) | Interactivity, browser APIs, useState/useEffect | Charts (ECharts), forms, filters, WebSocket consumers |
| **Streaming SSR** | Progressive (`<Suspense>`) | Independent sections that can load in parallel | Dashboard: KPIs load before charts |

**Boundaries:**

```
Page (Server Component)
  |-- KPI Cards (Server Component -- data fetched on server)
  |-- <Suspense fallback={<ChartSkeleton />}>
  |     |-- ChartSection (Client Component -- needs ECharts)
  |-- <Suspense fallback={<TableSkeleton />}>
  |     |-- DataTableSection (Client Component -- needs sorting/filtering)
  |-- AlertSidebar (Server Component -- static data)
```

### 3.3 State Management Approach

**Three-tier state management:**

| Tier | Tool | Scope | Purpose |
|------|------|-------|---------|
| **Server State** | TanStack React Query v5 | Server cache | All API data: entities, forecasts, MRP results. Handles caching (5 min staleTime), invalidation, optimistic updates, pagination. |
| **Client State** | Zustand | Cross-component UI state | Sidebar open/collapsed, active filters, selected rows, theme preference. Minimal -- avoids duplicating server state. |
| **URL State** | Next.js searchParams | URL-persisted state | Active tab, pagination page, sort column/direction, filter values. Enables shareable/bookmarkable views. |

**React Query configuration:**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min -- matches Redis cache TTL
      gcTime: 10 * 60 * 1000,        // 10 min garbage collection
      retry: 2,
      refetchOnWindowFocus: true,     // Refresh on tab return
    },
  },
});
```

### 3.4 API Client Layer Design

The API client is a thin Axios wrapper with JWT interceptor and consistent error handling.

```typescript
// lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 (refresh) and errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(error.config);
      }
      redirectToLogin();
    }
    throw transformApiError(error);
  },
);
```

### 3.5 ECharts Integration Pattern (SSR-Safe)

ECharts is loaded dynamically to avoid SSR issues (it requires `window`/`document`).

```typescript
// components/organisms/charts/chart-base.tsx
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamic import prevents SSR execution of ECharts
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" />,
});

// Selective ECharts module registration to reduce bundle size
import * as echarts from 'echarts/core';
import { LineChart, BarChart, HeatmapChart, CustomChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent,
         DataZoomComponent, ToolboxComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart, HeatmapChart, CustomChart,
  GridComponent, TooltipComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent,
  CanvasRenderer,
]);
```

### 3.6 WebSocket Integration for Real-Time Updates

Socket.IO connection for ML job progress events (FR-030) and real-time alerts (FR-062).

```typescript
// providers/websocket-provider.tsx
'use client';

import { io, Socket } from 'socket.io-client';
import { createContext, useContext, useEffect, useRef } from 'react';

const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
  transports: ['websocket'],
  autoConnect: false,
  auth: { token: '' },  // Set on auth
});

// Events consumed:
// - 'job:progress'   -> { step, totalSteps, stepName, processed, total, percent }
// - 'job:completed'  -> { duration, results_summary }
// - 'job:failed'     -> { error, step }
// - 'alert:new'      -> { type, severity, message, entity_id }
```

### 3.7 Authentication Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant W as Next.js (web)
    participant A as NestJS (api)

    U->>W: Navigate to /login
    U->>W: Submit credentials
    W->>A: POST /auth/login { email, password }
    A->>A: Validate credentials
    A-->>W: { access_token, refresh_token, user }
    W->>W: Store tokens (httpOnly cookies or secure storage)
    W-->>U: Redirect to /dashboard

    Note over U,A: Subsequent requests
    U->>W: Navigate to protected page
    W->>A: GET /api/... (Authorization: Bearer <token>)
    A->>A: JWT guard validates token
    A-->>W: 200 OK + data

    Note over U,A: Token refresh
    W->>A: POST /auth/refresh { refresh_token }
    A-->>W: { access_token (new), refresh_token (rotated) }
```

**Middleware (Next.js):** A `middleware.ts` file at the app root checks for valid JWT on every request to `(main)` routes. If the token is missing or expired, it redirects to `/login`.

### 3.8 Route Structure Mapping to PRD Screens

| Route | PRD Reference | Screen | Epic |
|-------|---------------|--------|------|
| `/dashboard` | FR-054 | Executive Dashboard | 4 |
| `/forecast` | FR-031 | Forecast Dashboard (Volume) | 2 |
| `/forecast/revenue` | FR-028 | Revenue Forecast | 2 |
| `/forecast/metrics` | FR-032 | Metrics & Backtest | 2 |
| `/forecast/models` | FR-033 | Model Metadata | 2 |
| `/forecast/scenarios` | FR-057 | What-If Analysis | 4 |
| `/mrp` | FR-043 | MRP Gantt | 3 |
| `/mrp/detail` | FR-044 | MRP Detail Table | 3 |
| `/mrp/stock` | FR-045 | Stock Projection | 3 |
| `/mrp/capacity` | FR-046 | Capacity Dashboard | 3 |
| `/mrp/calendar` | FR-048 | Factory Calendar | 3 |
| `/compras` | FR-042 | Purchasing Panel | 3 |
| `/cadastros/produtos` | FR-007 | Product CRUD | 1 |
| `/cadastros/bom` | FR-009, FR-010 | BOM CRUD | 1 |
| `/cadastros/fornecedores` | FR-011, FR-012 | Supplier CRUD | 1 |
| `/cadastros/capacidade/*` | FR-013 to FR-016, FR-047 | Capacity Management | 1/3 |
| `/cadastros/depositos` | FR-017 | Warehouse CRUD | 1 |
| `/inventario` | FR-018 | Inventory Management | 1 |
| `/inventario/classificacao` | FR-020 | ABC/XYZ Classification | 1 |
| `/ingestao` | FR-019 | Data Ingestion | 1 |
| `/automacao` | FR-050 to FR-052 | Automation Config | 4 |
| `/config` | FR-076 | System Configuration | 5 |

---

## 4. Backend Architecture (apps/api)

### 4.1 NestJS Module Structure

The backend follows **domain-driven modular architecture**, with one NestJS module per bounded context. Each module encapsulates its own controller, service, DTOs, and Prisma repository.

```
apps/api/src/
|-- modules/
|   |-- auth/                      # JWT authentication + RBAC
|   |   |-- auth.module.ts
|   |   |-- auth.controller.ts     # POST /auth/login, /auth/refresh, /auth/logout
|   |   |-- auth.service.ts        # JWT generation, password hashing
|   |   |-- guards/
|   |   |   |-- jwt-auth.guard.ts  # Global JWT validation
|   |   |   |-- roles.guard.ts     # @Roles() decorator enforcement
|   |   |-- decorators/
|   |   |   |-- roles.decorator.ts
|   |   |   |-- current-user.decorator.ts
|   |   |-- strategies/
|   |   |   |-- jwt.strategy.ts    # Passport JWT strategy
|   |   |   |-- jwt-refresh.strategy.ts
|   |   |-- dto/
|   |   |   |-- login.dto.ts
|   |   |   |-- register.dto.ts
|   |
|   |-- produtos/                  # Product management (FR-007, FR-008)
|   |   |-- produtos.module.ts
|   |   |-- produtos.controller.ts # CRUD: GET/POST/PATCH/DELETE /produtos
|   |   |-- produtos.service.ts    # Business logic + validation
|   |   |-- produtos.repository.ts # Prisma queries
|   |   |-- dto/
|   |   |   |-- create-produto.dto.ts
|   |   |   |-- update-produto.dto.ts
|   |   |   |-- filter-produto.dto.ts
|   |   |-- import/
|   |   |   |-- import-produtos.service.ts  # CSV/XLSX parsing + validation
|   |
|   |-- bom/                       # Bill of Materials (FR-009, FR-010, FR-069)
|   |   |-- bom.module.ts
|   |   |-- bom.controller.ts      # CRUD + tree + exploded cost
|   |   |-- bom.service.ts         # Tree explosion, cost roll-up
|   |   |-- bom.repository.ts
|   |   |-- dto/
|   |
|   |-- fornecedores/              # Supplier management (FR-011, FR-012)
|   |   |-- fornecedores.module.ts
|   |   |-- fornecedores.controller.ts
|   |   |-- fornecedores.service.ts
|   |   |-- fornecedores.repository.ts
|   |   |-- produto-fornecedor/    # N:N linkage sub-module
|   |   |   |-- produto-fornecedor.service.ts
|   |   |-- dto/
|   |
|   |-- capacidade/                # Production capacity (FR-013 to FR-016, FR-047, FR-048)
|   |   |-- capacidade.module.ts
|   |   |-- centros/               # Work centers
|   |   |   |-- centros.controller.ts
|   |   |   |-- centros.service.ts
|   |   |-- turnos/                # Shifts
|   |   |   |-- turnos.controller.ts
|   |   |   |-- turnos.service.ts
|   |   |-- paradas/               # Scheduled stops
|   |   |   |-- paradas.controller.ts
|   |   |   |-- paradas.service.ts
|   |   |-- eventos/               # Capacity events
|   |   |   |-- eventos.controller.ts
|   |   |   |-- eventos.service.ts
|   |   |-- roteiros/              # Production routings
|   |   |   |-- roteiros.controller.ts
|   |   |   |-- roteiros.service.ts
|   |   |-- calendario/            # Factory calendar
|   |   |   |-- calendario.controller.ts
|   |   |   |-- calendario.service.ts
|   |
|   |-- inventario/                # Inventory management (FR-017, FR-018)
|   |   |-- inventario.module.ts
|   |   |-- inventario.controller.ts
|   |   |-- inventario.service.ts
|   |   |-- depositos/             # Warehouse/depot sub-module
|   |   |   |-- depositos.controller.ts
|   |   |   |-- depositos.service.ts
|   |   |-- upload/                # Spreadsheet upload processing
|   |   |   |-- upload.service.ts
|   |
|   |-- ingestao/                  # Data ingestion (FR-019, FR-061)
|   |   |-- ingestao.module.ts
|   |   |-- ingestao.controller.ts # Upload endpoint
|   |   |-- ingestao.service.ts    # ETL pipeline orchestration
|   |   |-- parsers/               # CSV/XLSX/PDF parsers
|   |   |   |-- csv-parser.service.ts
|   |   |   |-- xlsx-parser.service.ts
|   |   |-- mapping/               # Column mapping engine
|   |   |   |-- mapping.service.ts
|   |   |   |-- templates.service.ts
|   |   |-- etl/                   # ETL pipeline steps
|   |   |   |-- validate.step.ts
|   |   |   |-- clean.step.ts
|   |   |   |-- grade.step.ts
|   |   |   |-- classify.step.ts   # ABC/XYZ/demand pattern (FR-020)
|   |
|   |-- forecast/                  # Forecast orchestration (FR-027 to FR-033)
|   |   |-- forecast.module.ts
|   |   |-- forecast.controller.ts # Trigger forecast, get results
|   |   |-- forecast.service.ts    # Job creation + result queries
|   |   |-- forecast.gateway.ts    # WebSocket gateway for progress
|   |   |-- jobs/
|   |   |   |-- forecast-job.producer.ts  # BullMQ job producer
|   |
|   |-- mrp/                       # MRP/MRP II engine (FR-034 to FR-049)
|   |   |-- mrp.module.ts
|   |   |-- mrp.controller.ts      # Trigger MRP, get results
|   |   |-- mrp.service.ts         # MRP orchestration
|   |   |-- engine/
|   |   |   |-- mps.service.ts     # Master Production Schedule (FR-034)
|   |   |   |-- stock-params.service.ts  # SS/ROP/EOQ/Min/Max (FR-035)
|   |   |   |-- bom-explosion.service.ts # Multi-level BOM explosion (FR-036)
|   |   |   |-- lot-sizing.service.ts    # L4L/EOQ/Silver-Meal/WW (FR-037)
|   |   |   |-- order-generation.service.ts # Planned orders (FR-038)
|   |   |   |-- action-messages.service.ts  # Action messages (FR-039)
|   |   |   |-- crp.service.ts     # Capacity Requirements Planning (FR-040)
|   |   |   |-- storage-validation.service.ts # Storage capacity (FR-041)
|   |   |   |-- net-requirement.service.ts   # Core MRP calculation (FR-049)
|   |
|   |-- automacao/                 # Automation (FR-050 to FR-053, FR-059)
|   |   |-- automacao.module.ts
|   |   |-- email-listener/        # Email monitoring (FR-050)
|   |   |   |-- email-listener.service.ts
|   |   |   |-- gmail.adapter.ts
|   |   |   |-- imap.adapter.ts
|   |   |-- erp-connector/         # ERP integration (FR-051)
|   |   |   |-- erp-connector.service.ts
|   |   |   |-- adapters/
|   |   |   |   |-- rest-api.adapter.ts
|   |   |   |   |-- direct-db.adapter.ts
|   |   |   |   |-- sftp.adapter.ts
|   |   |-- pipeline/              # Daily pipeline (FR-052)
|   |   |   |-- daily-pipeline.service.ts
|   |   |   |-- pipeline-scheduler.service.ts
|   |   |-- notifications/         # Email notifications (FR-053, FR-063)
|   |   |   |-- email-notification.service.ts
|   |   |   |-- morning-briefing.service.ts
|   |
|   |-- notificacao/               # Alert system (FR-062)
|   |   |-- notificacao.module.ts
|   |   |-- notificacao.controller.ts
|   |   |-- notificacao.service.ts
|   |   |-- notificacao.gateway.ts # WebSocket push for alerts
|   |
|   |-- common/                    # Shared infrastructure
|   |   |-- filters/
|   |   |   |-- http-exception.filter.ts    # Global exception filter
|   |   |   |-- prisma-exception.filter.ts  # Prisma error mapping
|   |   |-- interceptors/
|   |   |   |-- logging.interceptor.ts      # Request/response logging
|   |   |   |-- transform.interceptor.ts    # Response envelope
|   |   |   |-- timeout.interceptor.ts      # Request timeout
|   |   |-- decorators/
|   |   |   |-- pagination.decorator.ts     # @Paginate() decorator
|   |   |   |-- api-paginated.decorator.ts  # Swagger pagination
|   |   |-- dto/
|   |   |   |-- pagination.dto.ts           # { page, limit, cursor }
|   |   |   |-- paginated-response.dto.ts   # { data, meta, links }
|   |   |   |-- sort.dto.ts                 # { sortBy, sortOrder }
|   |   |-- pipes/
|   |   |   |-- uuid-validation.pipe.ts
|   |
|   |-- config/                    # Configuration module
|   |   |-- config.module.ts
|   |   |-- config.service.ts      # Typed env access
|   |   |-- config.schema.ts       # Joi validation schema
|
|-- prisma/
|   |-- prisma.module.ts           # Prisma service provider
|   |-- prisma.service.ts          # Connection lifecycle
|
|-- main.ts                        # Bootstrap: CORS, validation pipes, Swagger
|-- app.module.ts                  # Root module imports
```

### 4.2 Module Responsibilities

| Module | Domain | Key Endpoints | PRD References |
|--------|--------|---------------|---------------|
| `auth` | Authentication & Authorization | `POST /auth/login`, `/auth/refresh` | FR-006, NFR-016, NFR-017 |
| `produtos` | Product management | `CRUD /produtos`, `POST /produtos/import` | FR-007, FR-008 |
| `bom` | Bill of Materials | `CRUD /bom`, `GET /bom/:id/tree`, `GET /bom/:id/cost` | FR-009, FR-010, FR-069 |
| `fornecedores` | Supplier management | `CRUD /fornecedores`, `CRUD /produto-fornecedor` | FR-011, FR-012 |
| `capacidade` | Production capacity | `CRUD /centros`, `/turnos`, `/paradas`, `/eventos`, `/roteiros`, `/calendario` | FR-013 to FR-016, FR-047, FR-048 |
| `inventario` | Inventory & warehouses | `CRUD /inventario`, `/depositos`, `POST /inventario/upload` | FR-017, FR-018 |
| `ingestao` | Data ingestion | `POST /ingestao/upload`, `CRUD /ingestao/templates`, `POST /ingestao/etl` | FR-019, FR-020, FR-061 |
| `forecast` | Forecast orchestration | `POST /forecast/execute`, `GET /forecast/results`, WS `job:progress` | FR-027 to FR-033 |
| `mrp` | MRP/MRP II engine | `POST /mrp/execute`, `GET /mrp/orders`, `GET /mrp/capacity` | FR-034 to FR-049 |
| `automacao` | Daily automation | `CRUD /automacao/config`, `POST /automacao/trigger`, `GET /automacao/log` | FR-050 to FR-053, FR-059, FR-063 |
| `notificacao` | Alert & notification system | `GET /alerts`, WS `alert:new` | FR-062 |
| `common` | Cross-cutting concerns | N/A (interceptors, filters, DTOs) | NFR-018 |

### 4.3 Database Access Strategy (Prisma ORM)

**Why Prisma:**
- Type-safe database access (auto-generated TypeScript types from schema)
- Declarative schema definition with migration support
- Excellent PostgreSQL support including JSONB, enums, composite types
- Built-in connection pooling
- Query logging for debugging

**Prisma schema structure:**

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [timescaledb, pgcrypto]
}

model Produto {
  id                       String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  codigo                   String   @unique @db.VarChar(50)
  descricao                String   @db.VarChar(255)
  tipoProduto              TipoProduto @map("tipo_produto")
  // ... all fields from PRD Section 3.1.1
  createdAt                DateTime @default(now()) @map("created_at")
  updatedAt                DateTime @updatedAt @map("updated_at")

  @@map("produto")
}

// Enums mirroring PRD definitions
enum TipoProduto {
  ACABADO
  SEMI_ACABADO
  INSUMO
  EMBALAGEM
  MATERIA_PRIMA
  REVENDA
}
```

**Repository pattern:** Each module has a `*.repository.ts` that encapsulates Prisma queries, keeping the service layer free of ORM specifics.

### 4.4 Error Handling Patterns

**Three-layer error handling:**

1. **Global Exception Filter** (`HttpExceptionFilter`): Catches all unhandled exceptions and returns standardized JSON responses.
2. **Prisma Exception Filter** (`PrismaExceptionFilter`): Maps Prisma errors (P2002 unique constraint, P2025 not found, etc.) to HTTP status codes.
3. **Service-level exceptions**: Business logic throws domain-specific exceptions (e.g., `BomCircularReferenceException`, `InsufficientStockException`).

**Standard error response format:**

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Produto com codigo SKU-001 ja existe",
  "details": {
    "field": "codigo",
    "value": "SKU-001",
    "constraint": "produto_codigo_key"
  },
  "timestamp": "2026-02-25T10:30:00.000Z",
  "path": "/produtos"
}
```

### 4.5 API Versioning Strategy

**URI prefix versioning:** All routes are prefixed with `/api/v1/`. This allows future breaking changes to coexist under `/api/v2/` while maintaining backward compatibility.

```typescript
// main.ts
app.setGlobalPrefix('api/v1');
```

### 4.6 Request Validation

All incoming requests are validated using `class-validator` and `class-transformer` via NestJS `ValidationPipe` (global).

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // Strip unknown properties
  forbidNonWhitelisted: true, // Reject unknown properties
  transform: true,            // Auto-transform to DTO types
  transformOptions: {
    enableImplicitConversion: true,
  },
}));
```

---

## 5. ML/Forecasting Architecture (apps/forecast-engine)

### 5.1 FastAPI Service Structure

```
apps/forecast-engine/src/
|-- api/
|   |-- router.py                  # FastAPI router aggregation
|   |-- routes/
|   |   |-- health.py              # GET /health
|   |   |-- train.py               # POST /train (sync trigger for BullMQ job)
|   |   |-- predict.py             # POST /predict (sync inference, < 5s)
|   |   |-- backtest.py            # POST /backtest
|   |   |-- models_meta.py         # GET /models (metadata, versions)
|
|-- models/
|   |-- base.py                    # Abstract base model interface
|   |-- tft/
|   |   |-- tft_model.py           # TFT (PyTorch Forecasting) wrapper
|   |   |-- tft_config.py          # Hyperparameters
|   |   |-- tft_dataset.py         # TimeSeriesDataSet preparation
|   |-- ets/
|   |   |-- ets_model.py           # Holt-Winters (statsmodels)
|   |-- croston/
|   |   |-- croston_model.py       # Croston/TSB implementation
|   |-- lightgbm/
|   |   |-- lgbm_model.py          # LightGBM (scikit-learn API)
|   |   |-- lgbm_features.py       # Feature engineering
|   |-- ensemble/
|   |   |-- ensemble_model.py      # Weighted ensemble (TFT 0.6 + LGBM 0.4)
|   |-- registry.py                # Model registry (selection by classification)
|
|-- pipeline/
|   |-- executor.py                # 10-step pipeline orchestrator (FR-027)
|   |-- steps/
|   |   |-- step_01_load_data.py
|   |   |-- step_02_segment.py     # Route SKUs to models by classification
|   |   |-- step_03_tft.py         # TFT volume + revenue
|   |   |-- step_04_ets.py
|   |   |-- step_05_croston.py
|   |   |-- step_06_lgbm_ensemble.py
|   |   |-- step_07_forecast_revenue.py
|   |   |-- step_08_metrics.py     # Backtesting metrics
|   |   |-- step_09_save.py
|   |   |-- step_10_trigger_mrp.py
|
|-- features/
|   |-- feature_engine.py          # Feature engineering pipeline
|   |-- temporal_features.py       # Lags, rolling stats, calendar features
|   |-- classification.py          # ABC/XYZ/demand pattern classification (FR-020)
|
|-- backtesting/
|   |-- backtester.py              # Train T-13, predict 13 weeks, compare (FR-029)
|   |-- metrics.py                 # MAPE, MAE, RMSE calculation
|
|-- workers/
|   |-- bullmq_consumer.py         # BullMQ job consumer (redis queue)
|   |-- progress_reporter.py       # Redis pub/sub progress events
|
|-- db/
|   |-- database.py                # SQLAlchemy async engine + session
|   |-- repositories/
|   |   |-- time_series_repo.py    # Read clean time series data
|   |   |-- forecast_repo.py       # Write forecast results
|   |   |-- model_meta_repo.py     # Model metadata CRUD
|
|-- config.py                      # Pydantic Settings (env-based)
|-- main.py                        # FastAPI app + lifespan events
```

### 5.2 Model Architecture

#### Model Selection Matrix (FR-022)

```mermaid
flowchart TD
    START[SKU to Forecast] --> CLASSIFY{Demand Pattern?}

    CLASSIFY -->|SMOOTH| ABC_SMOOTH{ABC Class?}
    CLASSIFY -->|ERRATIC| ABC_ERRATIC{ABC Class?}
    CLASSIFY -->|INTERMITTENT| CROSTON[Croston/TSB]
    CLASSIFY -->|LUMPY| TSB[TSB]

    ABC_SMOOTH -->|A or B| DATA_CHECK_1{>= 52 weeks?}
    ABC_SMOOTH -->|C| ETS[ETS Holt-Winters]

    ABC_ERRATIC -->|A or B| DATA_CHECK_2{>= 52 weeks?}
    ABC_ERRATIC -->|C| ETS

    DATA_CHECK_1 -->|Yes| TFT[TFT Volume]
    DATA_CHECK_1 -->|No, >= 40w| TFT
    DATA_CHECK_1 -->|No, < 40w| ETS_FALLBACK[Simple ETS]

    DATA_CHECK_2 -->|Yes| TFT
    DATA_CHECK_2 -->|No| ETS

    TFT --> IS_CLASS_A{Class A?}
    IS_CLASS_A -->|Yes| ENSEMBLE[Ensemble: TFT 0.6 + LGBM 0.4]
    IS_CLASS_A -->|No| OUTPUT[Forecast Result]

    ETS --> OUTPUT
    ETS_FALLBACK --> OUTPUT
    CROSTON --> OUTPUT
    TSB --> OUTPUT
    ENSEMBLE --> OUTPUT
```

#### Model Specifications

| Model | Library | Target | Quantiles | Training | Inference | Hardware |
|-------|---------|--------|-----------|----------|-----------|----------|
| **TFT Volume** | pytorch_forecasting | Weekly volume | P10, P25, P50, P75, P90 | Monthly (30-60 min) | Weekly (< 30s) | GPU train, CPU infer |
| **TFT Revenue** | pytorch_forecasting | Weekly revenue | P10, P25, P50, P75, P90 | Monthly | Weekly | GPU train, CPU infer |
| **ETS** | statsmodels | Weekly volume | Via simulation (1000 paths) | Per-SKU fit (~1s) | Immediate | CPU |
| **Croston/TSB** | Custom / statsforecast | Inter-demand interval + size | Via bootstrap | Per-SKU fit (~0.5s) | Immediate | CPU |
| **LightGBM** | lightgbm (sklearn API) | Weekly volume | Via quantile regression | Monthly (~5 min) | < 5s | CPU |
| **Ensemble** | Custom weighted average | Weekly volume | Weighted quantiles | N/A (uses sub-models) | < 1s | CPU |

### 5.3 Training Pipeline (BullMQ Workers)

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as NestJS
    participant Q as BullMQ (Redis)
    participant W as FastAPI Worker
    participant DB as PostgreSQL

    UI->>API: POST /forecast/execute { type: 'train', params }
    API->>Q: Add job 'train_model' { params }
    API-->>UI: { jobId: "abc-123", status: "queued" }

    Q->>W: Consume job 'train_model'
    W->>DB: Load training data (time series)
    W->>W: Step 1: Load data
    W-->>Q: Progress { step: 1, percent: 10 }
    Note over API,UI: Redis pub/sub -> WebSocket -> UI progress bar

    W->>W: Step 2: Segment SKUs by model
    W-->>Q: Progress { step: 2, percent: 20 }

    W->>W: Steps 3-6: Train models (TFT, ETS, Croston, LGBM)
    W-->>Q: Progress { step: 3-6, percent: 30-70 }

    W->>W: Steps 7-9: Calculate revenue, metrics, save
    W->>DB: Write forecast_resultado, forecast_metrica
    W-->>Q: Progress { step: 9, percent: 95 }

    W->>W: Step 10: Trigger MRP (if configured)
    W-->>Q: Job completed { duration, summary }
    Q-->>API: Job completed event
    API-->>UI: WebSocket 'job:completed' { duration, results }
```

### 5.4 Prediction Pipeline (REST Sync)

For inference-only calls (daily pipeline), the NestJS backend calls FastAPI synchronously:

```
POST http://forecast-engine:8000/predict
{
  "sku_ids": ["uuid-1", "uuid-2", ...],  // or null for all
  "horizon_weeks": 13,
  "models": "auto",  // or specific model override
  "targets": ["VOLUME", "FATURAMENTO"]
}

Response (< 5s):
{
  "execution_id": "uuid",
  "results_count": 1234,
  "duration_ms": 3200,
  "summary": {
    "tft_count": 450,
    "ets_count": 600,
    "croston_count": 184
  }
}
```

### 5.5 Model Versioning and Storage

| Artifact | Storage | Naming Convention | Retention |
|----------|---------|-------------------|-----------|
| TFT checkpoint (.ckpt) | `data/models/tft/` | `tft_volume_v{N}_{date}.ckpt` | Last 5 versions |
| TFT Revenue checkpoint | `data/models/tft/` | `tft_revenue_v{N}_{date}.ckpt` | Last 5 versions |
| LightGBM model (.pkl) | `data/models/lgbm/` | `lgbm_v{N}_{date}.pkl` | Last 5 versions |
| Model metadata | PostgreSQL (`forecast_modelo` table) | By `execucao_id` | Indefinite |
| Training metrics | PostgreSQL (`forecast_metrica` table) | By `execucao_id` | Indefinite |

**Champion-Challenger (FR-066):** The model registry tracks the current "champion" model for each model type. New models are promoted only if their backtesting MAPE improves by at least 1 percentage point (configurable).

### 5.6 Feature Engineering Pipeline

| Feature Category | Features | Source |
|-----------------|----------|--------|
| **Temporal** | week_of_year, month, quarter, is_holiday, days_to_holiday | calendario_fabrica |
| **Lag** | lag_1w, lag_2w, lag_4w, lag_8w, lag_13w, lag_26w, lag_52w | Clean time series |
| **Rolling Stats** | rolling_mean_4w, rolling_mean_13w, rolling_std_4w, rolling_std_13w | Clean time series |
| **Price** | current_price, avg_price_3m, price_change_pct | produto.preco_venda |
| **Classification** | abc_class, xyz_class, demand_pattern | sku_classification |
| **Categorical** | categoria_id, tipo_produto (encoded) | produto |

### 5.7 NestJS <-> FastAPI Communication Summary

| Use Case | Protocol | Direction | Latency | Example |
|----------|----------|-----------|---------|---------|
| Inference (predict) | REST sync | NestJS -> FastAPI | < 5s | Daily pipeline prediction |
| Training | BullMQ async | NestJS -> Queue -> FastAPI | N/A | Monthly model retraining |
| Progress events | Redis pub/sub | FastAPI -> Redis -> NestJS -> WebSocket -> Frontend | < 100ms | Training progress bar |
| Health check | REST sync | NestJS -> FastAPI | < 200ms | Pipeline pre-check |

---

## 6. Data Architecture

### 6.1 PostgreSQL 16 Schema Overview

The database schema implements all 26 tables defined in PRD Section 3 (v2.1), organized into five groups:

```mermaid
erDiagram
    %% Registration Tables
    produto ||--o{ bom : "parent/child"
    produto ||--o{ produto_fornecedor : "has suppliers"
    produto }o--|| categoria : "belongs to"
    produto }o--|| unidade_medida : "uses"
    fornecedor ||--o{ produto_fornecedor : "supplies"
    produto ||--o{ inventario_atual : "stored in"
    deposito ||--o{ inventario_atual : "contains"
    produto ||--o{ roteiro_producao : "manufactured via"
    centro_trabalho ||--o{ roteiro_producao : "performs"
    centro_trabalho ||--o{ turno : "has shifts"
    centro_trabalho ||--o{ parada_programada : "has stops"
    centro_trabalho ||--o{ evento_capacidade : "has events"

    %% Result Tables
    execucao_planejamento ||--o{ execucao_step_log : "has steps"
    execucao_planejamento ||--o{ forecast_resultado : "produces"
    execucao_planejamento ||--o{ forecast_metrica : "measures"
    execucao_planejamento ||--o{ forecast_modelo : "trains"
    execucao_planejamento ||--o{ parametros_estoque : "calculates"
    execucao_planejamento ||--o{ ordem_planejada : "generates"
    execucao_planejamento ||--o{ carga_capacidade : "validates"

    %% Classification & Time Series
    produto ||--|| sku_classification : "classified as"
    produto ||--o{ serie_temporal : "has time series"

    %% System Tables
    usuario ||--o{ execucao_planejamento : "triggers"
    usuario ||--o{ evento_capacidade : "records"
```

### 6.2 Table Groups

| Group | Tables | Count | Purpose |
|-------|--------|-------|---------|
| **Registration** | produto, categoria, unidade_medida, fornecedor, produto_fornecedor, bom, deposito | 7 | Master data |
| **Capacity** | centro_trabalho, turno, parada_programada, evento_capacidade, roteiro_producao, calendario_fabrica | 6 | Production capacity |
| **Inventory** | inventario_atual | 1 | Current stock positions |
| **Results** | execucao_planejamento, execucao_step_log, forecast_resultado, forecast_metrica, forecast_modelo, parametros_estoque, ordem_planejada, carga_capacidade | 8 | Calculation outputs |
| **Classification** | sku_classification, serie_temporal | 2 | ML input/output data |
| **System** | config_sistema, usuario | 2 | Configuration + auth |

### 6.3 TimescaleDB Hypertable Strategy

**Candidate tables for hypertables** (time-series-heavy, high write volume):

| Table | Partition Column | Chunk Interval | Rationale |
|-------|-----------------|----------------|-----------|
| `forecast_resultado` | `periodo` | 1 month | Weekly forecasts across 5K SKUs x 13 weeks = 65K rows/execution |
| `execucao_step_log` | `started_at` | 1 week | High-volume pipeline step logs |

**Decision:** Start without TimescaleDB hypertables (Phase 0-3). Enable in Phase 5 if query performance requires it (NFR-027). The Docker Compose already uses the `timescale/timescaledb:latest-pg16` image, so the extension is available.

```sql
-- Enable when needed (Phase 5):
CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT create_hypertable('forecast_resultado', 'periodo', chunk_time_interval => INTERVAL '1 month');
```

### 6.4 Index Strategy

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `produto` | `idx_produto_codigo` | UNIQUE B-tree | SKU lookup |
| `produto` | `idx_produto_tipo_ativo` | B-tree composite | Filter by type + active |
| `produto` | `idx_produto_categoria` | B-tree | Filter by category |
| `bom` | `idx_bom_pai_ativo` | B-tree composite | BOM explosion query |
| `bom` | `idx_bom_filho` | B-tree | Reverse BOM (where-used) |
| `inventario_atual` | `idx_inv_produto_deposito` | UNIQUE composite | Stock lookup |
| `forecast_resultado` | `idx_forecast_exec_produto` | B-tree composite | Forecast result query |
| `forecast_resultado` | `idx_forecast_periodo` | B-tree | Time-range queries |
| `ordem_planejada` | `idx_ordem_exec_tipo` | B-tree composite | Order listing by type |
| `ordem_planejada` | `idx_ordem_prioridade` | B-tree | Priority sorting |
| `ordem_planejada` | `idx_ordem_data_liberacao` | B-tree | Date-range queries |
| `carga_capacidade` | `idx_carga_centro_periodo` | B-tree composite | Capacity heatmap query |
| `config_sistema` | PRIMARY KEY (chave) | B-tree | Key-value lookup |
| `execucao_planejamento` | `idx_exec_tipo_status` | B-tree composite | Pipeline monitoring |

**JSONB indexes** (GIN) for flexible querying:

```sql
CREATE INDEX idx_exec_parametros ON execucao_planejamento USING GIN (parametros);
CREATE INDEX idx_exec_resultado ON execucao_planejamento USING GIN (resultado_resumo);
CREATE INDEX idx_config_valor ON config_sistema USING GIN (valor);
```

### 6.5 Migration Strategy

**Tool:** Prisma Migrate (integrated with NestJS).

**Workflow:**
1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name {description}` (generates SQL migration)
3. Migration files stored in `prisma/migrations/` (version-controlled)
4. Production: `npx prisma migrate deploy` (applies pending migrations)

**Migration naming convention:** `{timestamp}_{description}` (e.g., `20260301_add_forecast_modelo_table`)

### 6.6 Seed Data Approach (FR-005)

The seed script (`prisma/seed.ts`) generates coherent synthetic data:

| Entity | Volume | Notes |
|--------|--------|-------|
| Categorias | 15 | 3-level hierarchy |
| Unidades de medida | 8 | UN, KG, LT, CX, MT, M2, M3, PCT |
| Produtos | 1,000 | Distributed across all types |
| Fornecedores | 50 | With realistic lead times |
| Produto-Fornecedor | 2,000 | 2-4 suppliers per product |
| BOM | 500 | 3-level structures for finished goods |
| Centros de trabalho | 5 | PRODUCAO, EMBALAGEM, MONTAGEM, ACABAMENTO, CQ |
| Turnos | 10 | 2 shifts per center |
| Depositos | 5 | By warehouse type |
| Inventario | 1,000 | One position per product |
| Calendario fabrica | 365 | Full year with holidays |
| Config sistema | 15 | Default configuration values |
| Usuarios | 6 | One per persona role |

### 6.7 Connection Pooling

**Development:** Prisma's built-in connection pool (default: 10 connections).

**Production:** PgBouncer in transaction pooling mode:
- Max client connections: 200
- Max server connections: 20
- Pool mode: transaction
- Deployed as a sidecar container in EKS

---

## 7. Infrastructure & DevOps

### 7.1 Docker Compose Services (Dev Environment)

The `docker-compose.yml` defines all services needed for local development:

```yaml
# Extended from existing docker-compose.yml
version: "3.9"

services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports: ["${POSTGRES_PORT:-5432}:5432"]
    environment:
      POSTGRES_DB: forecasting_mrp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck: ...
    networks: [forecasting-mrp-network]

  redis:
    image: redis:7-alpine
    ports: ["${REDIS_PORT:-6379}:6379"]
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes: [redis_data:/data]
    healthcheck: ...
    networks: [forecasting-mrp-network]

  api:
    build: ./apps/api
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/forecasting_mrp
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      FORECAST_ENGINE_URL: http://forecast-engine:8000
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [forecasting-mrp-network]

  web:
    build: ./apps/web
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
      NEXT_PUBLIC_WS_URL: http://localhost:3001
    depends_on: [api]
    networks: [forecasting-mrp-network]

  forecast-engine:
    build: ./apps/forecast-engine
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/forecasting_mrp
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [forecasting-mrp-network]
    # GPU support (if available):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

volumes:
  postgres_data:
  redis_data:

networks:
  forecasting-mrp-network:
    driver: bridge
```

### 7.2 CI/CD Pipeline (GitHub Actions)

#### PR Pipeline (ci.yml)

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
        env: { POSTGRES_DB: test_db, POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build

  python-ci:
    runs-on: ubuntu-latest
    defaults:
      run: { working-directory: apps/forecast-engine }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check src/
      - run: mypy src/
      - run: pytest tests/ -v --cov=src --cov-report=xml
```

### 7.3 Environment Management

| File | Purpose | Git Status |
|------|---------|------------|
| `.env.example` | Template with all variable names and defaults | Committed |
| `.env` | Local dev environment | Gitignored |
| `.env.test` | Test environment | Gitignored |

**Required environment variables:**

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/forecasting_mrp
POSTGRES_PASSWORD=changeme

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-256-bit-secret
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# FastAPI
FORECAST_ENGINE_URL=http://localhost:8000

# Email (Phase 4)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### 7.4 Logging Strategy

**Format:** Structured JSON logs across all services for consistent parsing.

```json
{
  "timestamp": "2026-02-25T06:01:23.456Z",
  "level": "info",
  "service": "api",
  "module": "forecast",
  "message": "Forecast execution started",
  "context": {
    "executionId": "uuid",
    "trigger": "AGENDADO",
    "skuCount": 1234
  },
  "requestId": "req-uuid",
  "userId": "user-uuid"
}
```

**Libraries:**
- NestJS: `@nestjs/common` Logger with Winston or Pino transport
- FastAPI: Python `structlog` with JSON renderer
- Next.js: Server-side structured logging via custom logger

### 7.5 Monitoring Approach

| Layer | Tool | Metrics |
|-------|------|---------|
| **Application** | Health check endpoints (`/health`) | Service status, DB connectivity, Redis connectivity |
| **API** | NestJS interceptor metrics | Request count, latency (p50/p95/p99), error rate |
| **ML Pipeline** | Pipeline step logging | Step duration, records processed, model accuracy |
| **Database** | pg_stat_statements | Slow queries, connection count |
| **Infrastructure** | Docker Compose health checks (dev) | Container status |
| **Production** | CloudWatch + Prometheus/Grafana | CPU, memory, pod count, scaling events |

### 7.6 AWS EKS Production Architecture (Phase 5)

```mermaid
graph TB
    subgraph "AWS VPC"
        subgraph "Public Subnet"
            ALB["Application Load Balancer"]
        end

        subgraph "Private Subnet - EKS Cluster"
            subgraph "Node Group: General (m5.xlarge)"
                WEB["web (Next.js)<br/>2-4 replicas"]
                API["api (NestJS)<br/>2-4 replicas"]
                FE_INFER["forecast-engine<br/>(CPU inference)<br/>1-2 replicas"]
            end

            subgraph "Node Group: GPU Spot (g4dn.xlarge)"
                FE_TRAIN["forecast-trainer<br/>(GPU training)<br/>0-1 replicas<br/>Spot Instance"]
            end
        end

        subgraph "Managed Services"
            RDS["RDS PostgreSQL 16<br/>db.r6g.xlarge<br/>Multi-AZ"]
            ELASTICACHE["ElastiCache Redis<br/>cache.m6g.large<br/>Cluster mode"]
            S3["S3<br/>Model artifacts<br/>File uploads"]
            SES["SES<br/>Email notifications"]
        end
    end

    ALB --> WEB
    ALB --> API
    API --> FE_INFER
    API --> FE_TRAIN
    API --> RDS
    API --> ELASTICACHE
    FE_INFER --> RDS
    FE_TRAIN --> RDS
    FE_TRAIN --> S3
    API --> S3
    API --> SES
```

**Auto-scaling policies:**

| Service | Min | Max | Metric | Target |
|---------|-----|-----|--------|--------|
| web | 2 | 4 | CPU utilization | 70% |
| api | 2 | 4 | Request rate | 1000 req/min |
| forecast-engine (inference) | 1 | 2 | Queue depth | < 10 |
| forecast-trainer (GPU) | 0 | 1 | Job pending | > 0 (scale from zero) |

**GPU Spot Instance strategy:** The training workload (`forecast-trainer`) runs on g4dn.xlarge Spot Instances (70-90% discount vs. On-Demand). The BullMQ job consumer handles Spot interruptions gracefully via checkpointing -- if a Spot Instance is reclaimed, the job is re-queued and resumes from the last checkpoint.

---

## 8. Security Architecture

### 8.1 Authentication: JWT with Refresh Tokens

| Token | Expiry | Storage | Purpose |
|-------|--------|---------|---------|
| Access Token | 1 hour | In-memory (React state) | API authentication |
| Refresh Token | 7 days | httpOnly secure cookie | Token renewal without re-login |

**Flow:**
1. Login: `POST /auth/login` returns both tokens
2. API calls: Access token in `Authorization: Bearer <token>` header
3. Refresh: When access token expires, `POST /auth/refresh` with refresh token cookie
4. Logout: Invalidate refresh token server-side + clear cookie

### 8.2 Authorization: RBAC

| Role | Access Level | PRD Personas |
|------|-------------|-------------|
| `admin` | Full access to all modules including configuration | IT/Systems Admin (Tiago) |
| `manager` | Full CRUD + forecast/MRP execution + approval | Purchasing Manager (Paulo), Production Planner (Priscila), Operations Director (Diego) |
| `operator` | CRUD operations on assigned modules + read dashboards | Inventory Analyst (Ivan) |
| `viewer` | Read-only access to dashboards and reports | Financial Controller (Fernanda) |

**Implementation:** NestJS `@Roles()` decorator + `RolesGuard` on every controller.

```typescript
@Controller('produtos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProdutosController {
  @Get()
  @Roles('admin', 'manager', 'operator', 'viewer')
  findAll() { ... }

  @Post()
  @Roles('admin', 'manager', 'operator')
  create() { ... }

  @Delete(':id')
  @Roles('admin')
  remove() { ... }
}
```

### 8.3 API Security

| Measure | Implementation | NFR Reference |
|---------|---------------|---------------|
| **Rate Limiting** | `@nestjs/throttler` -- 100 req/min per IP (general), 10 req/min (login) | -- |
| **CORS** | Whitelist frontend origin only | -- |
| **Helmet** | HTTP security headers (CSP, HSTS, X-Frame-Options) | -- |
| **Input Validation** | `class-validator` on all DTOs, `whitelist: true` | NFR-018 |
| **CNPJ Validation** | Custom validator with check digit algorithm | NFR-019 |
| **SQL Injection** | Prisma parameterized queries (built-in) | -- |
| **XSS** | React auto-escaping + Helmet CSP | -- |

### 8.4 Data Protection

| Layer | Mechanism |
|-------|-----------|
| **In Transit** | TLS 1.3 (HTTPS) for all communications |
| **At Rest** | PostgreSQL data directory encryption (AWS RDS default) |
| **Secrets** | Environment variables, never in source code (NFR-021) |
| **Passwords** | bcrypt hashing (12 rounds) |
| **ERP Connector** | Read-only access (NFR-020), credentials in env vars |

---

## 9. Integration Patterns

### 9.1 Email Integration (FR-050)

```mermaid
flowchart LR
    GMAIL["Gmail / IMAP Server"]
    LISTENER["Email Listener Worker<br/>(NestJS @Cron)"]
    PARSER["Attachment Parser<br/>(CSV/XLSX/PDF)"]
    ETL["ETL Pipeline"]
    DB["PostgreSQL"]

    GMAIL -->|"IMAP / Gmail API<br/>Filter: sender + subject + date"| LISTENER
    LISTENER -->|"Download attachment"| PARSER
    PARSER -->|"Apply saved mapping"| ETL
    ETL -->|"Clean data"| DB

    subgraph "Retry Strategy (R-A02)"
        R1["06:00 Attempt 1"]
        R2["06:30 Attempt 2"]
        R3["07:00 Attempt 3"]
        R4["07:30 Attempt 4"]
        DLQ["Dead Letter -> Admin alert"]
    end
```

**Adapters (Strategy pattern):**
- `GmailAdapter`: Google OAuth2 + Gmail API (recommended)
- `ImapAdapter`: IMAP connection via `imapflow` (Node.js)
- `SftpAdapter`: SFTP folder monitoring (fallback)

### 9.2 ERP Connector Pattern (FR-051)

The ERP connector uses the **Adapter pattern** -- three implementations behind a common interface:

```typescript
interface ErpConnector {
  fetchDailyData(date: Date): Promise<RawMovementData[]>;
  testConnection(): Promise<boolean>;
}

class RestApiConnector implements ErpConnector { ... }
class DirectDbConnector implements ErpConnector { ... }   // Read-only (NFR-020)
class SftpConnector implements ErpConnector { ... }
```

**Configuration:** The active connector is selected via `config_sistema` (`automacao.erp.tipo`). Multiple connectors can be configured as primary + fallback.

### 9.3 Export Patterns (FR-058)

| Format | Library | Generation | Delivery |
|--------|---------|-----------|----------|
| **Excel (.xlsx)** | `exceljs` (NestJS) | Server-side streaming | Download endpoint |
| **PDF** | `@react-pdf/renderer` or `puppeteer` | Server-side rendering | Download endpoint |
| **CSV** | Native streaming | Server-side | Download endpoint |

**For large exports:** Backend generates the file asynchronously via BullMQ job, stores in temp directory (or S3 in production), and returns a download URL.

### 9.4 Webhook Patterns for Notifications (FR-062)

Internal notification system using Redis pub/sub + WebSocket:

```
Event Source (any module)
  -> NotificacaoService.create({ type, severity, message, entityId })
    -> PostgreSQL (persist alert)
    -> Redis pub/sub (real-time channel)
      -> WebSocket Gateway (push to connected clients)
        -> Frontend (toast notification + alert badge update)
```

---

## 10. Architecture Decision Records (ADRs)

### ADR-001: Monorepo with Turborepo

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | The system has three services (Next.js, NestJS, FastAPI) sharing types and deployed together. Need to coordinate builds and share code. |
| **Decision** | Use Turborepo monorepo with pnpm workspaces. Python project included in monorepo but managed outside pnpm (standalone pip/poetry). |
| **Alternatives Considered** | Nx (heavier, more opinionated), Lerna (deprecated for build orchestration), separate repos (coordination overhead) |
| **Consequences** | Single PR for cross-service changes. Shared TypeScript types via `packages/shared`. Python types must be manually synchronized (mitigated by sync script). CI pipeline handles both JS and Python in one workflow. |
| **PRD Reference** | FR-001, CON-011 |

### ADR-002: Separate FastAPI Service for ML (Not NestJS)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | ML forecasting requires PyTorch, scikit-learn, statsmodels -- Python-native libraries. Running Python models inside NestJS (via child processes or Python bridges) adds complexity and fragility. |
| **Decision** | Dedicated FastAPI microservice (`apps/forecast-engine`) for all ML workloads. NestJS orchestrates via REST (sync prediction) and BullMQ (async training). |
| **Alternatives Considered** | Python child processes in NestJS (brittle, no GPU support), gRPC (added complexity for this project size), all-Python backend (loses NestJS ecosystem benefits for CRUD/auth) |
| **Consequences** | Clear separation: NestJS owns business logic, FastAPI owns ML. Two database clients (Prisma + SQLAlchemy). Two deployment units. Requires shared queue (BullMQ/Redis) for async communication. |
| **PRD Reference** | PRD Section 2.2, FR-021 |

### ADR-003: BullMQ for Async Job Processing

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | ML training jobs run 30-60 minutes. Cannot block API requests. Need progress tracking, retry logic, and dead letter queue. |
| **Decision** | BullMQ (Redis-backed) for all async job processing: model training, forecast execution, data ingestion ETL, daily pipeline. |
| **Alternatives Considered** | Celery (Python-only, adds RabbitMQ dependency), AWS SQS (cloud-specific), custom Redis pub/sub (no retry/DLQ built-in) |
| **Consequences** | Redis becomes a critical infrastructure component (both cache and queue). BullMQ provides built-in retry, backoff, progress events, dead letter queue, and rate limiting. Python consumer uses `bullmq` Python package for job consumption. |
| **PRD Reference** | FR-030, NFR-014, NFR-015 |

### ADR-004: Prisma as ORM

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need type-safe database access for NestJS with PostgreSQL. Schema is well-defined (21 tables, all in PRD). Need migrations and seed data support. |
| **Decision** | Prisma ORM for NestJS backend. SQLAlchemy for FastAPI (Python). Prisma schema is the source of truth for database schema. |
| **Alternatives Considered** | TypeORM (less type-safe, decorator-heavy), MikroORM (smaller community), Drizzle (newer, less mature), raw SQL (no type safety) |
| **Consequences** | Prisma generates TypeScript types from schema (excellent DX). Migration workflow built-in. Some advanced PostgreSQL features (CTEs, window functions) require `$queryRaw`. FastAPI uses SQLAlchemy for read-heavy queries with no ORM overhead. |
| **PRD Reference** | CON-011 |

### ADR-005: Apache ECharts Over Other Chart Libraries

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Industrial BI requires diverse chart types: line (time series), bar (Pareto), heatmap (capacity), Gantt (MRP timeline), gauge (warehouse occupancy), treemap (inventory value), Sankey (BOM cost flow). |
| **Decision** | Apache ECharts with `echarts-for-react` wrapper, loaded via `next/dynamic` for SSR safety. Selective module registration to control bundle size. |
| **Alternatives Considered** | Recharts (limited chart types, no Gantt/heatmap), Chart.js (limited industrial charts), D3.js (low-level, high development cost), Highcharts (commercial license) |
| **Consequences** | Single library covers all chart types needed. Canvas rendering handles large datasets (5,000 SKUs). Bundle size managed via tree-shaking (target < 200KB gzipped). Must handle SSR incompatibility with dynamic imports. |
| **PRD Reference** | FR-031, FR-043, FR-046, FR-054, CON-011 |

### ADR-006: TimescaleDB for Time Series Optimization

| Field | Value |
|-------|-------|
| **Status** | Accepted (deferred activation) |
| **Context** | Forecast results and time series data grow linearly with SKU count and execution frequency. With 5,000 SKUs x 13 weeks x weekly execution = 65K rows per forecast run. |
| **Decision** | Use `timescale/timescaledb:latest-pg16` Docker image from day one (already configured). Defer hypertable conversion to Phase 5 when query performance data is available. |
| **Alternatives Considered** | Standard PostgreSQL with partitioning (more manual management), InfluxDB (separate database, added complexity), keep everything in standard PostgreSQL (may hit performance limits at scale) |
| **Consequences** | No additional infrastructure -- TimescaleDB is a PostgreSQL extension. Zero-cost until activated. When enabled, provides automatic chunk-based partitioning, continuous aggregates, and compression for time series data. |
| **PRD Reference** | NFR-027, CON-011 |

### ADR-007: Shadcn/UI as Component Foundation

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Need high-quality, accessible UI components that can be customized for industrial BI styling. Full component library lock-in is undesirable. |
| **Decision** | Shadcn/UI (copy-paste components built on Radix UI primitives + Tailwind CSS). Components are owned by the project, not imported as dependencies. |
| **Alternatives Considered** | Material UI (heavy, opinionated styling), Ant Design (enterprise-grade but large bundle), Chakra UI (good DX but less customizable), custom from scratch (too expensive) |
| **Consequences** | Full control over component code. Radix primitives provide accessibility (WCAG 2.1 AA) out of the box. Tailwind utility classes enable rapid customization. No version lock-in. Must maintain components ourselves. |
| **PRD Reference** | CON-011, Frontend Spec Section 5 |

### ADR-008: Server Components Strategy for Next.js 14

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Next.js 14 App Router defaults to Server Components. Need to decide the boundary between server-rendered and client-interactive parts of the application. |
| **Decision** | Server Components by default for all data-fetching pages. Client Components only for: charts (require `window`), interactive forms, real-time WebSocket consumers, client-side state (filters, sorting). Streaming SSR with `<Suspense>` for parallel loading. |
| **Alternatives Considered** | Full CSR (loses SSR benefits for dashboards), hybrid SSR/CSR without Suspense (slower initial paint), static generation (data changes too frequently) |
| **Consequences** | Reduced client-side JavaScript bundle. Dashboard pages render faster (data fetched on server). Charts loaded dynamically. Forms and interactive tables are Client Components. Need careful boundary management between Server and Client Components. |
| **PRD Reference** | CON-011, Frontend Spec Section 10.3 |

---

## 11. Cross-Cutting Concerns

### 11.1 Error Handling Strategy

| Layer | Strategy | Implementation |
|-------|----------|---------------|
| **Frontend** | React Error Boundaries per route + React Query error states | `error.tsx` per route group, toast notifications for mutations |
| **API** | Global exception filter + Prisma exception filter + domain exceptions | NestJS `@Catch()` filters, standardized JSON error response |
| **FastAPI** | FastAPI exception handlers + custom ML exceptions | `@app.exception_handler`, structured error responses |
| **Queue Jobs** | BullMQ retry (3 attempts, exponential backoff) + dead letter queue | Job failure -> retry -> dead letter -> admin alert |

### 11.2 Pagination Pattern

**Cursor-based pagination** for large datasets (NFR-022: 500-5,000 SKUs):

```typescript
// Request
GET /api/v1/produtos?cursor=uuid-of-last-item&limit=50&sortBy=codigo&sortOrder=asc

// Response
{
  "data": [...],
  "meta": {
    "total": 1234,
    "limit": 50,
    "hasNext": true,
    "hasPrev": true,
    "nextCursor": "uuid-next",
    "prevCursor": "uuid-prev"
  }
}
```

**Offset-based pagination** available for simpler use cases (admin screens with smaller datasets).

### 11.3 Caching Strategy

| Layer | Tool | Cache Key Pattern | TTL | Invalidation |
|-------|------|-------------------|-----|-------------|
| **API response** | Redis | `{module}:{entity}:{id}` | 5 min | On mutation (cache-aside) |
| **BOM explosion** | Redis | `bom:explosion:{productId}` | 10 min | On BOM change |
| **Stock parameters** | Redis | `stock:params:{productId}` | 5 min | On forecast/MRP execution |
| **Configuration** | Redis | `config:{key}` | 30 min | On config change |
| **Browser** | React Query | Per-query key | 5 min staleTime | On mutation, on window focus |
| **Static assets** | CDN | Hash-based | 1 year | On deploy |

### 11.4 Internationalization Approach (CON-009)

**Primary language:** Portuguese (pt-BR). Internationalization infrastructure deferred to post-Phase 5.

**Current approach:**
- All UI strings in Portuguese directly in components
- Date format: `dd/MM/yyyy` (Brazilian standard)
- Number format: `.` thousands, `,` decimal (1.234,56)
- Currency: `R$ 1.234,56`
- `<html lang="pt-BR">` declared in root layout

**Future-proofing:** String literals concentrated in component files (not scattered). When i18n is needed, extract to message catalogs using `next-intl` or `react-i18next`.

---

## 12. Appendices

### 12.1 Glossary

| Acronym | Full Name | Description |
|---------|-----------|-------------|
| **MRP** | Material Requirements Planning | Calculates what to buy/produce, how much, and when |
| **MRP II** | Manufacturing Resource Planning | Extends MRP with capacity validation (CRP) |
| **MPS** | Master Production Schedule | Demand plan for finished goods (forecast + firm orders) |
| **BOM** | Bill of Materials | Hierarchical product structure (parent-child components) |
| **CRP** | Capacity Requirements Planning | Validates production plan against factory capacity |
| **TFT** | Temporal Fusion Transformer | Deep learning model for multi-horizon time series forecasting |
| **ETS** | Exponential Smoothing | Classical time series method (Holt-Winters variants) |
| **TSB** | Teunter-Syntetos-Babai | Improved method for intermittent demand forecasting |
| **MAPE** | Mean Absolute Percentage Error | Forecast accuracy metric (lower is better) |
| **MAE** | Mean Absolute Error | Forecast accuracy metric in absolute units |
| **RMSE** | Root Mean Square Error | Forecast accuracy metric emphasizing large errors |
| **SS** | Safety Stock | Buffer inventory to protect against demand/supply variability |
| **ROP** | Reorder Point | Stock level that triggers a new order (ROP = avg_demand x LT + SS) |
| **EOQ** | Economic Order Quantity | Optimal order quantity minimizing total cost |
| **L4L** | Lot-for-Lot | Order exactly the net requirement (no batching) |
| **OTIF** | On Time In Full | Delivery performance metric |
| **SKU** | Stock Keeping Unit | Unique product identifier |
| **ABC** | ABC Classification | Pareto-based classification by revenue contribution (A=80%, B=15%, C=5%) |
| **XYZ** | XYZ Classification | Classification by demand variability (coefficient of variation) |
| **ETL** | Extract, Transform, Load | Data processing pipeline |
| **RBAC** | Role-Based Access Control | Authorization model based on user roles |
| **JWT** | JSON Web Token | Authentication token format |

### 12.2 Module-to-Requirement Traceability

| Backend Module | Frontend Routes | FR References | NFR References |
|---------------|-----------------|---------------|---------------|
| `auth` | `/login` | FR-006 | NFR-016, NFR-017 |
| `produtos` | `/cadastros/produtos`, `/cadastros/produtos/[id]`, `/cadastros/produtos/import` | FR-007, FR-008 | NFR-018, NFR-022 |
| `bom` | `/cadastros/bom`, `/cadastros/bom/[id]` | FR-009, FR-010, FR-069 | NFR-018 |
| `fornecedores` | `/cadastros/fornecedores`, `/cadastros/fornecedores/[id]` | FR-011, FR-012 | NFR-018, NFR-019, NFR-023 |
| `capacidade` | `/cadastros/capacidade/*` | FR-013, FR-014, FR-015, FR-016, FR-047, FR-048 | NFR-018 |
| `inventario` | `/inventario`, `/inventario/upload`, `/inventario/classificacao` | FR-017, FR-018, FR-020 | NFR-018 |
| `ingestao` | `/ingestao`, `/ingestao/templates`, `/ingestao/pipeline` | FR-019, FR-020, FR-061 | NFR-018 |
| `forecast` | `/forecast`, `/forecast/revenue`, `/forecast/metrics`, `/forecast/models`, `/forecast/scenarios` | FR-021 to FR-033, FR-055, FR-056, FR-057, FR-066, FR-067, FR-068 | NFR-001 to NFR-006 |
| `mrp` | `/mrp`, `/mrp/detail`, `/mrp/stock`, `/mrp/capacity`, `/mrp/calendar` | FR-034 to FR-049 | NFR-007 to NFR-012 |
| `automacao` | `/automacao`, `/automacao/schedule`, `/automacao/log` | FR-050 to FR-053, FR-059, FR-063 | NFR-013, NFR-014, NFR-015 |
| `notificacao` | Alert center (global component) | FR-062 | -- |
| `common` | N/A (infrastructure) | -- | NFR-018, NFR-028, NFR-029 |
| `config` | `/config`, `/config/users` | FR-076, FR-075 | NFR-021 |

### 12.3 Constraint Impact Matrix

| Constraint | Impacted Modules | Architectural Decision |
|-----------|-----------------|----------------------|
| CON-001 (GPU for TFT) | forecast-engine, DevOps | Separate trainer deployment with GPU Spot Instances; inference on CPU (ADR-002) |
| CON-002 (Min 40 weeks data) | forecast model registry | Model selection matrix with automatic fallback (FR-022) |
| CON-003 (Pipeline < 15 min) | All pipeline services | Inference-only for daily runs; training monthly; batch processing (NFR-001) |
| CON-004 (BOM data quality) | bom, mrp | Validation rules + exploded cost display for verification (FR-010) |
| CON-005 (Intermittent TFT exclusion) | forecast model registry | Automatic routing to Croston/TSB based on demand pattern classification |
| CON-006 (Docker/EKS parity) | All services | Docker Compose mirrors production topology; env-based configuration |
| CON-008 (Single-plant) | capacidade, mrp | Single-factory data model; no cross-plant logic |
| CON-009 (Portuguese UI) | web (all routes) | Portuguese strings directly in components; i18n deferred |
| CON-010 (BRL currency) | All monetary displays | Single currency format throughout; no exchange rate logic |
| CON-011 (Tech stack) | All | Fixed stack enforced by architecture (ADR-001 through ADR-008) |

---

## 13. Suggested PRD Updates

Based on the architecture analysis, the following gaps and clarifications are recommended for `docs/prd.md`:

1. **Missing `usuario` table definition (Section 3):** The PRD references `usuario(id)` in foreign keys (e.g., `evento_capacidade.usuario_id`, `execucao_planejamento.created_by`) but does not include the table schema. Recommend adding a `usuario` table definition with fields: id (UUID), email, nome, senha_hash, role (enum: admin/manager/operator/viewer), ativo (boolean), created_at, updated_at.

2. **Missing `forecast_metrica` and `forecast_modelo` tables:** FR-032 (Forecast Metrics Storage) and FR-033 (Model Metadata Storage) reference storing metrics and model metadata, and the forecast execution pipeline step 9 references saving to `forecast_metrica` and `forecast_modelo`. These tables are not defined in Section 3. Recommend adding explicit schemas.

3. **Missing `sku_classification` table:** FR-020 (Automatic Classification) stores ABC/XYZ/demand pattern results per SKU. The pipeline step 2 references `sku_classification.modelo_forecast_sugerido`. This table is not defined in Section 3. Recommend adding a `sku_classification` table.

4. **WebSocket event schema not formalized:** The PRD describes WebSocket progress events (Section 2.2) but does not define the event payload schema. The frontend spec (Section 9.3) defines `job:progress`, `job:completed`, `job:failed` events. Recommend adding these to the PRD as a formal interface contract.

5. **API endpoint inventory not documented:** The PRD defines functional requirements but does not list specific REST endpoints. Recommend adding an API endpoint appendix for unambiguous implementation.

6. **MRP engine location ambiguity:** PRD Section 2.1 states "MRP/MRP II Engine (NestJS or Python)". Architecture decision: implemented in NestJS (TypeScript) since MRP is deterministic algorithmic computation, not ML. Recommend updating PRD to state "NestJS" definitively.

7. **Missing `movimentacao_estoque` table for time series:** The ingestion pipeline processes daily stock movements and billing data, but there is no explicit table for storing the cleaned time series data that feeds the forecasting models. The `forecast_resultado` stores outputs, but the raw input time series (weekly aggregated sales/volume per SKU) needs a table. Recommend adding a `serie_temporal` or `dados_limpos` table.

---

*This architecture document was generated by the Architect Agent (Aria) from PRD v2.0, Frontend Spec v1.0, and Project Brief v1.0. All architectural decisions trace to PRD requirements (Article IV compliance). No invented features.*
