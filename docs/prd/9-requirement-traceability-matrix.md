# 9. Requirement Traceability Matrix

| Req ID | Description | Epic | Priority | Status |
|--------|-------------|------|----------|--------|
| FR-001 | Monorepo Scaffold (Turborepo) | Epic 0 | MUST | Pending |
| FR-002 | Docker Compose Environment | Epic 0 | MUST | Pending |
| FR-003 | Database Schema (all tables incl. usuario, forecast_metrica, forecast_modelo, sku_classification, serie_temporal) | Epic 0 | MUST | Pending |
| FR-004 | CI/CD Pipeline (GitHub Actions) | Epic 0 | MUST | Pending |
| FR-005 | Synthetic Seed Data | Epic 0 | MUST | Pending |
| FR-006 | Authentication Module (JWT + RBAC) | Epic 1 | MUST | Pending |
| FR-007 | Product CRUD | Epic 1 | MUST | Pending |
| FR-008 | Product Mass Import (CSV/XLSX) | Epic 1 | MUST | Pending |
| FR-009 | BOM CRUD (tree visualization) | Epic 1 | MUST | Pending |
| FR-010 | BOM Exploded Cost Display | Epic 1 | MUST | Pending |
| FR-011 | Supplier CRUD | Epic 1 | MUST | Pending |
| FR-012 | SKU-Supplier Linkage | Epic 1 | MUST | Pending |
| FR-013 | Work Center CRUD | Epic 1 | MUST | Pending |
| FR-014 | Shift Management | Epic 1 | MUST | Pending |
| FR-015 | Scheduled Stops Management | Epic 1 | MUST | Pending |
| FR-016 | Capacity Events Management | Epic 1 | MUST | Pending |
| FR-017 | Storage Capacity Management | Epic 1 | MUST | Pending |
| FR-018 | Inventory Management | Epic 1 | MUST | Pending |
| FR-019 | Data Ingestion Pipeline (basic) | Epic 1 | MUST | Pending |
| FR-020 | Automatic Classification (ABC/XYZ/demand) | Epic 1 | MUST | Pending |
| FR-021 | FastAPI Microservice Setup | Epic 2 | MUST | Pending |
| FR-022 | Multi-Model Strategy Engine | Epic 2 | MUST | Pending |
| FR-023 | TFT Model (Volume) | Epic 2 | MUST | Pending |
| FR-024 | TFT Model (Revenue) | Epic 2 | MUST | Pending |
| FR-025 | ETS Model (Holt-Winters) | Epic 2 | MUST | Pending |
| FR-026 | Croston/TSB Model | Epic 2 | MUST | Pending |
| FR-027 | Forecast Execution Pipeline | Epic 2 | MUST | Pending |
| FR-028 | Revenue Forecasting -- Dual Approach | Epic 2 | MUST | Pending |
| FR-029 | Backtesting Pipeline | Epic 2 | MUST | Pending |
| FR-030 | NestJS-FastAPI Integration (BullMQ) | Epic 2 | MUST | Pending |
| FR-031 | Forecast Dashboard | Epic 2 | MUST | Pending |
| FR-032 | Forecast Metrics Storage | Epic 2 | MUST | Pending |
| FR-033 | Model Metadata Storage | Epic 2 | MUST | Pending |
| FR-034 | Master Production Schedule (MPS) | Epic 3 | MUST | Pending |
| FR-035 | Stock Parameter Calculation (SS/ROP/EOQ) | Epic 3 | MUST | Pending |
| FR-036 | Multi-Level BOM Explosion | Epic 3 | MUST | Pending |
| FR-037 | Lot Sizing (L4L, EOQ, Silver-Meal) | Epic 3 | MUST | Pending |
| FR-038 | Planned Order Generation | Epic 3 | MUST | Pending |
| FR-039 | Action Messages | Epic 3 | MUST | Pending |
| FR-040 | CRP Capacity Validation | Epic 3 | MUST | Pending |
| FR-041 | Storage Capacity Validation | Epic 3 | MUST | Pending |
| FR-042 | Purchasing Panel | Epic 3 | MUST | Pending |
| FR-043 | MRP Dashboard (Gantt) | Epic 3 | MUST | Pending |
| FR-044 | MRP Detail Table | Epic 3 | MUST | Pending |
| FR-045 | Stock Projection Chart | Epic 3 | MUST | Pending |
| FR-046 | Capacity Dashboard | Epic 3 | MUST | Pending |
| FR-047 | Production Routing CRUD | Epic 3 | MUST | Pending |
| FR-048 | Factory Calendar Management | Epic 3 | MUST | Pending |
| FR-049 | Net Requirement Calculation Engine | Epic 3 | MUST | Pending |
| FR-050 | Email Listener | Epic 4 | MUST | Pending |
| FR-051 | ERP Connector | Epic 4 | MUST | Pending |
| FR-052 | Daily Automated Pipeline | Epic 4 | MUST | Pending |
| FR-053 | Daily Summary Email | Epic 4 | MUST | Pending |
| FR-054 | Executive Dashboard | Epic 4 | MUST | Pending |
| FR-055 | LightGBM Model | Epic 4 | MUST | Pending |
| FR-056 | Ensemble Model (Class A) | Epic 4 | MUST | Pending |
| FR-057 | What-If Scenario Analysis | Epic 4 | SHOULD | Pending |
| FR-058 | Excel/PDF Export | Epic 4 | MUST | Pending |
| FR-059 | Re-training Cycles | Epic 4 | MUST | Pending |
| FR-060 | OCR for PDF Attachments | Epic 4 | SHOULD | Pending |
| FR-061 | Ingestion Mapping Template | Epic 4 | MUST | Pending |
| FR-062 | Alert System | Epic 4 | MUST | Pending |
| FR-063 | Morning Briefing Email | Epic 4 | MUST | Pending |
| FR-064 | Wagner-Whitin Lot Sizing | Epic 5 | SHOULD | Pending |
| FR-065 | Monte Carlo Safety Stock | Epic 5 | SHOULD | Pending |
| FR-066 | Champion-Challenger Model Selection | Epic 5 | MUST | Pending |
| FR-067 | Drift Detection and Auto-Retraining | Epic 5 | MUST | Pending |
| FR-068 | Manual Forecast Override | Epic 5 | MUST | Pending |
| FR-069 | BOM Versioning | Epic 5 | MUST | Pending |
| FR-070 | Historical Lead Time Tracking | Epic 5 | MUST | Pending |
| FR-071 | PDF Management Reports | Epic 5 | SHOULD | Pending |
| FR-072 | Integration Testing | Epic 5 | MUST | Pending |
| FR-073 | Load Testing | Epic 5 | MUST | Pending |
| FR-074 | Production Deployment (AWS EKS) | Epic 5 | MUST | Pending |
| FR-075 | User Activity Logging | Epic 5 | SHOULD | Pending |
| FR-076 | System Configuration UI | Epic 5 | MUST | Pending |
| NFR-001 | Daily Pipeline < 15 min | -- | MUST | Pending |
| NFR-002 | Forecast MAPE < 10% (Class A Volume) | -- | MUST | Pending |
| NFR-003 | Forecast MAPE < 20% (Class B Volume) | -- | MUST | Pending |
| NFR-004 | Forecast MAPE < 35% (Class C Volume) | -- | MUST | Pending |
| NFR-005 | Forecast MAPE < 12% (Class A Revenue) | -- | MUST | Pending |
| NFR-006 | Forecast MAPE < 22% (Class B Revenue) | -- | MUST | Pending |
| NFR-007 | Fill Rate > 97% (Class A) | -- | MUST | Pending |
| NFR-008 | Fill Rate > 93% (Class B) | -- | MUST | Pending |
| NFR-009 | Fill Rate > 85% (Class C) | -- | MUST | Pending |
| NFR-010 | Inventory Turnover Targets | -- | MUST | Pending |
| NFR-011 | Stockout Rate Targets | -- | MUST | Pending |
| NFR-012 | Safety Stock Accuracy | -- | MUST | Pending |
| NFR-013 | System Availability > 99.5% | -- | MUST | Pending |
| NFR-014 | Dead Letter Queue Handling | -- | MUST | Pending |
| NFR-015 | Retry Strategy | -- | MUST | Pending |
| NFR-016 | JWT Authentication | -- | MUST | Pending |
| NFR-017 | RBAC | -- | MUST | Pending |
| NFR-018 | Input Validation | -- | MUST | Pending |
| NFR-019 | CNPJ Validation | -- | MUST | Pending |
| NFR-020 | Read-Only ERP Connector | -- | MUST | Pending |
| NFR-021 | Environment-Based Secrets | -- | MUST | Pending |
| NFR-022 | SKU Volume Support (500-5000) | -- | MUST | Pending |
| NFR-023 | Supplier Volume Support (50-500) | -- | MUST | Pending |
| NFR-024 | Historical Data Depth (2-5 years) | -- | MUST | Pending |
| NFR-025 | Weekly Time Series Granularity | -- | MUST | Pending |
| NFR-026 | UUID Primary Keys | -- | MUST | Pending |
| NFR-027 | TimescaleDB Readiness | -- | SHOULD | Pending |
| NFR-028 | Test Coverage > 80% | -- | MUST | Pending |
| NFR-029 | TypeScript Strict Mode | -- | MUST | Pending |
| CON-001 | GPU for TFT Training | -- | MUST | Active |
| CON-002 | Min 40 Weeks Historical Data for TFT | -- | MUST | Active |
| CON-003 | Daily Pipeline < 15 min | -- | MUST | Active |
| CON-004 | BOM Data Quality Dependency | -- | MUST | Active |
| CON-005 | Intermittent Demand TFT Exclusion | -- | MUST | Active |
| CON-006 | Docker/EKS Environment Parity | -- | MUST | Active |
| CON-007 | 22-Week Timeline | -- | MUST | Active |
| CON-008 | Single-Plant Operation | -- | MUST | Active |
| CON-009 | Portuguese-Language UI | -- | MUST | Active |
| CON-010 | Single-Currency (BRL) | -- | MUST | Active |
| CON-011 | Fixed Tech Stack | -- | MUST | Active |
| CON-012 | Client Data Availability Assumption | -- | MUST | Active |
| CON-013 | Client ERP Export Capability Assumption | -- | MUST | Active |

---
