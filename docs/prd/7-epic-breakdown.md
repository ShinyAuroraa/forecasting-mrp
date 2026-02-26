# 7. Epic Breakdown

## Epic 0: Infrastructure Setup

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

## Epic 1: Foundation -- Data Layer & CRUDs

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

## Epic 2: Intelligence -- Forecasting Engine

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

## Epic 3: MRP -- Planning Engine

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

## Epic 4: Automation & BI

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

## Epic 5: Refinement & Production

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
