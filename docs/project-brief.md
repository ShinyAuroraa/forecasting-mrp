# Project Brief — ForecastingMRP

**Project:** ForecastingMRP — Industrial Forecasting + MRP/MRP II + BI System
**Version:** 1.0
**Date:** February 2026
**Author:** Atlas (Analyst Agent)
**Source:** PRD v1.0 (Icaro)
**Status:** Discovery & Planning

---

## 1. Executive Summary

**ForecastingMRP** is an integrated industrial planning system that replaces intuition-based purchasing and production decisions with AI-driven demand forecasting, automated material requirements planning (MRP/MRP II), and real-time business intelligence dashboards.

**Primary Problem:** Industrial operations receive daily operational data (stock movements, revenue, inventory counts) but make purchasing and production decisions based on gut feeling, resulting in chronic inventory imbalances — excess stock of some items alongside stockouts of others — reactive rather than planned procurement, and financial planning without visibility.

**Target Market:** Mid-sized manufacturing companies (single-plant operations) with established ERP systems that lack integrated forecasting and MRP capabilities.

**Value Proposition:** End-to-end automation of the decision cycle: data ingestion, AI-powered demand forecasting (multi-model), material requirements planning with capacity validation, actionable purchase recommendations, and executive BI dashboards — all connected in a single daily pipeline that runs before the workday begins.

**Core Differentiator:** Unlike standalone forecasting tools or basic MRP modules embedded in ERPs, ForecastingMRP combines state-of-the-art ML forecasting (Temporal Fusion Transformer with probabilistic quantiles) with classical MRP/MRP II algorithms, capacity-aware planning, and fully automated daily execution — purpose-built for industrial operations.

---

## 2. Problem Statement

### Current State

Manufacturing companies collect operational data daily through their ERPs — stock movements, billing, inventory positions — but this data sits unused for planning purposes. Purchasing managers order based on experience and historical patterns they carry in their heads. Production scheduling happens through spreadsheets or basic ERP modules that lack demand intelligence.

### Pain Points

| Pain Point | Impact | Frequency |
|------------|--------|-----------|
| **Gut-feeling purchasing** | Excess inventory of slow movers, stockouts of fast movers | Every purchase cycle |
| **Reactive procurement** | Emergency orders at premium prices, production line stoppages | Weekly |
| **Blind financial planning** | Revenue forecasts that miss by 20-40%, budget overruns | Monthly/Quarterly |
| **Disconnected data** | Inventory data in one system, sales in another, capacity in spreadsheets | Continuous |
| **Manual daily routines** | 2-3 hours/day spent collecting, reconciling, and reporting data | Daily |
| **No capacity validation** | Production plans that are physically impossible to execute | Each planning cycle |

### Why Existing Solutions Fall Short

1. **ERP-embedded MRP:** No AI forecasting — relies on fixed reorder points or simple moving averages. Cannot handle intermittent demand patterns or probabilistic safety stock.
2. **Standalone forecasting tools:** Produce forecasts but do not connect to MRP/BOM explosion, capacity planning, or actionable purchase recommendations.
3. **BI dashboards alone:** Provide visibility into the past but no forward-looking planning or automated decision support.
4. **Enterprise solutions (SAP IBP, Oracle ASCP):** Prohibitively expensive and complex for mid-sized manufacturers; 12-18 month implementation cycles.

---

## 3. Proposed Solution

### Core Concept

A modular, integrated system with 7 components working as a single automated pipeline:

| # | Component | Purpose |
|---|-----------|---------|
| 1 | **Forecasting Engine (TFT + ETS + Croston)** | AI-driven demand forecasting by SKU with confidence intervals (P10-P90) |
| 2 | **Revenue Forecasting** | Financial projections by period, product family, category, and total |
| 3 | **MRP Engine** | Multi-level BOM explosion, planned purchase and production orders with exact dates and quantities |
| 4 | **MRP II (CRP)** | Production and storage capacity validation against real factory constraints |
| 5 | **Purchasing Panel** | Actionable dashboard: what to buy, how much, from whom, when to order, when it arrives |
| 6 | **BI Dashboards** | Executive, operational, and analytical views of the entire operation |
| 7 | **Ingestion Automation** | Daily automated data feed via email, ERP connector, or file upload |

### Key Differentiators

