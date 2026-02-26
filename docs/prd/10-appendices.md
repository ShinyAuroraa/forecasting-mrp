# 10. Appendices

## Appendix A: Project Folder Structure

```
forecasting-mrp/
+-- apps/
|   +-- web/                          # Next.js 14 (frontend)
|   |   +-- app/
|   |   |   +-- (auth)/              # Login, registration
|   |   |   +-- dashboard/           # Executive dashboard
|   |   |   +-- forecast/            # Forecast screens
|   |   |   +-- mrp/                 # MRP screens
|   |   |   +-- compras/             # Purchasing panel
|   |   |   +-- cadastros/
|   |   |   |   +-- produtos/
|   |   |   |   +-- bom/
|   |   |   |   +-- fornecedores/
|   |   |   |   +-- capacidade/      # Work centers, shifts, events
|   |   |   +-- inventario/
|   |   |   +-- ingestao/            # Upload, mapping, ETL
|   |   |   +-- automacao/           # Email config, schedules
|   |   |   +-- config/              # System settings
|   |   +-- components/
|   |   |   +-- charts/              # ECharts wrappers
|   |   |   +-- tables/              # DataTables with filters
|   |   |   +-- forms/               # Reusable forms
|   |   +-- lib/                     # API client, utils
|   |
|   +-- api/                          # NestJS (main backend)
|   |   +-- src/
|   |   |   +-- auth/                # JWT, guards, roles
|   |   |   +-- produtos/            # Products CRUD
|   |   |   +-- bom/                 # BOM CRUD + explosion
|   |   |   +-- fornecedores/        # Suppliers CRUD
|   |   |   +-- capacidade/          # Work centers, shifts, events, calendar
|   |   |   +-- inventario/          # Stock position
|   |   |   +-- ingestao/            # Upload, mapping, ETL
|   |   |   +-- mrp/                 # Complete MRP engine
|   |   |   +-- forecast/            # Orchestration (calls FastAPI)
|   |   |   +-- automacao/           # Email listener, scheduler
|   |   |   +-- notificacao/         # Email, webhook
|   |   |   +-- common/              # Filters, interceptors, DTOs
|   |   +-- prisma/                  # Prisma Schema (ORM)
|   |
|   +-- forecast-engine/              # FastAPI (Python microservice)
|       +-- app/
|       |   +-- models/
|       |   |   +-- tft_trainer.py
|       |   |   +-- tft_predictor.py
|       |   |   +-- ets_model.py
|       |   |   +-- croston_model.py
|       |   |   +-- lightgbm_model.py
|       |   |   +-- ensemble.py
|       |   +-- etl/
|       |   |   +-- feature_engineering.py
|       |   |   +-- data_preparation.py
|       |   +-- metrics/
|       |   |   +-- accuracy.py
|       |   |   +-- backtesting.py
|       |   +-- routes/
|       |   |   +-- train.py
|       |   |   +-- predict.py
|       |   |   +-- metrics.py
|       |   +-- workers/
|       |       +-- training_worker.py
|       +-- models/                   # Trained models (.ckpt)
|       +-- requirements.txt
|
+-- packages/
|   +-- shared/                       # Shared TypeScript types
|
+-- docker-compose.yml
+-- docker-compose.prod.yml
+-- turbo.json
+-- README.md
```

## Appendix B: Forecasting Algorithm Details

### B.1 Multi-Model Selection Matrix

| SKU Classification | Primary Model | Fallback | Condition |
|-------------------|---------------|----------|-----------|
| SMOOTH + class A/B | TFT | LightGBM | >= 52 weeks data |
| SMOOTH + class C | ETS (Holt-Winters) | Naive | Any data length |
| ERRATIC + class A/B | TFT | ETS | >= 52 weeks data |
| ERRATIC + class C | ETS | Naive | Any data length |
| INTERMITTENT (any) | Croston/TSB | SBA | > 25% zeros |
| LUMPY (any) | TSB | Bootstrap | > 25% zeros + high CV |
| Insufficient data | Simple ETS | Naive | < 40 weeks |

