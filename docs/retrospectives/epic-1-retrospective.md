# Epic 1 Retrospective — Foundation: Data Layer & CRUDs

**Epic:** 1 — Foundation: Data Layer & CRUDs
**Phase:** Phase 1 — Development Cycle
**PO:** Pax (@po)
**Date:** 2026-02-26
**Status:** Complete

---

## 1. Epic Summary

Epic 1 delivered the complete backend data layer for ForecastingMRP, implementing 11 stories covering authentication, master data CRUDs, BOM management, capacity planning, inventory management, data ingestion, and SKU classification. All modules follow a consistent repository pattern with RBAC, pagination, and comprehensive test coverage.

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Stories planned | 11 | 11 | OK |
| Stories completed | 11 | 11 | OK |
| Acceptance criteria | 120 | 120 met | OK |
| Tasks/subtasks | 248 | 248 completed | OK |
| Source files created | — | 95 | — |
| Test files created | — | 36 | — |
| Total tests passing | — | 301 (43 suites) | — |
| API modules delivered | — | 9 | — |
| TypeScript errors | 0 | 0 | OK |

---

## 2. Stories Delivered

### Story 1.1: NestJS Common Infrastructure & Prisma Service
- **Executor:** @dev (Dex)
- **AC:** 12/12
- **Highlights:** PrismaModule (global), PaginationDto, buildPaginatedResponse helper, RBAC guards (RolesGuard + @Roles decorator), role hierarchy (admin > manager > operator > viewer), HealthModule with DB check
- **Deviations:** None

### Story 1.2: Authentication & Authorization (JWT + RBAC)
- **Executor:** @dev (Dex)
- **AC:** 16/16
- **Highlights:** JWT access + refresh tokens, bcrypt password hashing, AuthGuard global, login/register/refresh/me endpoints, role-based access control enforced on all routes
- **Deviations:** None

### Story 1.3: Product CRUD & Search
- **Executor:** @dev (Dex)
- **AC:** 13/13
- **Highlights:** Full CRUD for Produto, GIN trigram search on codigo/descricao, soft delete (ativo flag), category/type filters, paginated responses
- **Deviations:** None

### Story 1.4: Product Mass Import (CSV/XLSX)
- **Executor:** @dev (Dex)
- **AC:** 10/10
- **Highlights:** ExcelJS-based CSV/XLSX parsing, auto-delimiter detection (comma/semicolon), column mapping (flexible headers), validation with per-row error reporting, ImportResult with imported/updated/rejected counts
- **Deviations:** None

### Story 1.5: Supplier CRUD & SKU-Supplier Linkage
- **Executor:** @dev (Dex)
- **AC:** 14/14
- **Highlights:** Fornecedor CRUD, FornecedorProduto linkage (lead time, cost, MOQ), unique constraint (fornecedorId + produtoId), cascade relations
- **Deviations:** None

### Story 1.6: BOM CRUD, Tree & Exploded Cost
- **Executor:** @dev (Dex)
- **AC:** 12/12
- **Highlights:** BOM tree structure (parent-child), recursive tree traversal, exploded cost calculation, circular dependency detection, multi-level BOM support
- **Deviations:** None

### Story 1.7: Work Center & Shift Management
- **Executor:** @dev (Dex)
- **AC:** 13/13
- **Highlights:** CentroTrabalho CRUD with efficiency/utilization metrics, Turno CRUD with start/end time and capacity hours, nested resource management
- **Deviations:** None

### Story 1.8: Scheduled Stops & Capacity Events
- **Executor:** @dev (Dex)
- **AC:** 11/11
- **Highlights:** ParadaProgramada for scheduled maintenance, EventoCapacidade for capacity adjustments, date range filtering, work center association
- **Deviations:** None

### Story 1.9: Warehouse & Inventory Management
- **Executor:** @dev (Dex)
- **AC:** 12/12
- **Highlights:** Deposito CRUD (warehouse types, capacity, temperature range), InventarioAtual with computed fields (quantidadeTotal, valorTotalEstoque), ConflictException for unique constraints (produtoId + depositoId + lote)
- **Deviations:** Import path initially used `generated/prisma` instead of `generated/prisma/client` — fixed immediately after typecheck

