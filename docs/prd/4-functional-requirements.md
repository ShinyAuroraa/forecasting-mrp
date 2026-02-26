# 4. Functional Requirements

## 4.1 Epic 0 -- Infrastructure Setup (FR-001 to FR-005)

### FR-001: Monorepo Scaffold
- **Description:** Create monorepo structure using Turborepo with three apps: web (Next.js 14), api (NestJS), forecast-engine (FastAPI).
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - Turborepo configured with shared packages
  - All three apps scaffold in place
  - Shared TypeScript types package

### FR-002: Docker Compose Environment
- **Description:** Configure Docker Compose with all services: PostgreSQL 16, Redis, NestJS, FastAPI, Next.js.
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - `docker-compose up` starts all services
  - Services can communicate with each other
  - Volumes for data persistence

### FR-003: Database Schema (Registration Tables)
- **Description:** Create initial PostgreSQL schema with all registration tables as defined in Section 3 (produto, categoria, unidade_medida, fornecedor, produto_fornecedor, bom, inventario_atual, deposito, centro_trabalho, turno, parada_programada, evento_capacidade, roteiro_producao, calendario_fabrica, config_sistema, execucao_planejamento, execucao_step_log, forecast_resultado, parametros_estoque, ordem_planejada, carga_capacidade, usuario, forecast_metrica, forecast_modelo, sku_classification, serie_temporal).
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - All tables created with correct types, constraints, and relationships
  - UUID primary keys on all tables
  - Generated columns work correctly (inventario_atual)

### FR-004: CI/CD Pipeline
- **Description:** Configure GitHub Actions pipeline with build, lint, and test stages.
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - Pipeline triggers on push and PR
  - Build, lint, and test stages pass
  - Failure blocks merge

### FR-005: Synthetic Seed Data
- **Description:** Create seed data for development with realistic synthetic records for all registration tables.
- **Priority:** MUST
- **Epic:** 0
- **Acceptance Criteria:**
  - Products (500-5000 SKUs), suppliers, BOM structures, work centers, shifts, inventory positions
  - Data is coherent (BOM references valid products, etc.)
  - Seed script is repeatable

## 4.2 Epic 1 -- Foundation: Data Layer & CRUDs (FR-006 to FR-020)

### FR-006: Authentication Module
- **Description:** JWT-based authentication with role-based access control (RBAC), guards on all NestJS endpoints.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - JWT login/refresh flow
  - Role-based guards (admin, manager, operator, viewer)
  - Input validation on all endpoints (DTOs with class-validator)

### FR-007: Product CRUD
- **Description:** Full CRUD for products with paginated table, search, filters (type, category, status, ABC class), and bulk actions.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** As defined in Section 4.1 of original PRD (Dados Basicos, Dimensoes, Custos, Ressuprimento, Override groups)
- **Acceptance Criteria:**
  - Create, read, update, delete products
  - Paginated list with search and filters
  - All field groups implemented

### FR-008: Product Mass Import
- **Description:** `[MUST]` Upload CSV/XLSX with all product fields. Downloadable template with examples.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - CSV and XLSX upload supported
  - Template download with sample data
  - Validation with error reporting (row-level errors)
  - Successful rows imported even if some fail

### FR-009: BOM CRUD (Bill of Materials)
- **Description:** CRUD for BOM with tree visualization showing product hierarchy.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** Product parent (search by code/description), product child (search), quantity, unit of measure (inherited), loss percentage (0-100%, default 0), observation, valid from/to dates.
- **Acceptance Criteria:**
  - Tree visual interface showing hierarchy
  - Add/remove/edit BOM lines
  - Multi-level BOM display

### FR-010: BOM Exploded Cost Display
- **Description:** `[MUST]` Display exploded cost in the BOM interface: sum cost of all components multiplied by BOM quantities.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - Exploded cost calculated and displayed in real-time
  - Multi-level cost roll-up
  - Includes loss percentage in calculation

### FR-011: Supplier CRUD
- **Description:** Full CRUD for suppliers with registration fields and performance fields.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** Code, Razao Social, Nome Fantasia, CNPJ (with validation), Email, Phone, City, State, Lead time standard/min/max, Reliability (%), Rating (1-5 stars).
- **Acceptance Criteria:**
  - CNPJ validation with check digits
  - All fields implemented
  - Active/inactive toggle

