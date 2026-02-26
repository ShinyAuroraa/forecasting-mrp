# Coding Standards — ForecastingMRP

> Conventions and patterns for consistent implementation across all services.

## General Principles

- **Language:** Portuguese for UI strings, English for code (variables, functions, comments)
- **Absolute imports:** Use path aliases (`@/` for src) in all TypeScript projects
- **No invention:** Implement exactly what the PRD specifies (Article IV)
- **Story-driven:** All code changes must trace to a story in `docs/stories/`

## TypeScript (Frontend + Backend)

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case` | `product-service.ts` |
| Classes | `PascalCase` | `ProductService` |
| Interfaces | `PascalCase` (no I prefix) | `Product`, `CreateProductDto` |
| Functions | `camelCase` | `findProductById()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Enums | `PascalCase` members | `TipoProduto.ACABADO` |
| DB columns | `snake_case` (Prisma maps) | `created_at`, `tipo_produto` |

### Module Structure (NestJS)

```
modules/{domain}/
  |-- {domain}.module.ts        # Module definition
  |-- {domain}.controller.ts    # HTTP endpoints
  |-- {domain}.service.ts       # Business logic
  |-- {domain}.repository.ts    # Prisma queries
  |-- dto/
  |   |-- create-{domain}.dto.ts
  |   |-- update-{domain}.dto.ts
  |   |-- {domain}-query.dto.ts
  |-- entities/
  |   |-- {domain}.entity.ts    # Response type
  |-- {domain}.controller.spec.ts
  |-- {domain}.service.spec.ts
```

### API Response Format

```typescript
// Success (single)
{ data: T }

// Success (list)
{ data: T[], meta: { total, limit, hasNext, hasPrev, nextCursor, prevCursor } }

// Error
{ statusCode: number, error: string, message: string, details?: object, timestamp: string, path: string }
```

### Imports

```typescript
// 1. Node.js built-ins
import { readFile } from 'fs/promises';

// 2. Framework imports
import { Injectable } from '@nestjs/common';

// 3. Third-party packages
import { PrismaService } from '@prisma/client';

// 4. Internal (absolute)
import { ProductDto } from '@/modules/produtos/dto/product.dto';

// 5. Relative (same module only)
import { ProductRepository } from './product.repository';
```

## Python (FastAPI / Forecast Engine)

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `snake_case` | `tft_model.py` |
| Classes | `PascalCase` | `TFTTrainer` |
| Functions | `snake_case` | `train_model()` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_HORIZON` |
| Variables | `snake_case` | `forecast_result` |

### Project Structure

```
src/
  |-- api/          # FastAPI routes
  |-- models/       # ML model implementations
  |-- pipeline/     # Execution pipeline steps
  |-- features/     # Feature engineering
  |-- backtesting/  # Backtesting framework
  |-- workers/      # BullMQ job consumers
  |-- db/           # SQLAlchemy models and queries
  |-- config.py     # Configuration (Pydantic Settings)
  |-- main.py       # App bootstrap
```

### Type Hints

```python
# Always use type hints
def train_model(
    product_ids: list[str],
    horizon_weeks: int = 13,
    model_type: ModelType = ModelType.TFT,
) -> TrainingResult:
    ...
```

## Database Conventions

| Convention | Rule | Example |
|-----------|------|---------|
| Primary key | UUID, column name `id` | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| Timestamps | Always include `created_at`, `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| Foreign keys | `{table}_id` naming | `produto_id UUID REFERENCES produto(id)` |
| Enums | Use CHECK constraints | `CHECK (role IN ('admin', 'manager'))` |
| Soft delete | `ativo BOOLEAN DEFAULT true` | Filter by `WHERE ativo = true` |
| Indexes | Named `idx_{table}_{columns}` | `idx_produto_codigo` |

## Git Conventions

| Convention | Format |
|-----------|--------|
| Branch naming | `feat/{epic}-{story}-{short-desc}` |
| Commit messages | `feat: implement product CRUD [Story 1.1]` |
| Commit types | `feat`, `fix`, `refactor`, `test`, `docs`, `chore` |
| PR title | Same as commit message |

## Testing Standards

| Layer | Framework | Coverage Target |
|-------|-----------|----------------|
| Frontend unit | Vitest + Testing Library | 80% |
| Backend unit | Jest | 80% |
| Backend integration | Jest + Supertest | Key flows |
| Python unit | pytest | 80% |
| E2E | Playwright (Phase 5) | Critical paths |
