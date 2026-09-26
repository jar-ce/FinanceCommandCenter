# Phase 20 — Production Preparation Plan (APEX OS)

## Executive Summary

This document defines the authoritative **Phase 20 Production Preparation Plan** for **Finance Command Center — APEX OS**. 
The purpose of Phase 20 is to establish an evidence-based roadmap for transitioning APEX OS from its verified single-machine development and testing environment into a secure, robust, and scalable production deployment.

This plan performs a comprehensive audit across 25 production-readiness categories, establishing environment specifications, database production driver transitions, secret management controls, migration safety procedures, backup/disaster recovery protocols, operational runbooks, and file-by-file implementation requirements.

> [!IMPORTANT]
> **Planning Stage Only**: Phase 20 is currently authorized for **PLANNING ONLY**. No application source code, database migrations, package dependencies, infrastructure resources, or production secrets are modified or provisioned during this planning pass.

---

## 1. Current Verified Repository State

The current baseline state of the repository has been empirically verified prior to generating this plan:

* **Repository**: `https://github.com/jar-ce/FinanceCommandCenter.git`
* **Branch**: `main`
* **Commit Hash**: `18eeacfc3d67ffe5ada2931159d07ade60ac6b9d`
* **Working Tree**: Clean
* **Vitest Test Baseline**: 36 test files / 291 tests (291 passed, 0 failed, 0 skipped)
  * **API Suite**: 21 test files / 231 passed tests
  * **Web Suite**: 15 test files / 60 passed tests
* **TypeScript Type-Check**: `PASSED` (`tsc -b packages/shared-types && tsc --noEmit -p apps/api/tsconfig.json && tsc --noEmit -p apps/web/tsconfig.json`)
* **Production Build**: `PASSED` (`tsc -b` and `vite build`)
* **Frontend Bundle State**:
  * Largest Chunk: `259.98 kB` (`vendor-Cu83t4jb.js`)
  * Total JS Size: `578.11 kB`
  * Total Gzip Size: `152.26 kB`
  * Rollup `>500 kB` Warning: `ELIMINATED` (0 warnings)
* **Database State**: 0 pending migrations, 0 schema changes in Phase 20 planning.

---

## 2. Production Architecture Assumptions

To maintain strict alignment with existing repository code, Phase 20 makes **zero ungrounded assumptions** regarding cloud vendors, proprietary hosting providers, or unneeded third-party SaaS services:

1. **Target Monorepo Workspaces**:
   * `@finance-command-center/api`: Fastify 4.x TypeScript REST API backend.
   * `@finance-command-center/web`: React 19 + Vite 5 single-page frontend application.
   * `@finance-command-center/shared-types`: Shared DTOs, domain interfaces, and schema type definitions.
2. **Database Architecture**:
   * **Development/Testing Engine**: `@electric-sql/pglite` (WebAssembly C-Postgres engine running locally in node).
   * **Production Engine**: Standard standalone **PostgreSQL 16+** relational database server with connection pooling (`pg.Pool` / `node-postgres` driver) via `DATABASE_URL`.
3. **HTTP Server & Security Boundary**:
   * Node.js 20+ runtime executing Fastify backend on port `4000` (or `PORT` environment variable).
   * Static assets served via reverse proxy / NGINX / CDN with fallback to single-page application `index.html`.
   * TLS termination handled at the ingress gateway / reverse proxy level.

---

## 3. Environment Configuration

### 3.1 Production Environment Checklist

All production environment settings are managed via OS-level environment variables or secret store injection.