### FR-012: SKU-Supplier Linkage
- **Description:** Interface to associate multiple suppliers per product, defining for each: specific lead time, unit price, MOQ, purchase multiple, and whether it is the primary supplier.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - N:N relationship management UI
  - Primary supplier designation
  - All produto_fornecedor fields editable

### FR-013: Work Center CRUD
- **Description:** Table and form for work centers with all fields from `centro_trabalho`.
- **Priority:** MUST
- **Epic:** 1
- **Fields:** Code, Name, Type (PRODUCAO, EMBALAGEM, MONTAGEM, ACABAMENTO, CONTROLE_QUALIDADE), Capacity/hour, Efficiency (%), Operators, Setup time, Cost/hour.
- **Acceptance Criteria:**
  - Full CRUD with all fields
  - Effective capacity auto-calculated and displayed

### FR-014: Shift Management
- **Description:** Shift management per work center with automatic capacity calculation display.
- **Priority:** MUST
- **Epic:** 1
- **`[MUST]`** Display automatic calculation: "Daily effective capacity (Mon-Fri): 16h x 184 un/h = 2,944 un"
- **Acceptance Criteria:**
  - Shifts linked to work centers
  - Days of week selection
  - Auto-calculated daily capacity displayed

### FR-015: Scheduled Stops Management
- **Description:** List scheduled stops per work center with type, period, recurrence support via cron expression.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - CRUD for scheduled stops
  - Recurring stops via cron expression
  - "Next stops" display with day count

### FR-016: Capacity Events Management
- **Description:** Chronological timeline of all capacity events with form for type, date, changed field, previous value (auto-filled), new value, reason, resolution forecast (required if QUEBRA).
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - Event timeline visualization
  - Auto-fill of previous value
  - Resolution forecast required for QUEBRA type

### FR-017: Storage Capacity (Warehouse) Management
- **Description:** Warehouse/depot table with name, type, capacity, occupancy (%).
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - CRUD for depositos
  - Occupancy percentage display
  - Visual alerts when occupancy > 90%

### FR-018: Inventory Management
- **Description:** Current inventory CRUD with search, filters (type, warehouse, status).
- **Priority:** MUST
- **Epic:** 1
- **Three update methods:**
  1. Spreadsheet upload (ERP stock position)
  2. Automatic ERP database sync
  3. Manual editing (for count adjustments)
- **Acceptance Criteria:**
  - All three update methods supported
  - Indicators: total stock value, items below ROP (with link), items above max (idle capital)

### FR-019: Data Ingestion Pipeline (Basic)
- **Description:** Upload CSV/XLSX + mapping + basic ETL pipeline.
- **Priority:** MUST
- **Epic:** 1
- **Acceptance Criteria:**
  - File upload UI
  - Column mapping interface
  - ETL: parse -> map -> validate -> clean
  - Error reporting

### FR-020: Automatic Classification (ABC, XYZ, Demand Pattern)
- **Description:** Automatic classification engine that runs on uploaded sales data and categorizes SKUs.
- **Priority:** MUST
- **Epic:** 1
- **Classification types:**
  - ABC (by revenue contribution)
  - XYZ (by demand variability)
  - Demand pattern (SMOOTH, ERRATIC, INTERMITTENT, LUMPY)
- **Acceptance Criteria:**
  - ABC classification with Pareto thresholds
  - XYZ classification by coefficient of variation
  - Demand pattern classification (>25% zeros = intermittent)
  - Results stored and displayed per SKU

## 4.3 Epic 2 -- Intelligence: Forecasting Engine (FR-021 to FR-033)

### FR-021: FastAPI Microservice Setup
- **Description:** FastAPI microservice with training and prediction endpoints.
- **Priority:** MUST
- **Epic:** 2
- **Acceptance Criteria:**
  - FastAPI app with health check endpoint
  - Train and predict routes
  - Integration with PostgreSQL for data access

### FR-022: Multi-Model Strategy Engine
- **Description:** `[RULE]` Automatic model selection based on SKU classification with user override capability.
- **Priority:** MUST
- **Epic:** 2
- **Model selection matrix:**

