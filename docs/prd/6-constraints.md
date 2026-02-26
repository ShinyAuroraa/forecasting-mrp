# 6. Constraints

### CON-001: GPU for TFT Training
- **Description:** GPU required for TFT model training (CPU sufficient for inference). Production needs GPU Spot Instances; dev can use CPU with smaller datasets.
- **Impact:** Infrastructure cost, training pipeline design

### CON-002: Minimum Historical Data for TFT
- **Description:** Minimum 40 weeks of historical data per SKU for TFT. New SKUs fall back to ETS/Naive until enough data accumulates.
- **Impact:** Model selection, cold-start protocol

### CON-003: Daily Pipeline Time Limit
- **Description:** Daily pipeline must complete in < 15 minutes. Constrains model complexity and batch sizes.
- **Impact:** Model architecture, batch processing design

### CON-004: BOM Data Quality Dependency
- **Description:** BOM accuracy depends on manual entry or ERP data quality. Garbage-in-garbage-out risk on MRP outputs.
- **Impact:** MRP accuracy, data validation requirements

### CON-005: Intermittent Demand TFT Exclusion
- **Description:** Intermittent demand SKUs (>25% zeros) cannot use TFT. Dedicated Croston/TSB path required.
- **Impact:** Model routing logic

### CON-006: Docker Compose / AWS EKS Parity
- **Description:** Docker Compose for dev; AWS EKS for production. Must maintain parity between environments.
- **Impact:** DevOps, containerization strategy

### CON-007: 22-Week Development Timeline
- **Description:** 22-week development roadmap across 6 phases. Sequential phase dependencies -- Phase 3 depends on Phase 2 output.
- **Impact:** Resource planning, risk management

### CON-008: Single-Plant Operation
- **Description:** System designed for single-plant operation (one factory, one set of work centers). Multi-plant would require significant architecture changes.
- **Impact:** Data model, capacity planning scope

### CON-009: Portuguese-Language UI
- **Description:** Portuguese-language UI is the primary requirement. Internationalization deferred to post-Phase 5.
- **Impact:** Frontend development, string management

### CON-010: Single-Currency (BRL)
- **Description:** Single-currency operation (BRL). Multi-currency purchasing would require exchange rate management.
- **Impact:** Financial calculations, supplier management

### CON-011: Tech Stack
- **Description:** Fixed technology stack as defined: Next.js 14, NestJS, FastAPI, PostgreSQL 16, Redis + BullMQ, Turborepo, Docker, AWS EKS.
- **Impact:** All development decisions

### CON-012: Client Data Availability
- **Description:** Assumption that client has at least 1-2 years of historical sales data in exportable format. If invalid, forecasting models will underperform or require synthetic augmentation.
- **Impact:** Phase 2 forecasting quality

### CON-013: Client ERP Export Capability
- **Description:** Assumption that client ERP can export daily data via at least one of: email, API, DB query, or file. Automation pipeline depends on at least one working data source.
- **Impact:** Phase 4 automation

---
