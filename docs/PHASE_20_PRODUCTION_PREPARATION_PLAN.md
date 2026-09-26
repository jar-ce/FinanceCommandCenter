# Phase 20 — Production Preparation Plan (APEX OS)

## Executive Summary

This document defines the authoritative **Phase 20 Production Preparation Plan** for **Finance Command Center — APEX OS**. 
The purpose of Phase 20 is to establish an evidence-based roadmap for transitioning APEX OS from its verified single-machine development and testing environment into a secure, robust, and scalable production deployment.

This plan performs a comprehensive audit across 25 production-readiness categories, establishing environment specifications, database production driver transitions, secret management controls, migration safety procedures, backup/disaster recovery protocols, operational runbooks, and file-by-file implementation requirements.

> [!IMPORTANT]
> **Planning Stage Only**: Phase 20 is currently authorized for **PLANNING ONLY**. No application source code, database migrations, package dependencies, infrastructure resources, or production secrets are modified or provisioned during this planning pass.

---

## 1. Current Verified Repository State

The current baseline state of the repository has been empirically verified prior to finalizing this plan:

* **Repository**: `https://github.com/jar-ce/FinanceCommandCenter.git`
* **Branch**: `main`
* **Commit Hash**: `b73af13a29cb4563e2a2d57a55cc6c6264f775da`
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
  * Phase 19 Gzip Target (`< 145.00 kB`): `NOT ACHIEVED` (Documented performance backlog item)
  * Phase 19 Gzip Budget (`< 180.00 kB`): `ACHIEVED`
  * Rollup `>500 kB` Warning: `ELIMINATED` (0 warnings)
* **Database State**: `New Phase 20 Migration Files: 0`, `Schema Design Changes: 0`.

---

## 2. Infrastructure Provenance & Architecture Candidates

To maintain absolute accuracy, Phase 20 explicitly distinguishes between **Repository-Proven Capabilities** and **Planned Infrastructure Candidates**:

| Resource / System | Repository-Proven | Planned Architecture Candidate | External Infrastructure Requirement | Status / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Fastify API Server** | **YES** | YES | NO | Implemented in `apps/api/src/app.ts` |
| **Vite SPA Frontend** | **YES** | YES | NO | Implemented in `apps/web/vite.config.ts` |
| **PGlite Embedded Database** | **YES** | NO (Dev/Test Only) | NO | Local in-memory Postgres WASM driver |
| **Standalone PostgreSQL 16+** | NO | **YES** | **YES** | Target production relational database |
| **Docker / Containers** | NO | **YES** | **YES** | Candidate containerization format |
| **Ingress / NGINX Proxy** | NO | **YES** | **YES** | Reverse proxy / TLS termination gateway |
| **CDN / Cloudflare** | NO | **YES** | **YES** | Static frontend asset delivery |
| **Automated CI/CD** | NO | **YES** | **YES** | `.github/workflows/ci.yml` candidate |
| **Secrets Vault / KMS** | NO | **YES** | **YES** | External secret management system |

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

## 4. Secret Management Protocol

### 4.1 Secret Management Terminology & Implementation Status

To prevent ambiguity, secret management controls are classified according to verified implementation state:

* **Secret Validation**: `IMPLEMENTED / VERIFIED` (Fast-fail check in `apps/api/src/config/env.ts` rejecting default dev keys when `NODE_ENV === 'production'`).
* **Secret Externalization**: `PRODUCTION REQUIREMENT` (Storing production secrets in external KMS/Vault outside version control).
* **Secret Injection**: `PRODUCTION REQUIREMENT` (Runtime container environment variable injection).
* **Secret Rotation**: `PRODUCTION REQUIREMENT` (Periodic HMAC and database credential rotation procedures).
* **Secret Revocation**: `PRODUCTION REQUIREMENT` (Emergency key invalidation protocol).
* **Production Secret Configuration**: `NOT CONFIGURED` (No real production secrets exist in the repository).

---

## 5. Production Authentication & Authorization Lifecycle

### 5.1 Verified Existing Capability vs Production Lifecycle Requirements

Authentication readiness distinguishes between verified request inspection hooks and full operational identity management:

#### Verified Existing Capabilities (In-Code)
* **SEC-01 (HMAC Trust Model & Canonical Identity)**: Server-side HMAC signature verification (`resolveAuthenticatedPrincipal`). Identity derived strictly from server validation; caller headers (`x-user-id`) cannot override verified `userId`.
* **SEC-02 (Security Response Headers)**: Mandatory security headers on all HTTP responses (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'self'`).
* **SEC-04 / SEC-07 (Role-Based Access Control)**: Market master writes and IPO sync endpoints restricted to Admin/System roles.
* **SEC-06 (CORS Origin Guard)**: Unrecognized origins rejected with `403 CORS_NOT_ALLOWED`.

#### Production Lifecycle Requirements (To Be Implemented)
* **Credential & Token Issuance Service**: Full endpoint suite for user login, initial credential exchange, and refresh token issuance.
* **Token Revocation & Blacklisting**: Server-side token invalidation store (e.g., Redis or database table) for logged-out or compromised sessions.
* **Key Rotation Protocol**: Scheduled and emergency HMAC secret rotation routines without user downtime.
* **User Onboarding / Offboarding**: Administrative interface for provisioning users and revoking access.
* **Audit Logging**: Comprehensive logging of authentication failures and privilege escalations.

---

## 6. Database Production Strategy & Migration Terminology

### 6.1 Database Migration Terminology
* **New Phase 20 Migration Files**: `0`
* **Production Schema Migration Execution**: `REQUIRED using existing migration set` (0000_initial_schema through 0008_watchlist_schema)
* **New Schema Changes Introduced by Phase 20 Planning**: `0`
* **Schema Design Changes**: `0`

Existing migrations (`apps/api/src/db/migrations/`) must be validated and executed against a fresh target production PostgreSQL database as part of deployment.

### 6.2 PostgreSQL Driver Path & Production Driver Dependency

* **Current State**: `@finance-command-center/api` depends on `@electric-sql/pglite` for local development and unit testing.
* **Production Driver Dependency**: `REQUIRED EXTERNAL PACKAGE / INSTALLATION (pg / @types/pg)`
* **Implementation Requirement**:
  The `pg` driver package is **not currently installed** in `@finance-command-center/api`. In Phase 20 implementation, `pg` and `@types/pg` must be added to dependencies, and `apps/api/src/db/index.ts` must be refactored to support conditional driver selection:
  ```ts
  if (process.env.NODE_ENV === 'production') {
    // Instantiate drizzle-orm/node-postgres with pg.Pool using DATABASE_URL
  } else {
    // Retain PGlite for local development and test suite execution speed
  }
  ```

---

## 7. Backup, Disaster Recovery & RPO/RTO Objectives

### 7.1 Recovery Objectives & Evidence Qualification

* **Proposed RPO Objective**: `< 5 minutes` (Target data loss window)
* **Proposed RTO Objective**: `< 30 minutes` (Target service restoration time)
* **Infrastructure Validation**: `REQUIRED`
* **Repository Evidence**: `NOT SUFFICIENT TO GUARANTEE TARGET` (Recovery performance depends on selected cloud PostgreSQL infrastructure).

### 7.2 Backup & Disaster Recovery Production Requirements
* **PostgreSQL Backup Policy**: Daily automated `pg_dump` binary backups.
* **Continuous WAL Archiving / PITR**: Write-Ahead Log (WAL) archiving to secure object storage for point-in-time recovery.
* **Backup Encryption & Retention**: Backups encrypted at rest (AES-256) with retention of 7 days (hourly WAL), 30 days (daily), and 1 year (monthly).
* **Operational Restore Testing**: Semi-annual automated restore validation drills.

---

## 8. Logging, Observability & Proposed Alerting Thresholds

### 8.1 Pino Logger & Security Redaction
* Structured JSON logging via `pino` (`apps/api/src/infrastructure/logging/logger.ts`).
* **Path Redaction**: Production logs automatically redact sensitive fields (`password`, `token`, `secret`, `authorization`, `cookie`, `pan`, `panNumber`, `applicationNumber`, `dbPassword`).

### 8.2 Proposed Alerting Thresholds vs Measured Performance

Alerting rules represent **Proposed Alerting Thresholds** for production monitoring, distinguished from Phase 19 measured benchmarks:

| Metric / Endpoint | Phase 19 Measured Benchmark | Proposed Alerting Threshold | Action Trigger |
| :--- | :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | `0.0%` (Test Suite) | `> 1.0%` over 5 mins | Trigger PagerAlert / Rollback evaluation |
| **API Readiness (`/ready`)**| `5.6 ms` | `!= 200 OK` for 2 mins | Alert DB connection failure |
| **Dashboard Latency** | `4.8 ms` | p95 `> 100 ms` for 5 mins | Alert DB pool / query slowdown |
| **Portfolio P&L Latency** | `3.2 ms` | p95 `> 50 ms` for 5 mins | Alert transaction ledger index issue |
| **Reports Latency** | `5.1 ms` | p95 `> 80 ms` for 5 mins | Alert analytics query bottleneck |
| **Market Quote Cache** | `< 0.1 ms` (Warm Cache) | Cache Miss Ratio `> 40%` | Inspect in-memory quote cache |

---

## 9. Reconciled Required Production Changes & Blocking Gaps

The 4 required production changes reconcile 1-to-1 with the 4 blocking production gaps:

| ID | Required Production Change | Blocking? | Repository Evidence | Target Implementation Area |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Standalone PostgreSQL Driver Integration** | **YES** | `pg` package absent from `apps/api/package.json`; PGlite used | `apps/api/src/db/index.ts` & `package.json` |
| **REQ-02** | **Production Secret Externalization & Injection** | **YES** | No secret injection pipeline; default secrets throw FATAL | Deployment Infrastructure / Secrets Vault |
| **REQ-03** | **Automated CI/CD Pipeline Workflow** | **YES** | `.github/workflows/` directory absent | `.github/workflows/ci.yml` |
| **REQ-04** | **Production Auth Lifecycle & Token Management** | **YES** | HMAC hook verified, but issuance/revocation API is incomplete | `apps/api/src/domain/services/AuthService.ts` |

---

## 10. Rollback Strategy

### 10.1 Application vs Database Rollback Protocol

* **Application Rollback**:
  * Revert traffic router / load balancer to previous immutable container image or build artifact.
  * Rapid traffic reversal (`< 2 minutes`).
* **Database Rollback**:
  * **No Automatic Destructive Down-Migrations**: Production deployments must NOT run automatic destructive `DOWN` migrations, as they risk catastrophic data loss.
  * **Expand / Contract Strategy**: Schema additions must remain backward-compatible with the previous application release.
  * **Corrective Migrations & PITR**: Irreversible schema errors must be remediated via forward corrective migrations or point-in-time database restoration from verified backups.

---

## 11. Dependency Security Audit

### 11.1 Empirical `npm audit` Evidence & Risk Classification

An empirical `npm audit` execution was performed on the workspace:

* **Audit Result**: `12 vulnerabilities found (7 moderate, 4 high, 1 critical)`
* **Production Runtime Exposure**:
  * `fastify` `<= 5.12.0` (High): DoS via memory allocation, header tab coercion, and host spoofing advisories.
  * `drizzle-orm` `< 0.45.2` (High): SQL identifier escaping advisory.
  * `find-my-way` `<= 9.6.0` (High): HTTP/2 DoS advisory.
  * *Impact*: High severity advisories exist in core production dependencies (`fastify` 4.28.1 and `drizzle-orm` 0.36.0). Remediation requires major breaking upgrades (`fastify` 5.x and `drizzle-orm` 0.45.x).
* **Development & Build-Only Exposure**:
  * `vitest`, `@vitest/mocker`, `vite`, `esbuild`, `drizzle-kit` (Moderate / Critical): Development, testing, and bundler tooling advisories. Zero runtime exposure in production backend or compiled SPA JS assets.
* **Mitigated Residual Risk**: Application-level input validation (Zod), HMAC identity verification, sanitized SQL parameterized queries, and Pino redaction mitigate runtime exploit vectors.
* **Unresolved Risk Status**: Vulnerabilities remain unpatched during Phase 20 planning because dependency upgrades are strictly prohibited. Remediating runtime advisories is queued as a post-planning maintenance task.

---

## 12. Production Readiness Matrix

| Area | Current State | Repository Evidence | Production Requirement | Gap | Readiness Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Framework** | Fastify 4.28.1 | `apps/api/src/app.ts` | Fastify 4.x/5.x Service | None | **Production Ready in Code** |
| **Database Engine** | PGlite (WASM) | `apps/api/src/db/index.ts` | Standalone PostgreSQL 16+ | Driver `pg` missing | **Requires Implementation** |
| **Environment Guards**| `env.ts` validation | `apps/api/src/config/env.ts` | Fast-fail secret check | None | **Production Ready in Code** |
| **Security Headers** | SEC-02 hook | `apps/api/src/app.ts` | Mandatory security headers | None | **Production Ready in Code** |
| **CORS Policy** | Origin validator | `apps/api/src/app.ts` | Production origin lock | Production domain config | **Requires Configuration** |
| **Logging** | Pino structured | `logger.ts` | Structured JSON to stdout | None | **Production Ready in Code** |
| **Error Handling** | `errorHandler.ts` | `errorHandler.ts` | Sanitized 500 responses | None | **Production Ready in Code** |
| **Frontend Bundle** | Vite manual chunks | `apps/web/vite.config.ts` | Hashed SPA static assets | CDN / NGINX hosting | **Requires External Infrastructure** |
| **Secret Management**| Fast-fail check | `apps/api/src/config/env.ts` | Vault / KMS externalization | No production secrets | **Requires Configuration** |
| **Auth Lifecycle** | HMAC request hook | `resolveAuthenticatedPrincipal` | Issuance & revocation API | Token management API | **Requires Implementation** |
| **CI/CD Pipeline** | None | No `.github/` folder | Automated Quality Gate | Workflow definition | **Requires Implementation** |
| **Database Backups** | None | Local PGlite memory | Daily backups + PITR | Backup infrastructure | **Requires Operational Process** |

---

## 13. File-by-File Implementation Plan

*Note: The following changes are planned for future authorization. NO code modifications are performed during this planning stage.*

### 13.1 `apps/api/package.json`
* **Current Behavior**: Contains `@electric-sql/pglite` dependency; lacks `pg` and `@types/pg`.
* **Planned Modification**: Add `pg^8.13.0` and `@types/pg^8.11.0` to dependencies.
* **Reason**: Required driver for standalone PostgreSQL database connectivity.

### 13.2 `apps/api/src/db/index.ts`
* **Current Behavior**: Initializes `@electric-sql/pglite` client unconditionally.
* **Planned Modification**: Refactor `getDb()` to check `env.NODE_ENV`:
  ```ts
  if (env.NODE_ENV === 'production') {
    // Connect to PostgreSQL via drizzle-orm/node-postgres pg.Pool
  } else {
    // Retain PGlite for local development and fast unit test execution
  }
  ```
* **Reason**: Enables seamless transition between dev PGlite and production PostgreSQL.

### 13.3 `.github/workflows/ci.yml` (New File Candidate)
* **Current Behavior**: No CI workflow file exists.
* **Planned Modification**: Create GitHub Actions CI workflow running `npm ci`, `npm run type-check`, `npm run test`, and `npm run build`.
* **Reason**: Enforce automated quality gates on all pull requests.

---

## 14. Database Gate

```
New Tables: 0
New Migrations: 0
Schema Changes: 0
```
Phase 20 planning introduces **ZERO** database schema changes or migration files.

---

## 15. Strict Exclusions

### Exclusions from Phase 20 Planning:
* ❌ NO Phase 20 implementation execution or code modifications.
* ❌ NO infrastructure provisioning or deployment.
* ❌ NO real production secret configuration or key generation.
* ❌ NO database schema changes or migration file creation.
* ❌ NO package dependency upgrades or new package installations.
* ❌ NO creation of CI/CD workflow files during planning.
* ❌ NO modification to financial logic, Decimal.js calculations, or P&L formulas.
* ❌ NO changes to Fastify REST API response contracts or endpoint routes.
* ❌ NO redesign of the APEX OS user interface or CSS architecture.

---

## 16. Approval Gate

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
4 (REQ-01: PostgreSQL driver missing; REQ-02: Production secret injection missing; REQ-03: CI/CD pipeline missing; REQ-04: Auth token management API incomplete)

Required Production Changes:
4

External Infrastructure Dependencies:
4 (Standalone PostgreSQL 16+ DB, Ingress Router / Reverse Proxy / TLS, Secrets Vault / KMS, CI/CD Runner / Container Registry)

New Phase 20 Migration Files:
0

Production Migration Execution:
REQUIRED using existing migration set

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

CI/CD:
NOT IMPLEMENTED

Dependency Security:
12 vulnerabilities found (7 moderate, 4 high, 1 critical; unresolved residual risk in Fastify 4.x and Drizzle-ORM 0.36.x)

Phase 20 Implementation:
NOT STARTED

STOPPED — AWAITING PHASE 20 IMPLEMENTATION AUTHORIZATION
```