| SKU Classification | Primary Model | Fallback |
|-------------------|---------------|----------|
| SMOOTH + class A/B | TFT | LightGBM |
| SMOOTH + class C | ETS (Holt-Winters) | Naive |
| ERRATIC + class A/B | TFT | ETS |
| ERRATIC + class C | ETS | Naive |
| INTERMITTENT (any) | Croston/TSB | SBA |
| LUMPY (any) | TSB | Bootstrap |
| Insufficient data (<40 weeks) | Simple ETS | Naive |

- **Additionally:**
  - TFT Volume (target=volume) -> feeds MRP
  - TFT Revenue (target=revenue) -> feeds BI
  - Ensemble (TFT 0.6 + LightGBM 0.4) -> for class A SKUs

### FR-023: TFT Model (Volume)
- **Description:** Temporal Fusion Transformer for volume forecasting on smooth/erratic class A/B SKUs with >= 52 weeks of data. Quantiles P10, P25, P50, P75, P90.
- **Priority:** MUST
- **Epic:** 2
- **Implementation:** PyTorch Forecasting (pytorch_forecasting.TemporalFusionTransformer)
- **Re-training:** Monthly or when MAPE degrades > 5 points
- **Inference:** Weekly (pre-trained model)
- **Hardware:** GPU for training, CPU for inference

### FR-024: TFT Model (Revenue)
- **Description:** TFT trained with weekly revenue as target, includes price as observed variable. Same quantile outputs.
- **Priority:** MUST
- **Epic:** 2

### FR-025: ETS Model (Holt-Winters)
- **Description:** ExponentialSmoothing from statsmodels for class C SKUs or insufficient TFT data.
- **Priority:** MUST
- **Epic:** 2
- **Implementation:** `statsmodels.tsa.holtwinters.ExponentialSmoothing`
- **Variants:** Additive or multiplicative (auto-selection by AIC)
- **Intervals:** Via simulation (1000 paths)

### FR-026: Croston/TSB Model
- **Description:** For intermittent SKUs (>25% zeros) or lumpy demand.
- **Priority:** MUST
- **Epic:** 2
- **Implementation:** `statsforecast` or custom implementation
- **Croston:** Decomposes into inter-demand interval x demand size
- **TSB:** Improvement with exponential decay (better for obsolescence)
- **Intervals:** Via bootstrap

### FR-027: Forecast Execution Pipeline
- **Description:** 10-step execution pipeline from data loading through MRP triggering.
- **Priority:** MUST
- **Epic:** 2
- **Steps:**
  1. Load clean data (weekly granularity)
  2. Segment by model (read sku_classification.modelo_forecast_sugerido)
  3. Execute TFT (volume + revenue, training or inference)
  4. Execute ETS (individual fit + predict per SKU)
  5. Execute Croston/TSB (individual fit + predict per SKU)
  6. Execute LightGBM (global model + ensemble for class A)
  7. Calculate forecast revenue (Volume P50 x expected_price)
  8. Calculate metrics (backtesting: train T-13, predict 13 weeks, compare)
  9. Save results (forecast_resultado, forecast_metrica, forecast_modelo)
  10. Trigger MRP (if configured for chaining)
- **Triggers:** Manual (button) | Scheduled (cron) | Automatic (post-ingestion)

### FR-028: Revenue Forecasting -- Dual Approach
- **Description:** `[RULE]` System runs BOTH approaches and shows on dashboard.
- **Priority:** MUST
- **Epic:** 2
- **Approach A -- Indirect (Volume x Price):**
  ```
  forecast_revenue = forecast_volume.P50 x expected_price
  expected_price = 1. Current list price (if registered)
                   2. Or weighted average of last 3 months
                   3. Or last practiced price (forward fill)
  ```
- **Approach B -- Direct (TFT with target=revenue):**
  TFT model trained with weekly revenue as target. Includes price as observed variable.
- **Dashboard display:** Real revenue (past), Forecast A (blue line), Forecast B (green line), Confidence interval (gray band). When A and B diverge significantly -> attention flag (indicates mix/price change).

### FR-029: Backtesting Pipeline
- **Description:** Automated backtesting with accuracy metrics.
- **Priority:** MUST
- **Epic:** 2
- **Metrics:** MAPE, MAE, RMSE per SKU and per class
- **Method:** Train with T-13, predict 13 weeks, compare with actual
- **Baseline comparison:** Against 12-week moving average

