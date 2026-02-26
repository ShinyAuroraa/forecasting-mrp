# ==========================================
# NestJS API - Multi-Stage Dockerfile
# ==========================================
# Build context must be the monorepo root (.)
# Usage: docker build -f apps/api/Dockerfile .
# ==========================================

# --- Stage: base ---
FROM node:18-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# --- Stage: dev ---
FROM base AS dev
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["pnpm", "dev"]

# --- Stage: build ---
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @forecasting-mrp/shared run build
RUN pnpm --filter @forecasting-mrp/api run build

# --- Stage: prod ---
FROM node:18-alpine AS prod
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/node_modules ./node_modules
USER appuser
EXPOSE 3001
CMD ["node", "dist/main"]