### Story 1.10: Data Ingestion Pipeline
- **Executor:** @dev (Dex)
- **AC:** 11/11
- **Highlights:** SerieTemporal CRUD, CSV/XLSX upload for time-series data, upsert logic (findFirst + update/create), SKU validation against produto table (case-insensitive), DD/MM/YYYY date support, auto-delimiter detection
- **Deviations:** Scoped to basic ingestion (CRUD + upload) — full ETL pipeline deferred to Epic 2

### Story 1.11: Automatic SKU Classification (ABC/XYZ)
- **Executor:** @dev (Dex)
- **AC:** 10/10
- **Highlights:** ABC classification (Pareto cumulative revenue: A<=80%, B<=95%, C>95%), XYZ classification (CV thresholds: X<=0.5, Y<=1.0, Z>1.0), demand pattern detection (zero-week %: REGULAR<=5%, INTERMITENTE<=25%, ERRATICO<=50%, LUMPY>50%), model suggestion matrix (12 combinations), batch recalculation endpoint
- **Deviations:** None

---

## 3. What Went Well

1. **100% AC coverage** — All 120 acceptance criteria met across 11 stories with zero partial implementations
2. **Consistent architecture** — Every module follows the same pattern: Controller → Service → Repository → PrismaService, making the codebase predictable and maintainable
3. **Strong test coverage** — 301 tests across 43 suites, covering unit tests for services, controllers, and algorithm-specific logic (ABC/XYZ/demand classification)
4. **Pattern reuse** — Common infrastructure (PaginationDto, buildPaginatedResponse, RolesGuard) established in Story 1.1 was consistently reused across all subsequent stories
5. **Clean builds throughout** — Zero TypeScript errors maintained across all 11 stories with continuous typecheck validation
6. **Appropriate scoping** — Stories 1.10 and 1.11 were correctly scoped to Epic 1's "Foundation" focus, deferring full ETL and ML pipelines to later epics
7. **Algorithm correctness** — Classification algorithms (ABC Pareto, XYZ coefficient of variation, demand pattern detection) validated with comprehensive test cases covering edge cases (empty data, zero revenue, constant values)

---

## 4. What Could Be Improved

1. **Import path consistency** — Story 1.9 initially used incorrect Prisma import path (`generated/prisma` vs `generated/prisma/client`). This pattern was already established in Story 1.1 but was missed during implementation. A shared import barrel or path alias would prevent this
2. **No integration tests** — All tests are unit tests with mocked dependencies. Integration tests against a real database (using Testcontainers or Docker PostgreSQL) would validate Prisma queries and constraint enforcement
3. **No frontend work** — Epic 1 delivered backend-only. Frontend screens for these CRUDs are deferred, which means no user-facing validation of the API contracts
4. **Git commits not created** — All 11 stories were implemented in a single session without intermediate git commits. Story-level commits would provide better traceability and rollback capability
5. **CSV/XLSX import duplication** — Stories 1.4 (product import) and 1.10 (time-series import) both implement CSV/XLSX parsing with similar logic. A shared upload utility could reduce duplication
6. **No API documentation** — No Swagger/OpenAPI documentation generated for the 40+ endpoints created across 9 modules

---

## 5. Technical Debt Introduced

| Item | Severity | Story | Remediation |
|------|----------|-------|-------------|
| No integration tests | MEDIUM | All | Add Testcontainers or Docker-based integration tests in Epic 2 |
| Duplicate CSV/XLSX parsing logic | LOW | 1.4, 1.10 | Extract shared upload utility in future refactor |
| No Swagger/OpenAPI docs | LOW | All | Add @nestjs/swagger decorators when frontend integration begins |
| Shadcn/UI still not initialized | LOW | (Epic 0) | Initialize when first frontend story starts |
| No WebSocket infrastructure | INFO | — | Required for Epic 2 real-time features; plan during Epic 2 planning |
| Classification runs synchronously | LOW | 1.11 | Move to BullMQ job queue for large datasets in Epic 2 |

---

## 6. Risks Mitigated

