# 4. Backend Architecture (apps/api)

## 4.1 NestJS Module Structure

The backend follows **domain-driven modular architecture**, with one NestJS module per bounded context. Each module encapsulates its own controller, service, DTOs, and Prisma repository.

```
apps/api/src/
|-- modules/
|   |-- auth/                      # JWT authentication + RBAC
|   |   |-- auth.module.ts
|   |   |-- auth.controller.ts     # POST /auth/login, /auth/refresh, /auth/logout
|   |   |-- auth.service.ts        # JWT generation, password hashing
|   |   |-- guards/
|   |   |   |-- jwt-auth.guard.ts  # Global JWT validation
|   |   |   |-- roles.guard.ts     # @Roles() decorator enforcement
|   |   |-- decorators/
|   |   |   |-- roles.decorator.ts
|   |   |   |-- current-user.decorator.ts
|   |   |-- strategies/
|   |   |   |-- jwt.strategy.ts    # Passport JWT strategy
|   |   |   |-- jwt-refresh.strategy.ts
|   |   |-- dto/
|   |   |   |-- login.dto.ts
|   |   |   |-- register.dto.ts
|   |
|   |-- produtos/                  # Product management (FR-007, FR-008)
|   |   |-- produtos.module.ts
|   |   |-- produtos.controller.ts # CRUD: GET/POST/PATCH/DELETE /produtos
|   |   |-- produtos.service.ts    # Business logic + validation
|   |   |-- produtos.repository.ts # Prisma queries
|   |   |-- dto/
|   |   |   |-- create-produto.dto.ts
|   |   |   |-- update-produto.dto.ts
|   |   |   |-- filter-produto.dto.ts
|   |   |-- import/
|   |   |   |-- import-produtos.service.ts  # CSV/XLSX parsing + validation
|   |
|   |-- bom/                       # Bill of Materials (FR-009, FR-010, FR-069)
|   |   |-- bom.module.ts
|   |   |-- bom.controller.ts      # CRUD + tree + exploded cost
|   |   |-- bom.service.ts         # Tree explosion, cost roll-up
|   |   |-- bom.repository.ts
|   |   |-- dto/
|   |
|   |-- fornecedores/              # Supplier management (FR-011, FR-012)
|   |   |-- fornecedores.module.ts
|   |   |-- fornecedores.controller.ts
|   |   |-- fornecedores.service.ts
|   |   |-- fornecedores.repository.ts
|   |   |-- produto-fornecedor/    # N:N linkage sub-module
|   |   |   |-- produto-fornecedor.service.ts
|   |   |-- dto/
|   |
|   |-- capacidade/                # Production capacity (FR-013 to FR-016, FR-047, FR-048)
|   |   |-- capacidade.module.ts
|   |   |-- centros/               # Work centers
|   |   |   |-- centros.controller.ts
|   |   |   |-- centros.service.ts
|   |   |-- turnos/                # Shifts
|   |   |   |-- turnos.controller.ts
|   |   |   |-- turnos.service.ts
|   |   |-- paradas/               # Scheduled stops
|   |   |   |-- paradas.controller.ts
|   |   |   |-- paradas.service.ts
|   |   |-- eventos/               # Capacity events
|   |   |   |-- eventos.controller.ts
|   |   |   |-- eventos.service.ts
|   |   |-- roteiros/              # Production routings
|   |   |   |-- roteiros.controller.ts
|   |   |   |-- roteiros.service.ts
|   |   |-- calendario/            # Factory calendar
|   |   |   |-- calendario.controller.ts
|   |   |   |-- calendario.service.ts
|   |
|   |-- inventario/                # Inventory management (FR-017, FR-018)
|   |   |-- inventario.module.ts
|   |   |-- inventario.controller.ts
|   |   |-- inventario.service.ts
|   |   |-- depositos/             # Warehouse/depot sub-module
|   |   |   |-- depositos.controller.ts
|   |   |   |-- depositos.service.ts
|   |   |-- upload/                # Spreadsheet upload processing
|   |   |   |-- upload.service.ts
|   |
|   |-- ingestao/                  # Data ingestion (FR-019, FR-061)
|   |   |-- ingestao.module.ts
|   |   |-- ingestao.controller.ts # Upload endpoint
|   |   |-- ingestao.service.ts    # ETL pipeline orchestration
|   |   |-- parsers/               # CSV/XLSX/PDF parsers
|   |   |   |-- csv-parser.service.ts
|   |   |   |-- xlsx-parser.service.ts
|   |   |-- mapping/               # Column mapping engine
|   |   |   |-- mapping.service.ts
|   |   |   |-- templates.service.ts
|   |   |-- etl/                   # ETL pipeline steps
|   |   |   |-- validate.step.ts
|   |   |   |-- clean.step.ts
|   |   |   |-- grade.step.ts
|   |   |   |-- classify.step.ts   # ABC/XYZ/demand pattern (FR-020)
|   |
|   |-- forecast/                  # Forecast orchestration (FR-027 to FR-033)
|   |   |-- forecast.module.ts
|   |   |-- forecast.controller.ts # Trigger forecast, get results
|   |   |-- forecast.service.ts    # Job creation + result queries
|   |   |-- forecast.gateway.ts    # WebSocket gateway for progress
|   |   |-- jobs/
|   |   |   |-- forecast-job.producer.ts  # BullMQ job producer
|   |
|   |-- mrp/                       # MRP/MRP II engine (FR-034 to FR-049)
|   |   |-- mrp.module.ts
|   |   |-- mrp.controller.ts      # Trigger MRP, get results
|   |   |-- mrp.service.ts         # MRP orchestration
|   |   |-- engine/
|   |   |   |-- mps.service.ts     # Master Production Schedule (FR-034)
|   |   |   |-- stock-params.service.ts  # SS/ROP/EOQ/Min/Max (FR-035)
|   |   |   |-- bom-explosion.service.ts # Multi-level BOM explosion (FR-036)
|   |   |   |-- lot-sizing.service.ts    # L4L/EOQ/Silver-Meal/WW (FR-037)
|   |   |   |-- order-generation.service.ts # Planned orders (FR-038)
|   |   |   |-- action-messages.service.ts  # Action messages (FR-039)
|   |   |   |-- crp.service.ts     # Capacity Requirements Planning (FR-040)
|   |   |   |-- storage-validation.service.ts # Storage capacity (FR-041)
|   |   |   |-- net-requirement.service.ts   # Core MRP calculation (FR-049)
|   |
|   |-- automacao/                 # Automation (FR-050 to FR-053, FR-059)
|   |   |-- automacao.module.ts
|   |   |-- email-listener/        # Email monitoring (FR-050)
|   |   |   |-- email-listener.service.ts
|   |   |   |-- gmail.adapter.ts
|   |   |   |-- imap.adapter.ts
|   |   |-- erp-connector/         # ERP integration (FR-051)
|   |   |   |-- erp-connector.service.ts
|   |   |   |-- adapters/
|   |   |   |   |-- rest-api.adapter.ts
|   |   |   |   |-- direct-db.adapter.ts
|   |   |   |   |-- sftp.adapter.ts
|   |   |-- pipeline/              # Daily pipeline (FR-052)
|   |   |   |-- daily-pipeline.service.ts
|   |   |   |-- pipeline-scheduler.service.ts
|   |   |-- notifications/         # Email notifications (FR-053, FR-063)
|   |   |   |-- email-notification.service.ts
|   |   |   |-- morning-briefing.service.ts
|   |
|   |-- notificacao/               # Alert system (FR-062)
|   |   |-- notificacao.module.ts
|   |   |-- notificacao.controller.ts
|   |   |-- notificacao.service.ts
|   |   |-- notificacao.gateway.ts # WebSocket push for alerts
|   |
|   |-- common/                    # Shared infrastructure
|   |   |-- filters/
|   |   |   |-- http-exception.filter.ts    # Global exception filter
|   |   |   |-- prisma-exception.filter.ts  # Prisma error mapping
|   |   |-- interceptors/
|   |   |   |-- logging.interceptor.ts      # Request/response logging
|   |   |   |-- transform.interceptor.ts    # Response envelope
|   |   |   |-- timeout.interceptor.ts      # Request timeout
|   |   |-- decorators/
|   |   |   |-- pagination.decorator.ts     # @Paginate() decorator
|   |   |   |-- api-paginated.decorator.ts  # Swagger pagination
|   |   |-- dto/
|   |   |   |-- pagination.dto.ts           # { page, limit, cursor }
|   |   |   |-- paginated-response.dto.ts   # { data, meta, links }
|   |   |   |-- sort.dto.ts                 # { sortBy, sortOrder }
|   |   |-- pipes/
|   |   |   |-- uuid-validation.pipe.ts
|   |
|   |-- config/                    # Configuration module
|   |   |-- config.module.ts
|   |   |-- config.service.ts      # Typed env access
|   |   |-- config.schema.ts       # Joi validation schema
|
|-- prisma/
|   |-- prisma.module.ts           # Prisma service provider
|   |-- prisma.service.ts          # Connection lifecycle
|
|-- main.ts                        # Bootstrap: CORS, validation pipes, Swagger
|-- app.module.ts                  # Root module imports
```