### FR-030: NestJS-FastAPI Integration via BullMQ
- **Description:** Async job queue integration between NestJS orchestrator and FastAPI workers.
- **Priority:** MUST
- **Epic:** 2
- **Job types:** train_model, run_forecast
- **Features:** Progress events via Redis pub/sub -> WebSocket -> Frontend
- **Error handling:** Retry, dead letter queue

### FR-031: Forecast Dashboard
- **Description:** Frontend dashboard for forecast visualization and analysis.
- **Priority:** MUST
- **Epic:** 2
- **Components:**
  1. SKU selector (search) + Period selector + Aggregation selector
  2. Main chart: historical actual + forecast P50 + P10-P90 bands
  3. Secondary chart: real revenue vs. indirect forecast (blue) vs. direct TFT (green)
  4. Metrics table: MAPE, MAE, RMSE, Bias per SKU
  5. Ranking: Top 10 SKUs with best and worst accuracy
  6. Variable importance: bar chart (from TFT)
  7. Baseline comparison: TFT vs. Moving Average vs. Holt-Winters

### FR-032: Forecast Metrics Storage
- **Description:** Store forecast accuracy metrics per execution, per SKU, per class.
- **Priority:** MUST
- **Epic:** 2
- **Stored metrics:** MAPE, MAE, RMSE per SKU, aggregated per class (A, B, C)

### FR-033: Model Metadata Storage
- **Description:** Store model metadata including version, parameters, training metrics, training date.
- **Priority:** MUST
- **Epic:** 2

## 4.4 Epic 3 -- MRP: Planning Engine (FR-034 to FR-049)

### FR-034: Master Production Schedule (MPS)
- **Description:** Generate MPS from forecast + firm orders for finished products.
- **Priority:** MUST
- **Epic:** 3
- **`[RULE]`** `demand(t) = MAX(forecast_P50(t), firm_orders(t))` -- If firm order > forecast, use firm order (reality > prediction for short term). Firm order horizon: 2-4 weeks (configurable), beyond that: forecast only.

### FR-035: Stock Parameter Calculation
- **Description:** Calculate SS, ROP, Min, Max, EOQ for all SKUs.
- **Priority:** MUST
- **Epic:** 3
- **`[RULE]`** If TFT available: `SS = P(service_level) - P50 of demand accumulated over lead time`
- **`[RULE]`** If TFT not available (classical formula): `SS = Z x sqrt(LT x sigma_d^2 + d_bar^2 x sigma_LT^2)`. Z = 1.88 (97%), 1.48 (93%), 1.04 (85%)
- **`[RULE]`** `ROP = d_bar x LT + SS`; `EOQ = sqrt(2 x D_annual x K / h)`; `Min = ROP`; `Max = d_bar x (LT + R) + SS` (R = review interval)

### FR-036: Multi-Level BOM Explosion (Low-Level Coding)
- **Description:** MRP explosion processing level by level with low-level coding.
- **Priority:** MUST
- **Epic:** 3
- **`[RULE]`** If an item appears at multiple levels, use the HIGHEST level number.
- **Algorithm:**
  - Level 0 = finished products (no parent)
  - Process level by level (0, then 1, then 2...)
  - For each item, each period: calculate gross requirement, scheduled receipts, projected stock, net requirement
  - If projected stock < safety stock: generate planned order
  - Explode dependent demand to children: `dependent_demand(child, t-LT) += planned_order(parent, t) x BOM_qty / (1 - loss%)`

### FR-037: Lot Sizing
- **Description:** Configurable lot sizing per SKU or per class.
- **Priority:** MUST
- **Epic:** 3
- **Methods:**
  - L4L (Lot-for-Lot): Qty = Net Requirement
  - EOQ: Qty = EOQ (rounded to purchase multiple). If need < EOQ, order full EOQ
  - Silver-Meal: Aggregate future needs while average cost/period decreases. Stop when average cost starts rising.
- **`[RULE]`** In ALL cases, apply constraints in order: (1) If Qty < lote_minimo -> Qty = lote_minimo, (2) If Qty % multiplo_compra != 0 -> round up, (3) If Qty < MOQ from supplier -> Qty = MOQ

