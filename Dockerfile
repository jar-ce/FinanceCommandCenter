# ==============================================================================
# FINANCE COMMAND CENTER (APEX OS) — PRODUCTION API DOCKERFILE
# Multi-stage production container image build for Fastify API service
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilation Environment
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root & workspace package manifests
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install full workspace dependencies for compilation
RUN npm ci

# Copy full source tree
COPY . .

# Compile TypeScript packages and application bundles
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Execution Environment
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Security: Create non-root unprivileged execution user/group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fastify -u 1001 -G nodejs

# Copy root & workspace manifests for production-only dependency resolution
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/

# Install production-only dependencies
RUN npm ci --omit=dev

# Copy compiled build artifacts from builder stage
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/db/migrations ./apps/api/dist/db/migrations

# Set file permissions for unprivileged user
RUN chown -R fastify:nodejs /app

USER fastify

EXPOSE 4000

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Production startup command
CMD ["node", "apps/api/dist/server.js"]
