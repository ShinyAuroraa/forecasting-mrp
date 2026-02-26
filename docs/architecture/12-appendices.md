# 12. Appendices

## 12.1 Glossary

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

## 12.2 Module-to-Requirement Traceability

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

## 12.3 Constraint Impact Matrix

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