### FR-038: Planned Order Generation
- **Description:** Generate purchase and production orders from MRP results.
- **Priority:** MUST
- **Epic:** 3
- **Logic:**
  - If PURCHASED item (input, raw material, packaging): -> Purchase order. Supplier = primary supplier. Release date = need date - supplier lead time. Cost = qty x supplier unit price.
  - If PRODUCED item (finished, semi-finished): -> Production order. Work center = first center in production routing. Release date = need date - production lead time. Hours needed = (qty / capacity_hour) + setup time.

### FR-039: Action Messages
- **Description:** Compare new plan with existing orders and generate actionable messages.
- **Priority:** MUST
- **Epic:** 3
- **Message types:**
  - Order exists but no longer needed -> "CANCEL OC-123"
  - Order exists but needs more -> "INCREASE OC-123 from 500 to 800"
  - Order exists but needs less -> "REDUCE OC-123 from 500 to 300"
  - Order exists but date changed -> "EXPEDITE OC-123 by 2 weeks"
  - Order does not exist and is needed -> "NEW purchase order"

### FR-040: Capacity Requirements Planning (CRP)
- **Description:** Validate production capacity against planned orders (MRP II).
- **Priority:** MUST
- **Epic:** 3
- **Algorithm:** For each work center, each week: calculate planned load (sum of hours for all production orders), available capacity (sum of shift hours - scheduled stops - breakdown events), utilization percentage.
- **`[RULE]`** Overload thresholds: <= 110% = 'HORA_EXTRA', 110-130% = 'ANTECIPAR', > 130% = 'SUBCONTRATAR'

### FR-041: Storage Capacity Validation
- **Description:** Validate projected inventory against warehouse storage capacity.
- **Priority:** MUST
- **Epic:** 3
- **Algorithm:** For each warehouse, each week: calculate projected volume = sum of (projected_stock x volume_m3) for each SKU. Occupancy = projected_volume / capacity_m3 x 100.
- **`[RULE]`** > 90%: ALERT with suggestions. > 95%: CRITICAL ALERT.

### FR-042: Purchasing Panel
- **Description:** `[MUST]` The most actionable output of the system.
- **Priority:** MUST
- **Epic:** 3
- **Section "Urgent Actions" (next 7 days):** For each urgent item: SKU + description, Quantity to buy, Supplier (name + lead time), "Order by" (date), Expected receipt, Purchase reason, Estimated cost, Buttons: [Generate Order] [Postpone] [Change Qty]
- **Section "Summary by Supplier":** Grouped table with total items and value per supplier.
- **Total planned purchases (next 13 weeks)** with value.
- **Export to Excel** and **Send summary by email**.

### FR-043: MRP Dashboard (Gantt)
- **Description:** Timeline Gantt of planned orders (purchase=blue, production=green).
- **Priority:** MUST
- **Epic:** 3

### FR-044: MRP Detail Table
- **Description:** Detailed MRP table (SKU selector): Gross Requirement, Scheduled Receipts, Projected Stock, Net Requirement, Planned Orders per period.
- **Priority:** MUST
- **Epic:** 3

### FR-045: Stock Projection Chart
- **Description:** Chart per SKU showing projected future stock vs. SS/ROP/Max lines.
- **Priority:** MUST
- **Epic:** 3

### FR-046: Capacity Dashboard
- **Description:** Capacity visualization dashboard.
- **Priority:** MUST
- **Epic:** 3
- **Components:**
  1. Stacked bars per work center (load vs. capacity)
  2. Weekly heatmap: centers x weeks, colored by % utilization
  3. Event timeline: breakdowns, new machinery, shift changes
  4. Gauge of occupancy per warehouse + future projection
  5. Overload alerts with action suggestions

### FR-047: Production Routing CRUD
- **Description:** CRUD for production routings linking products to work centers with operation sequence.
- **Priority:** MUST
- **Epic:** 3
- **Fields:** Product, work center, sequence, operation name, setup time, unit time, wait time, description.

### FR-048: Factory Calendar Management
- **Description:** CRUD for factory calendar defining working days, holidays, and productive hours.
- **Priority:** MUST
- **Epic:** 3

