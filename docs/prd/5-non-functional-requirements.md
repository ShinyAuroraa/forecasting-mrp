# 5. Non-Functional Requirements

## 5.1 Performance

### NFR-001: Daily Pipeline Processing Time
- **Description:** Complete daily pipeline (ingestion + forecast inference + MRP) must finish in under 15 minutes.
- **Priority:** MUST
- **Target:** < 15 min
- **Measurement:** Pipeline execution log duration

### NFR-002: Forecast Accuracy -- Volume (Class A)
- **Description:** Volume forecast MAPE for class A SKUs must be below 10%.
- **Priority:** MUST
- **Target:** MAPE < 10%
- **Measurement:** Weekly backtesting against 13-week rolling window

### NFR-003: Forecast Accuracy -- Volume (Class B)
- **Description:** Volume forecast MAPE for class B SKUs must be below 20%.
- **Priority:** MUST
- **Target:** MAPE < 20%

### NFR-004: Forecast Accuracy -- Volume (Class C)
- **Description:** Volume forecast MAPE for class C SKUs must be below 35%.
- **Priority:** MUST
- **Target:** MAPE < 35%

### NFR-005: Forecast Accuracy -- Revenue (Class A)
- **Description:** Revenue forecast MAPE for class A products must be below 12%.
- **Priority:** MUST
- **Target:** MAPE < 12%

### NFR-006: Forecast Accuracy -- Revenue (Class B)
- **Description:** Revenue forecast MAPE for class B products must be below 22%.
- **Priority:** MUST
- **Target:** MAPE < 22%

### NFR-007: Fill Rate (OTIF) -- Class A
- **Description:** On-Time-In-Full delivery rate for class A products.
- **Priority:** MUST
- **Target:** > 97%

### NFR-008: Fill Rate (OTIF) -- Class B
- **Description:** On-Time-In-Full delivery rate for class B products.
- **Priority:** MUST
- **Target:** > 93%

### NFR-009: Fill Rate (OTIF) -- Class C
- **Description:** On-Time-In-Full delivery rate for class C products.
- **Priority:** MUST
- **Target:** > 85%

### NFR-010: Inventory Turnover
- **Description:** Target inventory turns per year by class.
- **Priority:** MUST
- **Target:** > 8x/year (A), > 5x/year (B), > 3x/year (C)

### NFR-011: Stockout Rate
- **Description:** Maximum percentage of SKUs in stockout by class.
- **Priority:** MUST
- **Target:** < 2% (A), < 5% (B), < 10% (C)

### NFR-012: Safety Stock Accuracy
- **Description:** Actual coverage must meet or exceed defined service level.
- **Priority:** MUST
- **Target:** Real coverage >= defined service level

## 5.2 Availability & Reliability

### NFR-013: System Availability
- **Description:** System uptime target.
- **Priority:** MUST
- **Target:** > 99.5%
- **Measurement:** Monitoring 06:00 daily pipeline execution success rate

### NFR-014: Dead Letter Queue Handling
- **Description:** Failed jobs must be captured in dead letter queue for investigation.
- **Priority:** MUST

### NFR-015: Retry Strategy
- **Description:** Email listener retries at 06:30, 07:00, 07:30 before dead letter.
- **Priority:** MUST

## 5.3 Security

### NFR-016: JWT Authentication
- **Description:** JWT-based authentication on all API endpoints.
- **Priority:** MUST

### NFR-017: Role-Based Access Control (RBAC)
- **Description:** Guards on all NestJS endpoints for authorization by role.
- **Priority:** MUST

### NFR-018: Input Validation
- **Description:** Input validation on all API endpoints using DTOs with class-validator.
- **Priority:** MUST

### NFR-019: CNPJ Validation
- **Description:** CNPJ validation with check digits on supplier records.
- **Priority:** MUST

### NFR-020: Read-Only ERP Connector
- **Description:** ERP connector must never write to source ERP system.
- **Priority:** MUST

### NFR-021: Environment-Based Secrets
- **Description:** Secrets managed via environment variables, never hardcoded.
- **Priority:** MUST

## 5.4 Scalability & Data

### NFR-022: SKU Volume Support
- **Description:** System must support 500-5,000 active SKUs.
- **Priority:** MUST

### NFR-023: Supplier Volume Support
- **Description:** System must support 50-500 suppliers.
- **Priority:** MUST

### NFR-024: Historical Data Depth
- **Description:** Support 2-5 years of weekly historical data per SKU.
- **Priority:** MUST

### NFR-025: Time Series Granularity
- **Description:** Weekly granularity aligned with MRP planning buckets.
- **Priority:** MUST

### NFR-026: UUID Primary Keys
- **Description:** All tables use UUID primary keys for distributed-system compatibility.
- **Priority:** MUST

### NFR-027: TimescaleDB Readiness
- **Description:** TimescaleDB extension available if time-series query performance requires it.
- **Priority:** SHOULD

## 5.5 Code Quality

### NFR-028: Test Coverage
- **Description:** All CRUD APIs must pass unit and integration tests with > 80% code coverage.
- **Priority:** MUST
- **Target:** > 80% coverage

### NFR-029: TypeScript Strict Mode
- **Description:** NestJS and Next.js projects must use TypeScript strict mode.
- **Priority:** MUST

---