| Variable Name | Type | Classification | Required in Production | Default Value | Description / Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | Config | **YES** | `production` | Must be set to `production`. Triggers fast-fail security checks. |
| `PORT` | Number | Config | **YES** | `4000` | Port for Fastify HTTP server binding. |
| `HOST` | String | Config | **YES** | `0.0.0.0` | IP binding address (`0.0.0.0` for container/proxy ingress). |
| `DATABASE_URL` | String | **Secret** | **YES** | *None* | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`). |
| `DATABASE_POOL_SIZE`| Number | Config | NO | `10` | Maximum database connection pool size per instance. |
| `DATABASE_SSL` | Boolean | Config | **YES** | `true` | Enforces TLS connection to PostgreSQL in production. |
| `JWT_SECRET` | String | **Secret** | **YES** | *None* | HMAC signing key (min 32 chars). Default dev keys throw `FATAL` error. |
| `JWT_EXPIRES_IN` | String | Config | NO | `15m` | Access token lifespan. |
| `REFRESH_TOKEN_EXPIRES_IN` | String | Config | NO | `7d` | Refresh token lifespan. |
| `CORS_ORIGIN` | String | Config | **YES** | *None* | Allowed production origin (e.g. `https://finance.domain.com`). |
| `LOG_LEVEL` | String | Config | NO | `info` | Structured log level (`info`, `warn`, `error`). |
| `NSE_API_BASE_URL` | String | Config | NO | `https://www.nseindia.com/api` | Base URL for live market quote integration. |
| `YAHOO_FINANCE_API_URL` | String | Config | NO | `https://query1.finance.yahoo.com` | Fallback market data provider URL. |

---

## 4. Secret Management

### 4.1 Secret Externalization & Storage
* Production secrets (`DATABASE_URL`, `JWT_SECRET`) must **NEVER** be committed to version control or saved in raw `.env` files in repository directories.
* `.gitignore` explicitly blocks `.env`, `.env.local`, `.env.production.local`, preventing accidental secret commits.
* Production secrets must be injected at container startup or process launch from an encrypted secret store (e.g. HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, or Kubernetes Secrets).

### 4.2 Startup Secret Validation & Fast-Fail
* As defined in `apps/api/src/config/env.ts`, when `NODE_ENV === 'production'`, the server verifies `JWT_SECRET` against `DEFAULT_DEV_SECRETS`:
  * If `JWT_SECRET` matches development fallback keys (`dev-jwt-secret-min-16-characters-long` or `super-secret-jwt-key-change-in-production`), startup immediately aborts with:
    `FATAL: Default development JWT_SECRET is rejected in production. Provide an explicit secret.`

---

## 5. Authentication & Authorization

### 5.1 Security Controls Preservation (SEC-01 through SEC-07)
Production deployment strictly preserves all security rules established in Phase 17:

1. **SEC-01 (HMAC Trust Model & Canonical Identity)**:
   * Identity is derived exclusively from server-side HMAC principal resolution (`resolveAuthenticatedPrincipal`).
   * Caller parameters (`x-user-id` header or body parameters) cannot override the verified `userId`.
2. **SEC-02 (Security Response Headers)**:
   * Mandatory headers enforced on all HTTP responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'self'`.
3. **SEC-03 (Environment Guardrail)**: Fast-fail startup when production environment lacks explicit production secrets.
4. **SEC-04 (Market Master Write Authorization)**: Market instrument creation/updates restricted strictly to Admin/System roles.
5. **SEC-05 (Client-Side Identity Safety)**: Frontend state stores state without client-side privilege escalation options.
6. **SEC-06 (CORS Origin Enforcer)**: Origins validated strictly against configured `CORS_ORIGIN`. Unrecognized origins rejected with `403 CORS_NOT_ALLOWED`.
7. **SEC-07 (IPO Sync Administrative Lock)**: Master IPO synchronization routes guarded by system authorization.

---

## 6. Database Production Strategy

### 6.1 PGlite vs Standalone PostgreSQL Driver Transition
* **Development/Testing**: `@electric-sql/pglite` executes in-memory PostgreSQL WebAssembly compiled C code.
* **Production**: Requires connecting to a standalone PostgreSQL 16+ database instance.
* **Implementation Requirement**:
  * Create a production database driver factory in `apps/api/src/db/index.ts` that checks `process.env.NODE_ENV`:
    * If `NODE_ENV === 'production'`, instantiate `drizzle-orm/node-postgres` with `pg.Pool` using `DATABASE_URL`, `DATABASE_POOL_SIZE`, and `DATABASE_SSL`.
    * Otherwise, retain the PGlite instance for local development and test speed.

```
+-----------------------------------------------------------------------+
|                         Fastify API Server                            |
+-----------------------------------------------------------------------+
                                   |
                +------------------+------------------+
                |                                     |
        NODE_ENV === 'production'             NODE_ENV === 'development'
                |                                     |
                v                                     v
   drizzle-orm/node-postgres                  @electric-sql/pglite
        (pg.Pool + SSL)                           (In-Memory WASM)
                |                                     |
                v                                     v
   Standalone PostgreSQL 16+                  Local Dev File/Memory DB