### FR-049: Net Requirement Calculation Engine
- **Description:** Core MRP net requirement calculation: `Net = Gross - Available Stock - Scheduled Receipts + Safety Stock`.
- **Priority:** MUST
- **Epic:** 3

## 4.5 Epic 4 -- Automation & BI (FR-050 to FR-063)

### FR-050: Email Listener
- **Description:** Automated email monitoring for daily closing data.
- **Priority:** MUST
- **Epic:** 4
- **Option A -- Gmail API (recommended):** Service account on Google Cloud, OAuth2. Filters: from, subject ("Fechamento" OR "Relatorio diario"), has:attachment, after:date.
- **Option B -- IMAP (any provider):** Connect via imaplib (Python) or nodemailer (Node). Filter by sender + subject + date.
- **Option C -- Shared folder / SFTP:** Monitor folder (watch/polling) for new files.
- **Implementation as Worker:** NestJS `@Cron('0 6 * * *')` or BullMQ repeatable job at 06:00.
- **`[RULE]`** Retry: if fails, try 06:30, 07:00, 07:30. Dead letter: if fails 4x, alert admin by email.

### FR-051: ERP Connector
- **Description:** Three integration options (configurable).
- **Priority:** MUST
- **Epic:** 4
- **Options:**
  1. **REST API**: endpoint + credentials + format -> GET /api/movimentacoes?data={yesterday}
  2. **Direct DB** (read-only): connection string -> incremental query WHERE data_movimento = CURRENT_DATE - 1
  3. **Exported CSV**: monitor export folder
- Regardless of method, ETL pipeline is the same: Raw data -> Staging -> Validation -> Cleaning -> clean data

### FR-052: Daily Automated Pipeline
- **Description:** `[RULE]` Full automated daily pipeline: ingestion -> inference -> MRP -> alerts.
- **Priority:** MUST
- **Epic:** 4
- **Timeline:**
  ```
  06:00  Email Listener checks inbox
  06:01  Finds previous day's closing email
  06:02  Downloads attachment (CSV/XLSX/PDF)
  06:03  If PDF: OCR -> extract data -> convert to CSV
         If CSV/XLSX: process directly
  06:05  Apply saved mapping template
  06:06  Execute incremental ETL (new data only)
  06:10  Update inventory (if data available)
  06:11  Run incremental forecast (inference, not re-training)
  06:15  Run incremental MRP
  06:16  Check alerts (stockout, urgent purchases, overload, forecast deviation)
  06:17  Send daily summary email
  ```

### FR-053: Daily Summary Email
- **Description:** `[MUST]` Automatically sent email containing: yesterday's closing (real vs. forecast revenue, volume sold, average ticket), stock alerts (SKUs below SS, SKUs approaching ROP), urgent purchases (total value and orders in next 7 days), capacity (utilization per work center with alerts), forecast accuracy (MAPE per class, last 4 weeks).
- **Priority:** MUST
- **Epic:** 4

### FR-054: Executive Dashboard
- **Description:** Executive-level BI dashboard.
- **Priority:** MUST
- **Epic:** 4
- **KPI Cards at top:**
  - Monthly revenue (with % MoM)
  - Forecast Accuracy (with variation)
  - Inventory Turnover (with variation)
  - Fill Rate OTIF (with variation)
- **Main chart:** Real Revenue vs. Forecast (12 months past + 3 months projection), with P10-P90 bands.
- **Secondary charts:** Pareto ABC (clickable by class), Stock Coverage (heatmap: SKU x coverage days).
- **Active alerts:** SKUs in stockout, near ROP, overloaded centers, full warehouses.

### FR-055: LightGBM Model
- **Description:** LightGBM as challenger to TFT for class A (ensemble), or when TFT fails.
- **Priority:** MUST
- **Epic:** 4
- **Implementation:** `lightgbm` with temporal feature engineering
- **Features:** Lags (1-52 weeks), rolling mean/std, calendar, price, promotions
- **Model type:** Global model (all SKUs together)

### FR-056: Ensemble Model (Class A SKUs)
- **Description:** Combine TFT (weight 0.6) + LightGBM (weight 0.4), or weights optimized by cross-validation.
- **Priority:** MUST
- **Epic:** 4
- **Justification:** For high-value SKUs, combination reduces individual error risk.

