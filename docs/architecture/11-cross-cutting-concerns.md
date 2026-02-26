# 11. Cross-Cutting Concerns

## 11.1 Error Handling Strategy

| Layer | Strategy | Implementation |
|-------|----------|---------------|
| **Frontend** | React Error Boundaries per route + React Query error states | `error.tsx` per route group, toast notifications for mutations |
| **API** | Global exception filter + Prisma exception filter + domain exceptions | NestJS `@Catch()` filters, standardized JSON error response |
| **FastAPI** | FastAPI exception handlers + custom ML exceptions | `@app.exception_handler`, structured error responses |
| **Queue Jobs** | BullMQ retry (3 attempts, exponential backoff) + dead letter queue | Job failure -> retry -> dead letter -> admin alert |

## 11.2 Pagination Pattern

**Cursor-based pagination** for large datasets (NFR-022: 500-5,000 SKUs):

```typescript
// Request
GET /api/v1/produtos?cursor=uuid-of-last-item&limit=50&sortBy=codigo&sortOrder=asc

// Response
{
  "data": [...],
  "meta": {
    "total": 1234,
    "limit": 50,
    "hasNext": true,
    "hasPrev": true,
    "nextCursor": "uuid-next",
    "prevCursor": "uuid-prev"
  }
}
```

**Offset-based pagination** available for simpler use cases (admin screens with smaller datasets).

## 11.3 Caching Strategy

| Layer | Tool | Cache Key Pattern | TTL | Invalidation |
|-------|------|-------------------|-----|-------------|
| **API response** | Redis | `{module}:{entity}:{id}` | 5 min | On mutation (cache-aside) |
| **BOM explosion** | Redis | `bom:explosion:{productId}` | 10 min | On BOM change |
| **Stock parameters** | Redis | `stock:params:{productId}` | 5 min | On forecast/MRP execution |
| **Configuration** | Redis | `config:{key}` | 30 min | On config change |
| **Browser** | React Query | Per-query key | 5 min staleTime | On mutation, on window focus |
| **Static assets** | CDN | Hash-based | 1 year | On deploy |

## 11.4 Internationalization Approach (CON-009)

**Primary language:** Portuguese (pt-BR). Internationalization infrastructure deferred to post-Phase 5.

**Current approach:**
- All UI strings in Portuguese directly in components
- Date format: `dd/MM/yyyy` (Brazilian standard)
- Number format: `.` thousands, `,` decimal (1.234,56)
- Currency: `R$ 1.234,56`
- `<html lang="pt-BR">` declared in root layout

**Future-proofing:** String literals concentrated in component files (not scattered). When i18n is needed, extract to message catalogs using `next-intl` or `react-i18next`.

---