1. **Multi-model ML strategy:** Automatically selects the best forecasting model per SKU based on demand pattern classification (smooth, erratic, intermittent, lumpy) and ABC classification. TFT for high-value smooth items, Croston/TSB for intermittent demand, ETS for low-volume items, LightGBM ensemble for class A products.
2. **Probabilistic safety stock:** Uses TFT quantile outputs (P10-P90) directly for safety stock calculation instead of relying on the classical normal distribution assumption — more accurate for non-normal demand patterns.
3. **Fully integrated pipeline:** Forecast feeds MRP, MRP feeds CRP, CRP validates feasibility, and the purchasing panel presents the final actionable output — no manual handoffs between stages.
4. **Dual revenue forecasting:** Both indirect (volume x price) and direct TFT-based revenue forecasting run in parallel; divergence flags structural changes in product mix or pricing.
5. **Zero-touch daily automation:** Email listener + ETL + inference + MRP + alerts run automatically at 06:00, delivering a morning briefing before the workday begins.

### Why It Will Succeed

- Addresses a real, daily pain point with measurable financial impact (reduced stockouts, reduced excess inventory, lower emergency procurement costs).
- Designed specifically for the manufacturing domain with proper BOM explosion, capacity planning, and lot-sizing algorithms.
- Incremental value delivery: even the MVP (Phase 0-1) provides immediate utility through master data management and data classification, before the full forecasting engine is online.

---

## 4. Target Users

### Primary Users

| Segment | Profile | Key Needs | Usage Frequency |
|---------|---------|-----------|-----------------|
| **Purchasing Manager** | Makes daily/weekly buying decisions. Currently relies on ERP stock reports and personal experience. | Actionable purchase recommendations with quantities, suppliers, dates, and costs. Urgency prioritization. | Daily |
| **Production Planner** | Schedules production across work centers. Juggles capacity constraints manually. | Feasible production schedule validated against capacity. Overload alerts with resolution suggestions. | Daily |
| **Operations Director** | Oversees manufacturing operations. Needs visibility into inventory health, forecast accuracy, and capacity utilization. | Executive dashboard with KPIs, alerts, and trend analysis. Morning briefing email. | Daily (dashboard), Weekly (deep analysis) |

### Secondary Users

| Segment | Profile | Key Needs | Usage Frequency |
|---------|---------|-----------|-----------------|
| **Financial Controller** | Builds revenue forecasts and budgets. Currently uses spreadsheet models. | Revenue forecasting by period, category, and product family. Confidence intervals for scenario planning. | Weekly/Monthly |
| **Inventory Analyst** | Manages stock levels, performs cycle counts, monitors ABC classification. | Inventory health metrics, coverage days, ABC/XYZ classification, stockout risk alerts. | Daily |
| **IT/Systems Admin** | Configures integrations, manages data pipelines, troubleshoots ingestion failures. | System configuration, automation monitoring, ERP connector setup, error handling. | As needed |

---

## 5. Goals & Success Metrics

### Business Objectives

| Objective | Metric | Target | Timeline |
|-----------|--------|--------|----------|
| **Reduce stockouts** | % of SKUs in stockout | < 2% (class A), < 5% (class B), < 10% (class C) | 6 months post-launch |
| **Reduce excess inventory** | Inventory turns per year | > 8x (class A), > 5x (class B), > 3x (class C) | 6 months post-launch |
| **Improve forecast accuracy** | MAPE (volume) | < 10% (A), < 20% (B), < 35% (C) | 3 months post-training |
| **Eliminate reactive purchasing** | % of emergency orders | Reduce by 70% from baseline | 6 months post-launch |
| **Automate daily planning** | Daily processing time | < 15 min (ingestion + forecast + MRP) | Immediate (Phase 4) |

### User Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| **Daily active users** | 100% of purchasing/planning team | Login analytics |
| **Time-to-decision** | < 10 min from alert to purchase order action | Workflow tracking |
| **Manual override rate** | < 15% of forecast recommendations | Override logging |
| **Dashboard adoption** | Daily executive dashboard check | Page view analytics |

### KPIs (SMART)

1. **Forecast Accuracy (MAPE):** Achieve class-A MAPE below 10% within 12 weeks of TFT model deployment, measured via weekly backtesting against the 13-week rolling window.
2. **Fill Rate (OTIF):** Achieve On-Time-In-Full delivery rate above 97% for class A products within 6 months of full MRP deployment, measured by comparing planned vs. actual deliveries.
3. **Inventory Value Optimization:** Reduce total inventory carrying cost by 15% within 6 months post-launch while maintaining service levels, measured by monthly inventory valuation reports.
4. **System Availability:** Maintain 99.5% uptime for the daily automated pipeline, measured by monitoring the 06:00 daily pipeline execution success rate.
5. **Revenue Forecast Accuracy:** Achieve monthly revenue forecast accuracy within 12% MAPE for class A products within 3 months of dual-model deployment.