### B.2 Safety Stock Formulas

**TFT-based (preferred):**
```
SS = P(service_level) - P50 of demand accumulated over lead time
```

**Classical formula (fallback):**
```
SS = Z x sqrt(LT x sigma_d^2 + d_bar^2 x sigma_LT^2)

Z values by class:
  Class A (97%): Z = 1.88
  Class B (93%): Z = 1.48
  Class C (85%): Z = 1.04
```

**Other stock parameters:**
```
ROP = d_bar x LT + SS
EOQ = sqrt(2 x D_annual x K / h)
Min = ROP
Max = d_bar x (LT + R) + SS    (R = review interval)
```

### B.3 MRP Explosion Pseudocode

```
a) Assign level to each item:
   Level 0 = finished products (no parent)
   Level 1 = direct components of finished products
   Level N = components of components
   [RULE] If an item appears at multiple levels, use the HIGHEST level

b) Process level by level (0, then 1, then 2...):

For each item, for each period t:

  Gross Requirement(t) =
    Independent demand(t)           [from MPS, if finished]
    + Sum of Dependent demand(t)    [from parents in BOM]

  Scheduled Receipts(t) =
    orders already issued with receipt in t

  Projected Stock(t) =
    Projected Stock(t-1)
    + Scheduled Receipts(t)
    + Planned Order Receipts(t)
    - Gross Requirement(t)

  If Projected Stock(t) < Safety Stock:
    Net Requirement(t) =
      Gross Requirement(t)
      - Projected Stock(t-1)
      - Scheduled Receipts(t)
      + Safety Stock

    Apply lot sizing -> Planned Order Receipt(t)
    Calculate release date: t - Lead Time -> Planned Order Release(t - LT)

    If item is PARENT in BOM:
      Explode dependent demand to each child:
      Dependent demand(child, t-LT) +=
        Planned Order(parent, t) x BOM_qty / (1 - loss%)
```

### B.4 Lot Sizing Algorithms

```
L4L (Lot-for-Lot): Qty = Net Requirement

EOQ: Qty = EOQ (rounded to purchase multiple)
     If need < EOQ, order full EOQ

Silver-Meal: Aggregate future needs while average cost/period decreases
             Stop when average cost starts rising

[RULE] In ALL cases, apply constraints in order:
  1. If Qty < lote_minimo -> Qty = lote_minimo
  2. If Qty % multiplo_compra != 0 -> round up
  3. If Qty < MOQ from supplier -> Qty = MOQ
```

### B.5 CRP Algorithm

```
For each work center, for each week t:

  planned_load(t) = Sum for each production order in t:
    (quantity / effective_capacity_hour) + setup_time

  available_capacity(t) =
    Sum of active shift hours - scheduled stops - breakdown events

  utilization(t) = load / capacity x 100

  If utilization > 100%: -> OVERLOAD
    <= 110%: suggestion = 'OVERTIME'
    110-130%: suggestion = 'EXPEDITE'
    > 130%: suggestion = 'SUBCONTRACT'
```

### B.6 Available Capacity Calculation

```
For each work center, for each day:
  available_hours = Sum(hours of each active shift on that weekday)
                  - scheduled stops on that day
                  - holidays (factory calendar)

  capacity_units = available_hours x capacity_hour x efficiency / 100

For each week (MRP period):
  weekly_capacity = Sum of capacity_units for each day of the week
```

### B.7 Revenue Forecasting Dual Approach

**Approach A -- Indirect (Volume x Price):**
```
forecast_revenue = forecast_volume.P50 x expected_price

expected_price =
  1. Current list price (if registered)
  2. Or weighted average of last 3 months
  3. Or last practiced price (forward fill)
```

**Approach B -- Direct (TFT with target=revenue):**
TFT model trained with weekly revenue as target. Includes price as observed variable.

**Dashboard display:** Real revenue (past), Forecast A (blue line), Forecast B (green line), Confidence interval (gray band). When A and B diverge significantly -> attention flag (indicates mix/price structural change).

