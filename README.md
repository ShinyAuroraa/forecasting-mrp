# ForecastingMRP

Industrial Forecasting + MRP/MRP II + BI System.

## Architecture

Turborepo monorepo with three applications and a shared package:

| Package | Technology | Port | Description |
|---------|-----------|------|-------------|
| `apps/web` | Next.js 14 (App Router) | 3000 | Frontend with Tailwind, Shadcn/UI, ECharts |
| `apps/api` | NestJS | 3001 | REST API with TypeORM, BullMQ |
| `apps/forecast-engine` | FastAPI (Python) | 8000 | ML forecasting with PyTorch, scikit-learn |
| `packages/shared` | TypeScript | - | Shared types and utilities |

## Infrastructure

- **Database:** PostgreSQL 16 with TimescaleDB
- **Cache/Queue:** Redis 7 with BullMQ
- **Monorepo:** Turborepo with pnpm workspaces
- **Containerization:** Docker Compose (dev), AWS EKS (prod)

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- Docker & Docker Compose
- Python >= 3.11

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/ShinyAuroraa/forecasting-mrp.git
cd forecasting-mrp

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your actual values

# 3. Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# 4. Install dependencies
pnpm install

# 5. Start development
pnpm dev
```

## Project Structure

```
forecasting-mrp/
├── apps/
│   ├── web/                 # Next.js 14 frontend
│   ├── api/                 # NestJS backend
│   └── forecast-engine/     # FastAPI ML service
├── packages/
│   └── shared/              # Shared TypeScript types
├── docker-compose.yml       # PostgreSQL + Redis
├── turbo.json               # Turborepo configuration
├── pnpm-workspace.yaml      # Workspace definition
└── package.json             # Root package
```

## License

UNLICENSED - Private repository.
