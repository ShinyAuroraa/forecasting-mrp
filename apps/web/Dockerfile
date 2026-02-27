# ==========================================
# Next.js Web - Multi-Stage Dockerfile
# ==========================================
# Build context must be the monorepo root (.)
# Usage: docker build -f apps/web/Dockerfile .
# ==========================================

# --- Stage: base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# --- Stage: dev ---
FROM base AS dev
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

# --- Stage: build ---
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @forecasting-mrp/shared run build
RUN pnpm --filter @forecasting-mrp/web run build

# --- Stage: prod ---
FROM node:20-alpine AS prod
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./.next/static
COPY --from=build /app/apps/web/public ./public
USER appuser
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