## 4.2 Module Responsibilities

| Module | Domain | Key Endpoints | PRD References |
|--------|--------|---------------|---------------|
| `auth` | Authentication & Authorization | `POST /auth/login`, `/auth/refresh` | FR-006, NFR-016, NFR-017 |
| `produtos` | Product management | `CRUD /produtos`, `POST /produtos/import` | FR-007, FR-008 |
| `bom` | Bill of Materials | `CRUD /bom`, `GET /bom/:id/tree`, `GET /bom/:id/cost` | FR-009, FR-010, FR-069 |
| `fornecedores` | Supplier management | `CRUD /fornecedores`, `CRUD /produto-fornecedor` | FR-011, FR-012 |
| `capacidade` | Production capacity | `CRUD /centros`, `/turnos`, `/paradas`, `/eventos`, `/roteiros`, `/calendario` | FR-013 to FR-016, FR-047, FR-048 |
| `inventario` | Inventory & warehouses | `CRUD /inventario`, `/depositos`, `POST /inventario/upload` | FR-017, FR-018 |
| `ingestao` | Data ingestion | `POST /ingestao/upload`, `CRUD /ingestao/templates`, `POST /ingestao/etl` | FR-019, FR-020, FR-061 |
| `forecast` | Forecast orchestration | `POST /forecast/execute`, `GET /forecast/results`, WS `job:progress` | FR-027 to FR-033 |
| `mrp` | MRP/MRP II engine | `POST /mrp/execute`, `GET /mrp/orders`, `GET /mrp/capacity` | FR-034 to FR-049 |
| `automacao` | Daily automation | `CRUD /automacao/config`, `POST /automacao/trigger`, `GET /automacao/log` | FR-050 to FR-053, FR-059, FR-063 |
| `notificacao` | Alert & notification system | `GET /alerts`, WS `alert:new` | FR-062 |
| `common` | Cross-cutting concerns | N/A (interceptors, filters, DTOs) | NFR-018 |