| Risk | Mitigation | Status |
|------|-----------|--------|
| Prisma 7 import paths | Established `generated/prisma/client` pattern in Story 1.1 | RESOLVED |
| Role hierarchy enforcement | Numeric hierarchy (admin=4 > viewer=1) with @Roles decorator | RESOLVED |
| BOM circular dependencies | Recursive tree traversal with cycle detection | RESOLVED |
| Inventory double-counting | Computed fields (quantidadeTotal) calculated in service layer | RESOLVED |
| Time-series data duplication | Upsert logic with compound unique key (produtoId + data + granularidade) | RESOLVED |
| Classification accuracy | Algorithm tests with known inputs/outputs validating thresholds | RESOLVED |

---

## 7. Metrics

### Build Health
- `npx tsc --noEmit`: PASS (0 errors)
- `npx jest`: 301 tests, 43 suites — all PASS
- Test failures: 0

### API Coverage

| Module | Endpoints | Tests | Controller | Service |
|--------|-----------|-------|------------|---------|
| Auth | 4 (login, register, refresh, me) | 20 | Yes | Yes |
| Produtos | 6 (CRUD + search + import) | 24 | Yes | Yes |
| Fornecedores | 8 (CRUD + linkage) | 26 | Yes | Yes |
| BOM | 5 (CRUD + tree + cost) | 22 | Yes | Yes |
| Centros de Trabalho | 10 (CRUDs + shifts + stops + events) | 38 | Yes | Yes |
| Inventario | 7 (depósitos + inventário atual) | 26 | Yes | Yes |
| Ingestao | 5 (CRUD + upload) | 21 | Yes | Yes |
| Classificacao | 4 (list, detail, update, recalculate) | 27 | Yes | Yes |
| Health | 1 (healthcheck) | — | Yes | — |

### Module Structure
- Total modules: 9 (auth, produtos, fornecedores, bom, centros-trabalho, inventario, ingestao, classificacao, health)
- Source files: 95 (.ts)
- Test files: 36 (.spec.ts)
- Total: 131 files in `apps/api/src/modules/`

---

## 8. Architecture Patterns Established

| Pattern | Description | Used In |
|---------|-------------|---------|
| Repository Pattern | Data access abstracted behind repository classes | All modules |
| Pagination | PaginationDto + buildPaginatedResponse | All list endpoints |
| RBAC | @Roles decorator + RolesGuard with numeric hierarchy | All controllers |
| Soft Delete | `ativo: false` instead of physical deletion | Produtos, Fornecedores, Depositos, Centros |
| Computed Fields | Service-layer calculated values (not DB columns) | InventarioAtual |
| Upsert | findFirst + conditional update/create | Ingestao, Classificacao |
| CSV/XLSX Import | ExcelJS parsing with validation and error reporting | Produtos, Ingestao |
| Algorithm Services | Business logic methods exposed as public for testability | Classificacao |

---

## 9. Recommendations for Epic 2

1. **Commit Epic 1 work** — Create story-level git commits for all 11 stories before starting Epic 2
2. **Add integration tests** — Introduce Testcontainers for Prisma query validation against real PostgreSQL
3. **Extract shared upload utility** — Consolidate CSV/XLSX parsing from Stories 1.4 and 1.10 into a common service
4. **Add Swagger/OpenAPI** — Install @nestjs/swagger and add decorators to all controllers for API documentation
5. **Plan BullMQ integration** — Classification recalculation and future forecast jobs should use BullMQ for async processing
6. **Initialize WebSocket gateway** — Epic 2 forecast engine will need real-time progress updates
7. **Initialize Shadcn/UI** — First frontend story in any epic should initialize the component library
8. **Verify Docker Compose** — Run full stack (`docker compose up`) to validate all services before Epic 2 implementation

---

## 10. Epic Sign-Off

| Role | Agent | Verdict |
|------|-------|---------|
| PO | Pax (@po) | APPROVED — All FR-006 through FR-020 delivered |
| Dev Lead | Dex (@dev) | All 11 stories implemented, 301 tests passing, build clean |
| Architect | Aria (@architect) | Consistent patterns established, architecture sound |

**Epic 1 Status: COMPLETE**

— Pax, validando a entrega do Epic 1 🎯