---

## 6. MVP Scope

The MVP maps to **PRD Phase 0 (Setup) + Phase 1 (Foundation)**, covering Weeks 1-5.

### Core Features (Must-Have for MVP)

| Feature | PRD Section | Phase |
|---------|-------------|-------|
| Monorepo scaffold (Turborepo) with Docker Compose | Phase 0 | 0 |
| PostgreSQL 16 schema (all registration tables) | Phase 0 | 0 |
| CI/CD pipeline (GitHub Actions: build + lint + test) | Phase 0 | 0 |
| Synthetic seed data for development | Phase 0 | 0 |
| Auth module (JWT, guards, roles) | Phase 1 | 1 |
| Product CRUD (with mass CSV/XLSX import) | Section 4.1 | 1 |
| BOM CRUD (tree visualization, exploded cost) | Section 4.2 | 1 |
| Supplier CRUD (with SKU linkage) | Section 4.3 | 1 |
| Capacity management (work centers, shifts, events) | Section 4.4 | 1 |
| Inventory management (CRUD + spreadsheet upload) | Section 4.5 | 1 |
| Data ingestion pipeline (CSV/XLSX upload + ETL) | Section 7 | 1 |
| Automatic classification (ABC, XYZ, demand pattern) | Section 5.1 | 1 |

### Out-of-Scope for MVP (Deferred)

| Feature | Deferred To |
|---------|-------------|
| Forecasting engine (TFT, ETS, Croston, LightGBM) | Phase 2 |
| MRP/MRP II engine | Phase 3 |
| Purchasing panel | Phase 3 |
| Email listener / ERP connector automation | Phase 4 |
| BI dashboards (executive, forecast, MRP, capacity) | Phase 4 |
| Ensemble models, champion-challenger | Phase 5 |
| Wagner-Whitin lot sizing, Monte Carlo SS | Phase 5 |
| Production deployment (AWS EKS) | Phase 5 |

### MVP Success Criteria

1. All master data entities (products, BOM, suppliers, work centers, shifts, inventory) can be created, edited, listed, and searched through the UI.
2. CSV/XLSX bulk import works for products and inventory with validation and error reporting.
3. BOM tree visualization correctly displays multi-level product structures with exploded cost calculation.
4. Automatic ABC/XYZ classification runs on uploaded sales data and correctly categorizes SKUs.
5. All CRUD APIs pass unit and integration tests with > 80% code coverage.
6. Docker Compose environment starts all services (Next.js, NestJS, FastAPI, PostgreSQL, Redis) with a single command.

---

## 7. Post-MVP Vision

### Phase 2 — Intelligence (Weeks 6-9)

The forecasting engine comes online with the full multi-model strategy:
- TFT for volume and revenue forecasting on smooth/erratic class A/B items.
- ETS (Holt-Winters) as fallback for class C and low-data items.
- Croston/TSB for intermittent demand patterns.
- Backtesting pipeline with accuracy metrics (MAPE, MAE, RMSE).
- NestJS-to-FastAPI integration via BullMQ for async training jobs.
- Forecast dashboard with confidence bands, metric tables, and model comparison.

### Phase 3 — MRP (Weeks 10-13)

Full MRP/MRP II engine:
- Master Production Schedule (MPS) generation from forecast + firm orders.
- Multi-level BOM explosion with low-level coding.
- Safety stock / reorder point / min-max calculation (TFT quantile-based and classical).
- Lot sizing (L4L, EOQ, Silver-Meal).
- Capacity Requirements Planning (CRP) with overload detection and resolution suggestions.
- Storage capacity validation.
- Purchasing panel: the most actionable output — "what to buy, how much, from whom, by when."
- Gantt timeline of planned orders, MRP detail tables, capacity heatmaps.

### Phase 4 — Automation & BI (Weeks 14-17)

Fully automated daily pipeline:
- Email listener (Gmail API / IMAP) for daily closing data.
- ERP connector (REST API / direct DB / SFTP).
- Automated daily pipeline: ingestion at 06:00 -> inference -> MRP -> alerts -> morning briefing email.
- Executive dashboard with KPI cards, revenue trends, Pareto analysis, and active alerts.
- LightGBM + Ensemble for class A SKUs.
- What-if scenario analysis (slider-based forecast adjustments).
- Excel/PDF export.

