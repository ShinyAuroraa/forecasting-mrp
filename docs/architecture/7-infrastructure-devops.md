# 7. Infrastructure & DevOps

## 7.1 Docker Compose Services (Dev Environment)

The `docker-compose.yml` defines all services needed for local development:

```yaml
# Extended from existing docker-compose.yml
version: "3.9"

services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports: ["${POSTGRES_PORT:-5432}:5432"]
    environment:
      POSTGRES_DB: forecasting_mrp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck: ...
    networks: [forecasting-mrp-network]

  redis:
    image: redis:7-alpine
    ports: ["${REDIS_PORT:-6379}:6379"]
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes: [redis_data:/data]
    healthcheck: ...
    networks: [forecasting-mrp-network]

  api:
    build: ./apps/api
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/forecasting_mrp
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      FORECAST_ENGINE_URL: http://forecast-engine:8000
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [forecasting-mrp-network]

  web:
    build: ./apps/web
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
      NEXT_PUBLIC_WS_URL: http://localhost:3001
    depends_on: [api]
    networks: [forecasting-mrp-network]

  forecast-engine:
    build: ./apps/forecast-engine
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/forecasting_mrp
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [forecasting-mrp-network]
    # GPU support (if available):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

volumes:
  postgres_data:
  redis_data:

networks:
  forecasting-mrp-network:
    driver: bridge
```

## 7.2 CI/CD Pipeline (GitHub Actions)

### PR Pipeline (ci.yml)

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
        env: { POSTGRES_DB: test_db, POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build

  python-ci:
    runs-on: ubuntu-latest
    defaults:
      run: { working-directory: apps/forecast-engine }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check src/
      - run: mypy src/
      - run: pytest tests/ -v --cov=src --cov-report=xml
```

## 7.3 Environment Management

| File | Purpose | Git Status |
|------|---------|------------|
| `.env.example` | Template with all variable names and defaults | Committed |
| `.env` | Local dev environment | Gitignored |
| `.env.test` | Test environment | Gitignored |

**Required environment variables:**

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/forecasting_mrp
POSTGRES_PASSWORD=changeme

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-256-bit-secret
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# FastAPI
FORECAST_ENGINE_URL=http://localhost:8000

# Email (Phase 4)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

## 7.4 Logging Strategy

**Format:** Structured JSON logs across all services for consistent parsing.

```json
{
  "timestamp": "2026-02-25T06:01:23.456Z",
  "level": "info",
  "service": "api",
  "module": "forecast",
  "message": "Forecast execution started",
  "context": {
    "executionId": "uuid",
    "trigger": "AGENDADO",
    "skuCount": 1234
  },
  "requestId": "req-uuid",
  "userId": "user-uuid"
}
```

**Libraries:**
- NestJS: `@nestjs/common` Logger with Winston or Pino transport
- FastAPI: Python `structlog` with JSON renderer
- Next.js: Server-side structured logging via custom logger

## 7.5 Monitoring Approach

| Layer | Tool | Metrics |
|-------|------|---------|
| **Application** | Health check endpoints (`/health`) | Service status, DB connectivity, Redis connectivity |
| **API** | NestJS interceptor metrics | Request count, latency (p50/p95/p99), error rate |
| **ML Pipeline** | Pipeline step logging | Step duration, records processed, model accuracy |
| **Database** | pg_stat_statements | Slow queries, connection count |
| **Infrastructure** | Docker Compose health checks (dev) | Container status |
| **Production** | CloudWatch + Prometheus/Grafana | CPU, memory, pod count, scaling events |

## 7.6 AWS EKS Production Architecture (Phase 5)

```mermaid
graph TB
    subgraph "AWS VPC"
        subgraph "Public Subnet"
            ALB["Application Load Balancer"]
        end

        subgraph "Private Subnet - EKS Cluster"
            subgraph "Node Group: General (m5.xlarge)"
                WEB["web (Next.js)<br/>2-4 replicas"]
                API["api (NestJS)<br/>2-4 replicas"]
                FE_INFER["forecast-engine<br/>(CPU inference)<br/>1-2 replicas"]
            end

            subgraph "Node Group: GPU Spot (g4dn.xlarge)"
                FE_TRAIN["forecast-trainer<br/>(GPU training)<br/>0-1 replicas<br/>Spot Instance"]
            end
        end

        subgraph "Managed Services"
            RDS["RDS PostgreSQL 16<br/>db.r6g.xlarge<br/>Multi-AZ"]
            ELASTICACHE["ElastiCache Redis<br/>cache.m6g.large<br/>Cluster mode"]
            S3["S3<br/>Model artifacts<br/>File uploads"]
            SES["SES<br/>Email notifications"]
        end
    end

    ALB --> WEB
    ALB --> API
    API --> FE_INFER
    API --> FE_TRAIN
    API --> RDS
    API --> ELASTICACHE
    FE_INFER --> RDS
    FE_TRAIN --> RDS
    FE_TRAIN --> S3
    API --> S3
    API --> SES
```

**Auto-scaling policies:**

| Service | Min | Max | Metric | Target |
|---------|-----|-----|--------|--------|
| web | 2 | 4 | CPU utilization | 70% |
| api | 2 | 4 | Request rate | 1000 req/min |
| forecast-engine (inference) | 1 | 2 | Queue depth | < 10 |
| forecast-trainer (GPU) | 0 | 1 | Job pending | > 0 (scale from zero) |

**GPU Spot Instance strategy:** The training workload (`forecast-trainer`) runs on g4dn.xlarge Spot Instances (70-90% discount vs. On-Demand). The BullMQ job consumer handles Spot interruptions gracefully via checkpointing -- if a Spot Instance is reclaimed, the job is re-queued and resumes from the last checkpoint.

---