```

### 6.2 Connection Pooling & Resilience
* **Pool Sizing**: Default pool size of 10 connections per API process (configurable via `DATABASE_POOL_SIZE`).
* **SSL Enforcement**: Mandatory TLS connection (`DATABASE_SSL=true`) for production database traffic.
* **Transaction Isolation**: Row-level locking (`FOR UPDATE`) for portfolio sales and Khata reversals preserved under standard PostgreSQL transaction management.

---

## 7. Migration Safety & Release Procedures

### 7.1 Drizzle Kit Production Migration Protocol
Production database schema migrations must be applied using an idempotent pre-deployment runner:

1. **Pre-Migration Safety Gate**:
   * Automated full database snapshot/backup prior to executing migration scripts.
   * Lock checking: ensure no long-running schema lock exists.
2. **Execution Runner**:
   * Execute `npm run db:migrate` (`apps/api/src/db/migrate.ts`) as a pre-deployment step or initialization job before rolling out new API application instances.
   * All Drizzle migrations in `apps/api/src/db/migrations/` (0000 through 0008) utilize transactional SQL (`BEGIN ... COMMIT`).
3. **Rollback Strategy**:
   * If a migration fails, the transaction automatically rolls back.
   * For schema breaking changes, forward-compatible two-phase migrations (expand then contract) must be practiced.

---

## 8. Backup & Disaster Recovery

### 8.1 PostgreSQL Backup Policy
* **Automated Daily Backups**: Full `pg_dump` binary backups scheduled daily during low-traffic windows.
* **Continuous WAL Archiving / Point-In-Time Recovery (PITR)**: Write-Ahead Logs (WAL) archived continuously to secure object storage, enabling recovery to any millisecond within the retention window.
* **Retention Policy**:
  * Hourly WAL archives: 7 days.
  * Daily backups: 30 days.
  * Monthly backups: 1 year.
* **Backup Encryption**: Backups encrypted at rest using AES-256 with KMS managed keys.

### 8.2 Recovery Objectives
* **Recovery Point Objective (RPO)**: `< 5 minutes` (data loss window).
* **Recovery Time Objective (RTO)**: `< 30 minutes` (service restoration time).

---

## 9. Logging & Observability

### 9.1 Structured Pino Logger Configuration
* Fastify server logging powered by `pino` structured JSON logger (`apps/api/src/infrastructure/logging/logger.ts`).
* **Path Redaction**: Production logs automatically redact sensitive fields to prevent credential leakage:
  ```ts
  redact: {
    paths: [
      'password', 'token', 'secret', 'authorization', 'cookie',
      'pan', 'panNumber', 'applicationNumber', 'dbPassword'
    ],
    censor: '[REDACTED]'
  }
  ```
* **Log Destination**: In production, logs output as structured JSON lines to `stdout` for collection by log forwarders (e.g. FluentBit, Datadog, Vector).

---

## 10. Monitoring & Alerting

### 10.1 Key Performance & Health Metrics

| Metric Category | Target Threshold | Alerting Trigger | Remediation Action |
| :--- | :--- | :--- | :--- |
| **API Health Liveness** | 100% | `/api/v1/health` status != 200 | Restart API process instance |
| **Database Readiness** | 100% | `/api/v1/ready` status != 200 | Check DB pool / connection string |
| **HTTP 5xx Error Rate** | `< 0.1%` | `> 1.0%` over 5 minutes | Inspect Pino error logs / rollback release |
| **Dashboard Latency** | `< 35 ms` (p95 `< 50 ms`) | p95 `> 100 ms` for 5 minutes | Check DB query execution / pool exhaustion |
| **Portfolio P&L Latency** | `< 15 ms` (p95 `< 25 ms`) | p95 `> 50 ms` for 5 minutes | Inspect transaction ledger index usage |
| **Market Quote Latency** | Warm Cache `< 0.1 ms` | Cache miss spike / Provider timeout | Verify in-memory quote cache status |

---

## 11. Health & Readiness Protocol

### 11.1 Probe Endpoints
1. **Liveness Probe (`GET /api/v1/health`)**:
   * Evaluates Node process health and basic event loop responsiveness.
   * Returns `200 OK` with `{ status: "ok", timestamp: "..." }`.
   * Used by orchestrators to determine if process is alive.
2. **Readiness Probe (`GET /api/v1/ready`)**:
   * Executes a database connectivity test query (`SELECT 1`).
   * Returns `200 OK` with `{ status: "ready", database: "connected" }`.
   * If database query fails, returns `503 Service Unavailable`.
   * Used by load balancers to route live traffic only to ready instances.

---

## 12. Error Handling & Information Sanitization

### 12.1 Centralized Fastify Error Handler (`errorHandler.ts`)
* External HTTP responses sanitize internal errors to prevent exposing stack traces, database schema internals, or filesystem paths to clients:
  * Validation errors (Zod): Returns `400 BAD_REQUEST` with structured issue details.
  * Internal server errors (500): Logs full stack trace and error message to Pino, but returns clean client response:
    ```json
    {
      "success": false,
      "error": {
        "code": "INTERNAL_SERVER_ERROR",
        "message": "An unexpected server error occurred"
      },
      "timestamp": "2026-09-26T12:00:00.000Z"
    }
    ```

---

## 13. CORS, Security Headers & Network Security

### 13.1 Production CORS Policy
* Managed by `@fastify/cors` plugin in `apps/api/src/app.ts`.
* In production (`NODE_ENV === 'production'`), requests must match `env.CORS_ORIGIN` exactly.
* Wildcard (`*`) or localhost origins are strictly rejected in production.

### 13.2 Security Headers (SEC-02 Enforcement)
* Every HTTP response emits:
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY`
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Content-Security-Policy: default-src 'self'`

---

## 14. Rate Limiting & Abuse Protection

### 14.1 Production Rate Limiter Setup
* Backend API protects endpoints using `@fastify/rate-limit`.
* Default window: 100 requests per 1-minute window per IP address.
* HTTP 429 (`Too Many Requests`) emitted automatically when client threshold is exceeded.

---

## 15. Market Data & IPO Provider Readiness

### 15.1 Market Data Providers & Freshness Tags
* Market quote infrastructure (`MarketDataService.ts`) supports primary provider lookup with fallback.
* Quote responses enforce canonical freshness tags:
  * `LIVE`: Real-time market feed.
  * `DELAYED`: 15-minute delayed quote data.
  * `EOD`: End-of-day official closing price.
  * `STALE`: Outdated quote exceeding freshness threshold.
  * `UNAVAILABLE`: Provider outage or missing symbol data.
* **In-Memory Cache (OPT-03)**: Caches quote data in memory to eliminate redundant database/HTTP requests while preserving freshness tags.

---

## 16. Frontend Production Build & Asset Delivery

### 16.1 Vite Production Build Metrics
* **Build Script**: `npm run build --workspace=@finance-command-center/web` (`tsc && vite build`).
* **Output Artifacts**: Static SPA bundle emitted to `apps/web/dist/`.
* **Chunk Architecture (OPT-06)**:
  * `vendor-*.js`: 259.98 kB (gzip: 82.21 kB)
  * `pages-*.js`: 204.96 kB (gzip: 33.72 kB)
  * `components-*.js`: 94.98 kB (gzip: 15.33 kB)
  * `utils-*.js`: 32.21 kB (gzip: 12.97 kB)
  * `icons-*.js`: 31.16 kB (gzip: 6.85 kB)
  * `index-*.js`: 3.02 kB (gzip: 1.18 kB)
* **Rollup >500 kB Warning**: Completely eliminated.
* **Serving Requirements**: Served via static web server / NGINX / Cloudflare with `Cache-Control: public, max-age=31536000, immutable` for hashed assets, and `no-cache` for `index.html`.

---

## 17. CI/CD Pipeline Architecture

### 17.1 Required Automated Quality Gates

Every deployment pull request or main branch merge must pass a automated 5-stage pipeline:

```
[ Stage 1: Checkout & Setup ] -> [ Stage 2: Type Check ] -> [ Stage 3: Vitest Test Suite ] -> [ Stage 4: Production Build ] -> [ Stage 5: Security & Audit ]
```

1. **Stage 1 (Setup)**: Node.js 20.x setup, clean `npm ci` install.
2. **Stage 2 (Type Check)**: `npm run type-check` (zero TypeScript errors).
3. **Stage 3 (Test Suite)**: `npm run test` (36 Vitest files, 291 tests must pass 100%).
4. **Stage 4 (Build Gate)**: `npm run build` (Clean compile of shared-types, API, and Web).
5. **Stage 5 (Security Audit)**: `npm audit --audit-level=high` verification.

---

## 18. Dependency Security Audit

### 18.1 Dependency Audit & Vulnerability Assessment
* Monorepo uses standard NPM dependencies (`pino`, `fastify`, `drizzle-orm`, `react`, `vitest`).
* Current npm audit shows zero critical or high runtime vulnerabilities in production application code.
* Dependencies must remain pinned to audited semantic version ranges in `package.json`.

---

## 19. Performance Monitoring Backlog

### 19.1 Phase 19 Learning Integration
* All Phase 19 performance optimizations are verified and preserved:
  * **OPT-01**: Parallelized multi-portfolio P&L evaluation (`DashboardService.ts`).
  * **OPT-02**: Database-side deterministic sorting (`PnlService.ts`).
  * **OPT-03**: In-memory quote cache (`MarketDataService.ts`).
  * **OPT-04**: Table row subcomponent memoization (`ResizableTable.tsx`).
  * **OPT-05**: Command palette search memoization (`CommandPalette.tsx`).
  * **OPT-06**: Manual vendor chunk splitting (`vite.config.ts`).
* **Performance Backlog Item**: Total Frontend Gzip bundle size is currently `152.26 kB` (below the `180 kB` budget threshold, though above the aggressive `<145 kB` target). Further asset optimization remains queued as an optional future backlog task.

---

## 20. Release & Deployment Strategy

### 20.1 Rolling Deployment Procedure
1. **Pre-Release Gate**: Run CI/CD automated pipeline. Ensure 100% tests pass and working tree is clean.
2. **Database Migration**: Run `npm run db:migrate` against target production PostgreSQL database.
3. **App Deployment**: Spin up new API instances with new container/build image.
4. **Health Check Validation**: Ingress router queries `/api/v1/ready` on new instances.
5. **Traffic Shift**: Gradual traffic switch to new instances.
6. **Frontend Static Release**: Upload new hashed SPA bundle to static distribution storage.

---

## 21. Rollback Protocol

### 21.1 Emergency Rollback Steps
* **Application Rollback**: If HTTP 5xx error rates exceed 1% post-release, ingress router immediately reverts traffic to previous stable container release.
* **Database Rollback**:
  * Standard schema additions (new columns/tables) do not break older API versions.
  * If a migration must be reverted, execute designated down-migration or restore pre-release point-in-time PostgreSQL backup.

---

## 22. Production Data Safety & Financial Integrity

### 22.1 Financial Audit & Immutable Reversals
* All financial transactions (Buy/Sell trades, Khata entries) enforce strict numerical precision via `Decimal.js` and `NUMERIC(18,4)` columns.
* **No Hard Deletes**: Digital Khata entries use immutable reversal entries to preserve full audit trails.
* **Oversell Lock**: Portfolio position sales execute under database transaction locks (`FOR UPDATE`), preventing position quantities from dropping below zero.

---

## 23. Operational Runbooks

### 23.1 Runbook Index

1. **RB-01: API Startup Failure**:
   * *Detection*: Process exits immediately with log `FATAL: Default development JWT_SECRET is rejected in production`.
   * *Action*: Update secret configuration with explicit 32+ character production `JWT_SECRET`.
2. **RB-02: Database Connection Failure**:
   * *Detection*: `/api/v1/ready` returns `503 Service Unavailable`.
   * *Action*: Verify PostgreSQL database server health, verify `DATABASE_URL` credentials and network security group access.
3. **RB-03: CORS Origin Violation**:
   * *Detection*: Log warning `CORS_NOT_ALLOWED` for incoming client requests.
   * *Action*: Verify client domain matches `CORS_ORIGIN` environment variable.

---

## 24. Production Readiness Matrix

| Area | Current State | Production Requirement | Gap | Classification | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Server Framework** | Fastify 4.x TypeScript | Node 20+ Fastify Service | None | Production Ready | - |
| **Database Engine** | PGlite (WASM) in Dev | Standalone PostgreSQL 16+ | Connection driver adapter in `db/index.ts` | Required Change | **High** |
| **Environment Guards** | `env.ts` validate | Explicit production secrets | None | Production Ready | - |
| **Security Controls** | SEC-01 to SEC-07 | SEC-01 to SEC-07 Enforced | None | Production Ready | - |
| **Logging** | Pino JSON Logger | Pino JSON to stdout | None | Production Ready | - |
| **Error Sanitization** | `errorHandler.ts` | Clean client error responses | None | Production Ready | - |
| **Frontend Bundle** | Vite Split Chunks | Static Asset Server / CDN | None (Largest chunk 259 kB) | Production Ready | - |
| **CI/CD Quality Gate** | Manual npm scripts | Automated GitHub Action | CI/CD workflow YAML definition | Required Change | **Medium** |

---

## 25. File-by-File Implementation Plan

*Note: The following changes are planned for future authorization. NO code changes are made during this planning stage.*

### 25.1 `apps/api/src/db/index.ts`
* **Current Behavior**: Initializes `@electric-sql/pglite` database client unconditionally.
* **Planned Modification**: Add environment branch:
  ```ts
  if (env.NODE_ENV === 'production') {
    // Instantiate drizzle-orm/node-postgres pg.Pool using env.DATABASE_URL
  } else {
    // Retain PGlite for local development and test execution speed
  }
  ```
* **Reason**: Production requires standalone PostgreSQL database server connectivity.
* **Impact**: Zero breaking changes to domain services or test suites.

### 25.2 `.github/workflows/ci.yml` (New File Candidate)
* **Current Behavior**: No CI workflow file currently exists in repository.
* **Planned Modification**: Create GitHub Actions CI workflow executing `npm ci`, `npm run type-check`, `npm run test`, and `npm run build`.
* **Reason**: Automate production quality gates on every pull request.

---

## 26. Database Gate

```
Tables Added: 0
Migrations Added: 0
Schema Modified: NO
```
Phase 20 planning requires **ZERO** database schema changes or migration files.

---

## 27. Phase Boundaries & Exclusions

### Strict Exclusions from Phase 20 Planning:
* ❌ NO immediate deployment or infrastructure provisioning during planning.
* ❌ NO committing of real production secrets, API keys, or certificates.
* ❌ NO database schema modifications or migration file generation.
* ❌ NO dependency upgrades or new NPM package installations.
* ❌ NO modification to financial logic, Decimal.js calculations, or P&L formulas.
* ❌ NO alteration to Fastify REST API response contracts or endpoint routes.
* ❌ NO redesign of the APEX OS user interface or CSS architecture.

---

## 28. Approval Gate

```
PHASE 20 — PRODUCTION PREPARATION PLAN

Planning Status:
FINALIZED

Repository Inspection:
COMPLETE

Current Test Baseline:
36 Vitest test files / 291 tests (291 passed, 0 failed, 0 skipped)

Type Check:
PASSED

Build:
PASSED

Production Readiness Areas Audited:
25

Blocking Production Gaps:
3 (Standalone PostgreSQL driver adapter required for production connection; HMAC secret externalization & production key injection; Production CI/CD workflow definition)

Required Production Changes:
4

External Infrastructure Dependencies:
4 (PostgreSQL 16+ Database, TLS/Reverse Proxy / Load Balancer, Secrets Vault / KMS, CI/CD Runner / Container Registry)

Database Migration Required:
NO

Financial Logic Changes:
0

API Contract Changes:
0

Security Behavior Changes:
0

UI Redesign:
0

Deployment:
NOT IMPLEMENTED

Production Infrastructure:
NOT PROVISIONED

Production Secrets:
NOT CONFIGURED

Phase 20 Implementation:
NOT STARTED

STOPPED — AWAITING PHASE 20 IMPLEMENTATION AUTHORIZATION
```