## 4.3 Database Access Strategy (Prisma ORM)

**Why Prisma:**
- Type-safe database access (auto-generated TypeScript types from schema)
- Declarative schema definition with migration support
- Excellent PostgreSQL support including JSONB, enums, composite types
- Built-in connection pooling
- Query logging for debugging

**Prisma schema structure:**

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [timescaledb, pgcrypto]
}

model Produto {
  id                       String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  codigo                   String   @unique @db.VarChar(50)
  descricao                String   @db.VarChar(255)
  tipoProduto              TipoProduto @map("tipo_produto")
  // ... all fields from PRD Section 3.1.1
  createdAt                DateTime @default(now()) @map("created_at")
  updatedAt                DateTime @updatedAt @map("updated_at")

  @@map("produto")
}

// Enums mirroring PRD definitions
enum TipoProduto {
  ACABADO
  SEMI_ACABADO
  INSUMO
  EMBALAGEM
  MATERIA_PRIMA
  REVENDA
}
```

**Repository pattern:** Each module has a `*.repository.ts` that encapsulates Prisma queries, keeping the service layer free of ORM specifics.

## 4.4 Error Handling Patterns

**Three-layer error handling:**

1. **Global Exception Filter** (`HttpExceptionFilter`): Catches all unhandled exceptions and returns standardized JSON responses.
2. **Prisma Exception Filter** (`PrismaExceptionFilter`): Maps Prisma errors (P2002 unique constraint, P2025 not found, etc.) to HTTP status codes.
3. **Service-level exceptions**: Business logic throws domain-specific exceptions (e.g., `BomCircularReferenceException`, `InsufficientStockException`).

**Standard error response format:**

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Produto com codigo SKU-001 ja existe",
  "details": {
    "field": "codigo",
    "value": "SKU-001",
    "constraint": "produto_codigo_key"
  },
  "timestamp": "2026-02-25T10:30:00.000Z",
  "path": "/produtos"
}
```

## 4.5 API Versioning Strategy

**URI prefix versioning:** All routes are prefixed with `/api/v1/`. This allows future breaking changes to coexist under `/api/v2/` while maintaining backward compatibility.

```typescript
// main.ts
app.setGlobalPrefix('api/v1');
```

## 4.6 Request Validation

All incoming requests are validated using `class-validator` and `class-transformer` via NestJS `ValidationPipe` (global).

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // Strip unknown properties
  forbidNonWhitelisted: true, // Reject unknown properties
  transform: true,            // Auto-transform to DTO types
  transformOptions: {
    enableImplicitConversion: true,
  },
}));
```

---
