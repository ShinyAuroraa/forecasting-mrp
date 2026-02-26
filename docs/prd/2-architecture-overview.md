# 2. Architecture Overview

## 2.1 Layer Diagram

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

## 2.2 Service Communication

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

### 2.2.1 WebSocket Event Schemas

| Event | Direction | Payload Schema |
|-------|-----------|----------------|
| `job:progress` | Server → Client | `{ jobId: string, step: number, totalSteps: number, stepName: string, processed: number, total: number, percent: number }` |
| `job:completed` | Server → Client | `{ jobId: string, duration: number, results_summary: object }` |
| `job:failed` | Server → Client | `{ jobId: string, error: string, step: number }` |
| `alert:new` | Server → Client | `{ type: string, severity: 'info' \| 'warning' \| 'critical', message: string, entity_id: string }` |

## 2.3 Tech Stack

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

## 2.4 Architecture Pattern

- **Microservices** with clear boundaries: NestJS handles business logic and orchestration; FastAPI handles ML workloads exclusively.
- **Communication:** REST (sync CRUD/queries) + BullMQ/Redis (async long-running jobs like model training) + WebSocket (real-time job progress to frontend).
- **Database:** Single PostgreSQL instance with well-defined schema; all services read/write to the same database (shared database pattern for Phase 0-3, with potential to split later).

---