### Phase 5 — Refinement (Weeks 18-22)

Production-grade optimization:
- Wagner-Whitin optimal lot sizing.
- Monte Carlo simulation for class A safety stock.
- Champion-challenger automated model selection.
- Drift detection and automatic retraining triggers.
- Manual forecast override with audit logging.
- BOM versioning.
- Historical lead time tracking for lead time variance calculation.
- PDF management reports.
- Integration and load testing.
- AWS EKS production deployment with GPU Spot Instances for model training.

### Long-Term Vision

- Multi-plant support (cross-plant inventory visibility and transfer optimization).
- Supplier portal for collaborative planning and automatic PO transmission.
- Advanced demand sensing (incorporating point-of-sale data, weather, social media signals).
- Prescriptive analytics (automated "what if" scenario generation with recommended actions).
- Mobile companion app for shop floor alerts and approval workflows.

---

## 8. Technical Considerations

### Platform & Architecture

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS + Shadcn/UI | SSR for dashboards, Server Components for heavy queries, React Server Actions for simple mutations |
| **Charts** | Apache ECharts | Industrial BI requires heatmaps, Gantt, Sankey, treemaps, and 3D — ECharts supports all |
| **Backend** | NestJS (TypeScript) | Modular, typed, dependency injection, guards for auth, interceptors for logging |
| **ML/Forecasting** | FastAPI (Python) | Native access to ML ecosystem (PyTorch, scikit-learn, statsmodels). Async by default |
| **Database** | PostgreSQL 16 | JSONB, window functions for ABC, recursive CTEs for BOM, TimescaleDB if needed |
| **Queue** | Redis + BullMQ | Async training jobs with retry, progress tracking, dead letter queue |
| **Monorepo** | Turborepo | Shared types and build orchestration across frontend, backend, and ML services |
| **Dev Environment** | Docker Compose | All services containerized with reproducible environment |
| **Production** | AWS EKS (via CDK) | GPU Spot Instances for model training, auto-scaling for inference |

### Architecture Pattern

- **Microservices** with clear boundaries: NestJS handles business logic and orchestration; FastAPI handles ML workloads exclusively.
- **Communication:** REST (sync CRUD/queries) + BullMQ/Redis (async long-running jobs like model training) + WebSocket (real-time job progress to frontend).
- **Database:** Single PostgreSQL instance with well-defined schema; all services read/write to the same database (shared database pattern for Phase 0-3, with potential to split later).

### Security Considerations

- JWT-based authentication with role-based access control (RBAC).
- Guards on all NestJS endpoints for authorization.
- Input validation on all API endpoints (DTOs with class-validator).
- CNPJ validation on supplier records.
- Read-only ERP connector (never writes to source ERP).
- Environment-based configuration (secrets via environment variables, never hardcoded).

### Data Considerations

- **Volume estimate:** 500-5,000 active SKUs, 50-500 suppliers, 2-5 years of weekly historical data per SKU.
- **Time series granularity:** Weekly (aligned with MRP planning buckets).
- **UUID primary keys** on all tables for distributed-system compatibility.
- **TimescaleDB** extension available if time-series query performance requires it.

---

## 9. Constraints & Assumptions

### Constraints

| Type | Constraint | Impact |
|------|-----------|--------|
| **Technical** | GPU required for TFT training (CPU for inference) | Production needs GPU Spot Instances; dev can use CPU with smaller datasets |
| **Technical** | Minimum 40 weeks of historical data per SKU for TFT | New SKUs fall back to ETS/Naive until enough data accumulates |
| **Technical** | Daily pipeline must complete in < 15 minutes | Constrains model complexity and batch sizes |
| **Data** | BOM accuracy depends on manual entry or ERP data quality | Garbage-in-garbage-out risk on MRP outputs |
| **Data** | Intermittent demand SKUs (>25% zeros) cannot use TFT | Dedicated Croston/TSB path required |
| **Infrastructure** | Docker Compose for dev; AWS EKS for production | Must maintain parity between environments |
| **Timeline** | 22-week development roadmap across 6 phases | Sequential phase dependencies — Phase 3 depends on Phase 2 output |

### Assumptions

