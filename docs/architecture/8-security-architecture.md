# 8. Security Architecture

## 8.1 Authentication: JWT with Refresh Tokens

| Token | Expiry | Storage | Purpose |
|-------|--------|---------|---------|
| Access Token | 1 hour | In-memory (React state) | API authentication |
| Refresh Token | 7 days | httpOnly secure cookie | Token renewal without re-login |

**Flow:**
1. Login: `POST /auth/login` returns both tokens
2. API calls: Access token in `Authorization: Bearer <token>` header
3. Refresh: When access token expires, `POST /auth/refresh` with refresh token cookie
4. Logout: Invalidate refresh token server-side + clear cookie

## 8.2 Authorization: RBAC

| Role | Access Level | PRD Personas |
|------|-------------|-------------|
| `admin` | Full access to all modules including configuration | IT/Systems Admin (Tiago) |
| `manager` | Full CRUD + forecast/MRP execution + approval | Purchasing Manager (Paulo), Production Planner (Priscila), Operations Director (Diego) |
| `operator` | CRUD operations on assigned modules + read dashboards | Inventory Analyst (Ivan) |
| `viewer` | Read-only access to dashboards and reports | Financial Controller (Fernanda) |

**Implementation:** NestJS `@Roles()` decorator + `RolesGuard` on every controller.

```typescript
@Controller('produtos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProdutosController {
  @Get()
  @Roles('admin', 'manager', 'operator', 'viewer')
  findAll() { ... }

  @Post()
  @Roles('admin', 'manager', 'operator')
  create() { ... }

  @Delete(':id')
  @Roles('admin')
  remove() { ... }
}
```

## 8.3 API Security

| Measure | Implementation | NFR Reference |
|---------|---------------|---------------|
| **Rate Limiting** | `@nestjs/throttler` -- 100 req/min per IP (general), 10 req/min (login) | -- |
| **CORS** | Whitelist frontend origin only | -- |
| **Helmet** | HTTP security headers (CSP, HSTS, X-Frame-Options) | -- |
| **Input Validation** | `class-validator` on all DTOs, `whitelist: true` | NFR-018 |
| **CNPJ Validation** | Custom validator with check digit algorithm | NFR-019 |
| **SQL Injection** | Prisma parameterized queries (built-in) | -- |
| **XSS** | React auto-escaping + Helmet CSP | -- |

## 8.4 Data Protection

| Layer | Mechanism |
|-------|-----------|
| **In Transit** | TLS 1.3 (HTTPS) for all communications |
| **At Rest** | PostgreSQL data directory encryption (AWS RDS default) |
| **Secrets** | Environment variables, never in source code (NFR-021) |
| **Passwords** | bcrypt hashing (12 rounds) |
| **ERP Connector** | Read-only access (NFR-020), credentials in env vars |

---