## Appendix C: Risks & Open Questions

### Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Insufficient historical data for TFT | Medium | High | Graceful fallback to ETS/Naive; synthetic data augmentation; cold-start protocol |
| BOM data quality | High | High | Validation rules on BOM entry; exploded cost for visual verification; data quality scoring |
| Model drift over time | Medium | Medium | Weekly MAPE monitoring; automatic drift detection; monthly champion-challenger |
| GPU infrastructure costs | Low | Medium | Spot Instances (70-90% discount); train monthly not daily; inference is CPU-only |
| ERP integration complexity | Medium | Medium | Three connector options (API, DB, file); manual upload always available as fallback |
| User adoption resistance | Medium | High | Purchasing panel as primary actionable interface; morning email reduces friction |
| Scope creep from 7-component system | Medium | High | Phase-gated delivery with clear MVP; each phase delivers standalone value |
| Performance under large SKU catalogs | Low | Medium | PostgreSQL optimization; batch processing; async job queue |

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

## Appendix D: Long-Term Vision (Post-Phase 5)

- Multi-plant support (cross-plant inventory visibility and transfer optimization)
- Supplier portal for collaborative planning and automatic PO transmission
- Advanced demand sensing (incorporating point-of-sale data, weather, social media signals)
- Prescriptive analytics (automated "what if" scenario generation with recommended actions)
- Mobile companion app for shop floor alerts and approval workflows
- Internationalization (multi-language beyond Portuguese)
- Multi-currency support (exchange rate management for international suppliers)

## Appendix E: API Endpoint Inventory

All endpoints are prefixed with `/api/v1/`.

| Module | Endpoints | PRD References |
|--------|-----------|----------------|
| `auth` | `POST /auth/login`, `POST /auth/refresh` | FR-006 |
| `produtos` | `CRUD /produtos`, `POST /produtos/import` | FR-007, FR-008 |
| `bom` | `CRUD /bom`, `GET /bom/:id/tree`, `GET /bom/:id/cost` | FR-009, FR-010, FR-069 |
| `fornecedores` | `CRUD /fornecedores`, `CRUD /produto-fornecedor` | FR-011, FR-012 |
| `capacidade` | `CRUD /centros`, `/turnos`, `/paradas`, `/eventos`, `/roteiros`, `/calendario` | FR-013 to FR-016, FR-047, FR-048 |
| `inventario` | `CRUD /inventario`, `/depositos`, `POST /inventario/upload` | FR-017, FR-018 |
| `ingestao` | `POST /ingestao/upload`, `CRUD /ingestao/templates`, `POST /ingestao/etl` | FR-019, FR-020, FR-061 |
| `forecast` | `POST /forecast/execute`, `GET /forecast/results`, WS `job:progress` | FR-027 to FR-033 |
| `mrp` | `POST /mrp/execute`, `GET /mrp/orders`, `GET /mrp/capacity` | FR-034 to FR-049 |
| `automacao` | `CRUD /automacao/config`, `POST /automacao/trigger`, `GET /automacao/log` | FR-050 to FR-053, FR-059, FR-063 |
| `notificacao` | `GET /alerts`, WS `alert:new` | FR-062 |

> CRUD = GET (list), GET /:id (detail), POST (create), PATCH /:id (update), DELETE /:id (soft delete)

---

*This formalized PRD is the AUTHORITATIVE reference for the ForecastingMRP project. It preserves ALL content from the original PRD.md (v1.0, 1314 lines) with added formal requirement IDs, epic structure, and traceability matrix. No features were invented -- every FR, NFR, and CON traces directly to original PRD content (Article IV compliance). The original PRD.md at project root remains unchanged as the source document.*

*v2.1 Update (February 2026): Incorporated 7 architecture-driven changes from `docs/fullstack-architecture.md` Section 13 -- added 5 new tables (usuario, forecast_metrica, forecast_modelo, sku_classification, serie_temporal), WebSocket event schemas, API endpoint inventory (Appendix E), and resolved MRP engine tech ambiguity (NestJS confirmed).*