| Assumption | Risk if Invalid |
|------------|-----------------|
| Client has at least 1-2 years of historical sales data in exportable format | Forecasting models will underperform or require synthetic augmentation |
| BOM structures are maintained and reasonably accurate | MRP explosion will produce incorrect purchase/production orders |
| Single-plant operation (one factory, one set of work centers) | Multi-plant would require significant architecture changes |
| Portuguese-language UI is the primary requirement | Internationalization deferred to post-Phase 5 |
| Client ERP can export daily data via at least one of: email, API, DB query, or file | Automation pipeline depends on at least one working data source |
| Single-currency operation (BRL) | Multi-currency purchasing would require exchange rate management |

---

## 10. Risks & Open Questions

### Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Insufficient historical data for TFT** | Medium | High — poor forecast accuracy for class A items | Graceful fallback to ETS/Naive; synthetic data augmentation; cold-start protocol |
| **BOM data quality** | High | High — incorrect MRP explosion leads to wrong purchase orders | Validation rules on BOM entry; exploded cost display for visual verification; data quality scoring |
| **Model drift over time** | Medium | Medium — gradually degrading forecast accuracy | Weekly MAPE monitoring; automatic drift detection; monthly champion-challenger retraining |
| **GPU infrastructure costs** | Low | Medium — training costs on AWS | Spot Instances (70-90% discount); train monthly not daily; inference is CPU-only |
| **ERP integration complexity** | Medium | Medium — delays in automation pipeline delivery | Three connector options (API, DB, file); manual upload always available as fallback |
| **User adoption resistance** | Medium | High — system delivers value only if users act on recommendations | Purchasing panel designed as the primary actionable interface; morning email briefing reduces friction |
| **Scope creep from 7-component system** | Medium | High — risk of never completing all phases | Phase-gated delivery with clear MVP; each phase delivers standalone value |
| **Performance under large SKU catalogs** | Low | Medium — slow MRP explosion or forecast pipeline | PostgreSQL optimization (indexes, CTEs); batch processing; async job queue |

### Open Questions

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

---

## 11. Next Steps

### Immediate Actions

| # | Action | Owner | Target |
|---|--------|-------|--------|
| 1 | Validate project brief with stakeholders | PM Agent (@pm) | Week 0 |
| 2 | Create Epic structure from PRD phases (6 Epics) | PM Agent (@pm) | Week 0 |
| 3 | Draft stories for Phase 0 (Setup) from Epic 0 | SM Agent (@sm) | Week 0 |
| 4 | Validate Phase 0 stories against PRD scope | PO Agent (@po) | Week 0 |
| 5 | Bootstrap development environment (repo, Docker, CI/CD) | DevOps Agent (@devops) | Week 1 |
| 6 | Begin Phase 0 implementation | Dev Agent (@dev) | Week 1 |

### PM Handoff Notes

- **PRD completeness:** The PRD (1300+ lines) is exceptionally detailed — it contains full database schemas, business rule pseudocode, algorithm specifications, and UI wireframe descriptions. The PM should use it as the single source of truth, not supplement it with additional requirements documents.
- **Epic decomposition strategy:** Natural epic boundaries align with PRD phases: Epic 0 (Setup), Epic 1 (Foundation/Cadastros), Epic 2 (Forecasting), Epic 3 (MRP/MRP II), Epic 4 (Automation/BI), Epic 5 (Refinement). Each epic has clear inputs and outputs.
- **Story sizing guidance:** Phase 1 stories should be granular (one CRUD module per story). Phase 2-3 stories should be algorithm-centric (one model or one MRP step per story). Phase 4-5 stories can be integration-focused.
- **Risk to monitor:** The highest-risk moment is the Phase 2 to Phase 3 handoff — the MRP engine consumes the forecasting engine output. Ensure forecast output schema (forecast_resultado table) is validated before MRP development begins.
- **Quality gates:** The PRD defines explicit quality targets (Section 9) — these should become acceptance criteria in Phase 2+ stories: MAPE < 10% for class A, Fill Rate > 97%, processing time < 15 min.
- **GitHub repository:** Already created at `https://github.com/ShinyAuroraa/forecasting-mrp` with scaffold in place (Next.js 14 + NestJS + FastAPI + PostgreSQL 16 + Redis + Turborepo).

---

*This project brief was generated by the Analyst Agent from PRD v1.0. All data points, metrics, and scope definitions trace directly to the source PRD — no invented features or requirements (Article IV compliance).*