### FR-057: What-If Scenario Analysis
- **Description:** Slider-based forecast adjustments for scenario exploration.
- **Priority:** SHOULD
- **Epic:** 4

### FR-058: Excel/PDF Export
- **Description:** Export capability for dashboards, reports, and purchasing panel.
- **Priority:** MUST
- **Epic:** 4

### FR-059: Re-training Cycles
- **Description:** Automated re-training schedule management.
- **Priority:** MUST
- **Epic:** 4
- **Frequencies:**

| Frequency | Action | Expected Duration |
|-----------|--------|-------------------|
| **Daily** (automatic) | Ingestion, inference (no training), recalculate MRP, alerts | ~2 min |
| **Weekly** (automatic) | Compare forecast vs. actual, update MAPE, recalculate ABC/XYZ, stock parameters | ~10 min |
| **Monthly** (automatic) | Re-train ALL models, champion-challenger, accuracy report | ~30-60 min |
| **Manual** (when needed) | Structural change, atypical event, historical data correction | Variable |

### FR-060: OCR for PDF Attachments
- **Description:** If email attachment is PDF, apply OCR to extract data and convert to CSV.
- **Priority:** SHOULD
- **Epic:** 4

### FR-061: Ingestion Mapping Template
- **Description:** Saved column mapping templates for recurring data sources.
- **Priority:** MUST
- **Epic:** 4

### FR-062: Alert System
- **Description:** Centralized alert system for stockouts, urgent purchases, capacity overloads, and forecast deviations.
- **Priority:** MUST
- **Epic:** 4

### FR-063: Morning Briefing Email
- **Description:** Comprehensive morning briefing email sent automatically before workday begins.
- **Priority:** MUST
- **Epic:** 4

## 4.6 Epic 5 -- Refinement & Production (FR-064 to FR-076)

### FR-064: Wagner-Whitin Lot Sizing
- **Description:** Optimal lot sizing algorithm (dynamic programming approach).
- **Priority:** SHOULD
- **Epic:** 5

### FR-065: Monte Carlo Safety Stock (Class A)
- **Description:** Monte Carlo simulation for safety stock calculation on class A SKUs.
- **Priority:** SHOULD
- **Epic:** 5

### FR-066: Champion-Challenger Model Selection
- **Description:** `[RULE]` Automated model comparison -- only promotes new model if it outperforms the incumbent.
- **Priority:** MUST
- **Epic:** 5

### FR-067: Drift Detection and Auto-Retraining
- **Description:** Automatic detection of model drift and triggered retraining.
- **Priority:** MUST
- **Epic:** 5

### FR-068: Manual Forecast Override
- **Description:** Allow users to manually override forecast values with audit logging.
- **Priority:** MUST
- **Epic:** 5

### FR-069: BOM Versioning
- **Description:** Full BOM version management with valid_from/valid_to dates.
- **Priority:** MUST
- **Epic:** 5

### FR-070: Historical Lead Time Tracking
- **Description:** Track actual lead times per supplier for lead time variance (sigma_LT) calculation.
- **Priority:** MUST
- **Epic:** 5

### FR-071: PDF Management Reports
- **Description:** Generate PDF management reports for executive review.
- **Priority:** SHOULD
- **Epic:** 5

### FR-072: Integration Testing
- **Description:** Comprehensive integration test suite covering all service boundaries.
- **Priority:** MUST
- **Epic:** 5

### FR-073: Load Testing
- **Description:** Load testing to validate performance under expected volumes.
- **Priority:** MUST
- **Epic:** 5

### FR-074: Production Deployment (AWS EKS)
- **Description:** Deploy to AWS EKS with GPU Spot Instances for model training, auto-scaling for inference.
- **Priority:** MUST
- **Epic:** 5

### FR-075: User Activity Logging
- **Description:** Login analytics, page views, override logging for user metrics tracking.
- **Priority:** SHOULD
- **Epic:** 5

### FR-076: System Configuration UI
- **Description:** Admin UI for managing config_sistema entries (forecast horizon, service levels, lot sizing defaults, automation settings).
- **Priority:** MUST
- **Epic:** 5

---
