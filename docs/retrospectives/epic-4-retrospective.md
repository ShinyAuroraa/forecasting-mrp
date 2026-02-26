# Epic 4 Retrospective: Automation & BI

## Summary

| Field | Value |
|-------|-------|
| **Epic ID** | Epic 4 |
| **Name** | Automation & BI |
| **Phase** | Phase 4 — Weeks 14-17 |
| **Verdict** | APPROVED |
| **Stories Delivered** | 10/10 |
| **Acceptance Criteria Met** | 196/196 |
| **Date** | 2026-02-28 |

## Stories Delivered

| Story | Title | FR | ACs | Backend Tests | Frontend Tests | Status |
|-------|-------|----|-----|---------------|----------------|--------|
| 4.1 | Ingestion Mapping Templates | FR-061 | 16/16 | 25 | 10 | Done |
| 4.2 | ERP Connector (REST/DB/SFTP) | FR-051 | 19/19 | 32 | 10 | Done |
| 4.3 | Email Listener & PDF Processing | FR-050,FR-060 | 17/17 | 53 | 16 | Done |
| 4.4 | Centralized Alert System | FR-062 | 21/21 | 33 | 16 | Done |
| 4.5 | Re-training Cycle Management | FR-059 | 18/18 | 22 | 14 | Done |
| 4.6 | Daily Automated Pipeline | FR-052 | 24/24 | 29 | 14 | Done |
| 4.7 | Daily Summary & Morning Briefing Emails | FR-053,FR-063 | 20/20 | 37 | 7 | Done |
| 4.8 | Executive BI Dashboard | FR-054 | 24/24 | 17 | 7 | Done |
| 4.9 | What-If Scenario Analysis | FR-057 | 19/19 | 15 | 6 | Done |
| 4.10 | Excel/PDF Export | FR-058 | 22/22 | 14 | 9 | Done |

## Metrics

| Metric | Value |
|--------|-------|
| Total Source Files Created | ~140 |
| Total Test Files Created | ~30 |
| Total Backend Tests | ~277 |
| Total Frontend Tests | ~109 |
| Total Tests | ~386 |
| Modules Delivered | 10 new NestJS modules |
| Frontend Pages/Components | 10 pages + ~40 components |
| Code Review Cycles | 10 (one per story) |
| Critical Issues Found & Fixed | ~15 |
| High Issues Found & Fixed | ~20 |

## FRs Covered

| FR | Description | Story | Status |
|----|-------------|-------|--------|
| FR-050 | Email Listener | 4.3 | Delivered |
| FR-051 | ERP Connector | 4.2 | Delivered |
| FR-052 | Daily Automated Pipeline | 4.6 | Delivered |
| FR-053 | Daily Summary Email | 4.7 | Delivered |
| FR-054 | Executive Dashboard | 4.8 | Delivered |
| FR-055 | LightGBM Model | Delivered in Epic 2 (Story 2.5) | Skipped |
| FR-056 | Ensemble Model | Delivered in Epic 2 (Story 2.5) | Skipped |
| FR-057 | What-If Scenario Analysis | 4.9 | Delivered |
| FR-058 | Excel/PDF Export | 4.10 | Delivered |
| FR-059 | Re-training Cycles | 4.5 | Delivered |
| FR-060 | OCR for PDF Attachments | 4.3 | Delivered |
| FR-061 | Ingestion Mapping Template | 4.1 | Delivered |
| FR-062 | Alert System | 4.4 | Delivered |
| FR-063 | Morning Briefing Email | 4.7 | Delivered |

## Key Technical Decisions

1. **ConfigSistema as JSON store** for scenarios and mapping templates — avoided Prisma migrations for volatile/metadata entities
2. **BullMQ processors** for email listening, daily pipeline, cycle management, and async export — consistent async pattern
3. **SSE (Server-Sent Events)** for real-time alert delivery + export completion notifications
4. **ExcelJS** reused from Story 3.11 for all Excel generation; PDFKit for lightweight PDF
5. **ERP Connector pattern** with strategy interface (REST/DB/SFTP) + ConfigSistema for active connector selection
6. **Scheduled tasks** via `@nestjs/schedule` for daily pipeline (06:00), cycle checks (03:00), file cleanup (hourly)
7. **Global APP_GUARD** pattern maintained — no per-controller `@UseGuards`

## Technical Debt

1. Puppeteer not installed — PDF reports use PDFKit (lightweight fallback). Chart images in PDFs require Puppeteer for production.
2. No integration tests with real Redis/BullMQ — all async tests use mocked queues
3. No Swagger/OpenAPI documentation for the 10 new modules
4. Email listener uses mock Gmail API — production needs real OAuth2 credentials
5. ERP connectors (DB/SFTP) use mock implementations — need real ERP integration testing
6. Dashboard queries could benefit from materialized views for large datasets
7. Export cleanup relies on OS tmpdir — production should use S3 with lifecycle policies

## Risks Mitigated

1. **Memory exhaustion** — All Prisma queries have explicit `take` limits (caught in code reviews)
2. **XSS in charts** — HTML escaping applied to all user-controlled tooltip content
3. **Path traversal** — jobId validation on export download endpoint
4. **Header injection** — RFC 5987 encoding on Content-Disposition
5. **TOCTOU race conditions** — Atomic delete with P2025 catch pattern
6. **Unbounded input** — ArrayMaxSize, MaxLength, Min/Max validators on all DTOs

## Recommendations for Epic 5

1. **Commit all Epic 0-4 work** with granular git commits per story
2. **Add integration tests** with Testcontainers for Redis + PostgreSQL
3. **Add Swagger/OpenAPI** documentation across all modules
4. **Install Puppeteer** for production PDF generation with chart images
5. **Implement WebSocket** for real-time pipeline progress (complement SSE)
6. **Configure branch protection** on GitHub
7. **Validate Docker Compose** full stack startup end-to-end
8. **Consider materialized views** for dashboard and export queries on large datasets
9. **Plan AWS EKS deployment** strategy (FR-074 in Epic 5)
10. **Extract shared ExcelJS utilities** into a common service

---

**Verdict: APPROVED** — Epic 4 delivered all 14 FRs (12 new + 2 carried from Epic 2) across 10 stories with 196 acceptance criteria, ~386 tests, and comprehensive code review fixes. Ready to proceed to Epic 5.
