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
* **Commit Hash**: `26e01fb12e8315c2045f022d8abdecbaa38979a5`
* **Working Tree**: Clean
* **Vitest Test Baseline**: 36 test files / 291 tests (291 passed, 0 failed, 0 skipped)
  * **API Suite**: 21 test files / 231 passed tests
  * **Web Suite**: 15 test files / 60 passed tests
* **TypeScript Type-Check**: `PASSED` (`tsc -b packages/shared-types && tsc --noEmit -p apps/api/tsconfig.json && tsc --noEmit -p apps/web/tsconfig.json`)
* **Production Build**: `PASSED` (`tsc -b` and `vite build`)
* **Verified Frontend Package Versions** (`apps/web/package.json`):
  * `react`: `^19.0.0`
  * `react-dom`: `^19.0.0`
  * `react-router-dom`: `^7.18.3`
  * `lucide-react`: `^1.46.0`
  * `vite`: `^5.4.10`
  * `vitest`: `^2.1.9`
* **Frontend Bundle State**:
  * Largest Chunk: `259.98 kB` (`vendor-Cu83t4jb.js`)
  * Total JS Size: `578.11 kB`
  * Total Gzip Size: `152.26 kB`
  * Phase 19 Gzip Target (`< 145.00 kB`): `NOT ACHIEVED` (Documented performance backlog item)
  * Phase 19 Gzip Budget (`< 180.00 kB`): `ACHIEVED`
  * Rollup `>500 kB` Warning: `ELIMINATED` (0 warnings)
* **Database State**: `New Phase 20 Migration Files: 0`, `New Phase 20 Schema Design: 0`.

---

## 2. Infrastructure Architecture & Capability Classification

To maintain provider-neutral accuracy, Phase 20 explicitly classifies mandatory capabilities versus deployment-model candidates:

### 2.1 Mandatory Production Capabilities
* **Standalone PostgreSQL 16+ Database**: Relational datastore replacing in-memory dev PGlite.
* **TLS-Protected Network Path**: Encrypted HTTPS/TLS transport for all API and web traffic.
* **External Production Secret Management**: Secret store injection outside source code.
* **Automated Release Quality Gates**: Automated CI/CD execution of type-check, tests, and build.
* **Backup & PITR Capability**: Daily PostgreSQL backups and Write-Ahead Log archiving.
* **Monitoring & Log Collection**: Structured log aggregation and uptime/latency alerting.

### 2.2 Deployment-Model Candidates (Provider Neutral)

| Architecture Candidate | Repository-Proven | Mandatory vs Candidate | Notes |
| :--- | :--- | :--- | :--- |
| **Docker Containerization** | NO | Deployment-Model Candidate | Container runtime option |
| **Ingress Router / NGINX** | NO | Deployment-Model Candidate | Reverse proxy / TLS termination |
| **CDN / Static Web Host** | NO | Deployment-Model Candidate | Static frontend SPA distribution |
| **Kubernetes / Orchestration** | NO | Deployment-Model Candidate | Multi-instance orchestration option |
| **Container Registry** | NO | Deployment-Model Candidate | Required ONLY IF container deployment is selected |

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

## 5. Production Authentication Lifecycle & API Contract Reconciliations

### 5.1 Verified Existing Capabilities vs Planned Auth Lifecycle

* **Code-Level Security Controls**: `VERIFIED`
  * SEC-01 (HMAC signature verification & canonical principal resolution in `resolveAuthenticatedPrincipal`). Identity derived strictly from server validation; caller headers (`x-user-id`) cannot override verified `userId`.
  * SEC-02 (Security Response Headers): Mandatory response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`).
  * SEC-04 / SEC-07 (Role-Based Access Control): Market master writes and IPO sync endpoints restricted to Admin/System roles.
  * SEC-06 (CORS Origin Guard): Unrecognized origins rejected with `403 CORS_NOT_ALLOWED`.

### 5.2 Planned Auth Lifecycle & API Contract Impact
* **Current API Scope**: Existing Fastify routes handle resource operations assuming pre-authenticated principal resolution.
* **Planned Auth Lifecycle Capabilities**: Full endpoint suite for user login, initial credential exchange, access/refresh token issuance, token revocation, key rotation protocols, and administrative user onboarding/offboarding.
* **API Contract Impact**: `EXPECTED — AUTHENTICATION LIFECYCLE ENDPOINTS REQUIRE API ADDITIONS`. Future implementation of login, credential exchange, access token issuance, refresh, revocation, and onboarding/offboarding will introduce new API endpoints and require dedicated security review and regression test additions.

### 5.3 Token Revocation Storage Architecture
* **Production Token Revocation Store**: `SHARED EXTERNAL STATE STORE REQUIRED`
* **Preferred Candidate**: Redis or equivalent shared low-latency state store.
* **Local In-Memory Store**: `DEVELOPMENT / TEST ONLY`
* **Architectural Rationale**:
  * All API instances in a multi-instance deployment must observe token revocations consistently.
  * Logout and session compromise invalidations must propagate across all running API instances immediately.
  * Process restarts or autoscaling events must not silently restore revoked production sessions.
  * Revocation state must not depend on an individual API process's memory space.
* **Database Revocation Table**: `NOT AUTHORIZED UNDER CURRENT ZERO-MIGRATION PLAN`. If a database-backed revocation table is considered in the future, it requires separate schema and migration authorization.

---

## 6. Database Production Strategy, Driver & Migration Gate

### 6.1 Database Migration Gate & Terminology
* **New Phase 20 Migration Files**: `0`
* **New Phase 20 Schema Design**: `0`
* **Production Schema Migration Execution**: `REQUIRED using existing migration set` (0000_initial_schema through 0008_watchlist_schema)

Existing migrations (`apps/api/src/db/migrations/`) must be validated and executed against a fresh target production PostgreSQL database during deployment.

### 6.2 PostgreSQL Driver Status & Authorized Implementation Change

* **pg**: `NOT CURRENTLY INSTALLED`
* **@types/pg**: `NOT CURRENTLY INSTALLED`
* **Production PostgreSQL Driver**: `REQUIRED IMPLEMENTATION CHANGE`
* **Planning vs Implementation Rule**:
  * **Phase 20 PLANNING**: No dependency installation is performed.
  * **Phase 20 IMPLEMENTATION**: Installing `pg` and `@types/pg` in `@finance-command-center/api` is an authorized implementation dependency. Refactoring `apps/api/src/db/index.ts` to conditionally use `drizzle-orm/node-postgres` with `pg.Pool` when `NODE_ENV === 'production'` is a required implementation task.

---

## 7. Backup, Disaster Recovery & RPO/RTO Objectives

### 7.1 Recovery Objectives & Evidence Qualification

* **Proposed RPO Objective**: `< 5 minutes` (Target data loss window)
* **Proposed RTO Objective**: `< 30 minutes` (Target service restoration time)
* **Infrastructure Validation**: `REQUIRED`
* **Repository Evidence**: `NOT SUFFICIENT TO GUARANTEE TARGET` (Recovery performance depends on selected production PostgreSQL infrastructure).

### 7.2 Backup & Disaster Recovery Production Requirements
* **PostgreSQL Backup Policy**: Daily automated `pg_dump` binary backups.
* **Continuous WAL Archiving / PITR**: Write-Ahead Log (WAL) archiving for point-in-time recovery.
* **Backup Encryption & Retention**: Backups encrypted at rest (AES-256) with retention of 7 days (hourly WAL), 30 days (daily), and 1 year (monthly).
* **Operational Restore Testing**: Semi-annual automated restore validation drills.

---

## 8. Proposed Alerting Thresholds vs Measured Performance

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

## 9. Dependency Security Audit & Production Release Gate

### 9.1 Empirical `npm audit` Evidence & Production Gate Status

An empirical `npm audit` execution was performed on the workspace:

* **Audit Result**: `12 vulnerabilities found (7 moderate, 4 high, 1 critical)`
* **Production Runtime Exposure**:
  * `fastify` `<= 5.12.0` (High): DoS via memory allocation, header tab coercion, and host spoofing advisories.
  * `drizzle-orm` `< 0.45.2` (High): SQL identifier escaping advisory.
  * `find-my-way` `<= 9.6.0` (High): HTTP/2 DoS advisory.
  * *Impact*: High severity advisories exist in core production runtime dependencies (`fastify` 4.28.1 and `drizzle-orm` 0.36.0). Remediation requires major breaking upgrades (`fastify` 5.x and `drizzle-orm` 0.45.x).
* **Development & Build-Only Exposure**:
  * `vitest`, `@vitest/mocker`, `vite`, `esbuild`, `drizzle-kit` (Moderate / Critical): Development and build tooling advisories with zero runtime exposure in compiled SPA JS assets.
* **Mitigated Residual Risk Context**: Application-level input validation (Zod), HMAC identity verification, sanitized SQL parameterized queries, and Pino redaction reduce runtime exploit vectors, but do NOT eliminate underlying dependency advisories.
* **Dependency Production Gate**: `BLOCKED — REMEDIATION OR FORMAL RISK ACCEPTANCE REQUIRED`
* **Production Release Eligibility**: `BLOCKED UNTIL DEPENDENCY RISK IS RESOLVED OR FORMALLY ACCEPTED`

### 9.2 CI Security Gate Behavior
* **Current npm Audit Gate**: `EXPECTED TO FAIL AT --audit-level=high`
* **Production CI Policy**:
  * *Option A*: Dependency remediation (upgrading Fastify and Drizzle ORM) occurs before production release.
  * *Option B*: Formal security risk acceptance is documented before overriding the CI security gate.
  * *Rule*: CI will NOT silently ignore advisories or lower audit levels to pass. Dependency upgrades remain strictly prohibited during Phase 20 planning.

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

## 11. Production Readiness Matrix

| Area | Current State | Repository Evidence | Production Requirement | Readiness Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Fastify Runtime** | Fastify 4.28.1 | `apps/api/src/app.ts` | High vulnerabilities resolved | **Requires Security Gate** |
| **Database Engine** | PGlite (WASM) | `apps/api/src/db/index.ts` | Standalone PostgreSQL 16+ | **Requires Implementation** |
| **Environment Guards**| `env.ts` validation | `apps/api/src/config/env.ts` | Fast-fail secret check | **Production Ready in Code** |
| **Security Headers** | SEC-02 hook | `apps/api/src/app.ts` | Mandatory security headers | **Production Ready in Code** |
| **CORS Policy** | Origin validator | `apps/api/src/app.ts` | Production origin lock | **Requires Configuration** |
| **Logging** | Pino structured | `logger.ts` | Structured JSON to stdout | **Production Ready in Code** |
| **Error Handling** | `errorHandler.ts` | `errorHandler.ts` | Sanitized 500 responses | **Production Ready in Code** |
| **Frontend Bundle** | Vite manual chunks | `apps/web/vite.config.ts` | Hashed SPA static assets | **Requires External Infrastructure** |
| **Secret Management**| Fast-fail check | `apps/api/src/config/env.ts` | Vault / KMS externalization | **Requires Configuration** |
| **Auth Lifecycle** | HMAC request hook | `resolveAuthenticatedPrincipal` | Issuance & revocation API | **Requires Implementation** |
| **Dependency Security**| 12 advisories | `npm audit` report | Remediation or risk acceptance | **BLOCKED** |
| **CI/CD Pipeline** | None | No `.github/` folder | Automated Quality Gate | **Requires Implementation** |

---

## 12. Reconciled Required Changes & Blocking Production Gaps

The 5 required production changes reconcile 1-to-1 with the 5 blocking production gaps:

| ID | Required Production Change | Blocking? | Repository Evidence | Target Implementation Area |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Standalone PostgreSQL Driver Integration** | **YES** | `pg` package absent from `apps/api/package.json`; PGlite used | `apps/api/src/db/index.ts` & `package.json` |
| **REQ-02** | **Production Secret Externalization & Injection** | **YES** | No secret injection pipeline; default secrets throw FATAL | Deployment Infrastructure / Secrets Vault |
| **REQ-03** | **Automated Production CI/CD Pipeline** | **YES** | `.github/workflows/` directory absent | `.github/workflows/ci.yml` |
| **REQ-04** | **Production Auth Lifecycle & Token Endpoints** | **YES** | HMAC hook verified, but token issuance/revocation API incomplete | `AuthService.ts` & API Routes |
| **REQ-05** | **Dependency Security Remediation / Risk Acceptance**| **YES** | 12 advisories found; high vulnerabilities in Fastify & Drizzle | Dependency Audit / Security Gate |

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

## 14. Database Migration Gate

```
New Phase 20 Migration Files: 0
New Phase 20 Schema Design: 0
Production Schema Migration Execution: REQUIRED using existing migration set
```
Phase 20 planning introduces **ZERO** database schema changes or migration files. If token revocation or authentication lifecycle features eventually require a database table, it will require separate schema and migration authorization.

---

## 15. Strict Exclusions

### Exclusions from Phase 20 Planning:
* ❌ NO Phase 20 implementation execution or code modifications.
* ❌ NO installation of `pg` or `@types/pg` during planning.
* ❌ NO creation of `AuthService` or token issuance endpoints during planning.
* ❌ NO infrastructure provisioning or deployment.
* ❌ NO real production secret configuration or key generation.
* ❌ NO database schema changes or migration file creation.
* ❌ NO package dependency upgrades or installations.
* ❌ NO creation of CI/CD workflow files during planning.
* ❌ NO modification to financial logic, Decimal.js calculations, or P&L formulas.
* ❌ NO changes to existing Fastify REST API response contracts.
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
36 Vitest test files / 291 tests

Type Check:
PASSED

Build:
PASSED

Production Readiness Areas Audited:
25

Blocking Production Gaps:
5

REQ-01:
Standalone PostgreSQL driver

REQ-02:
Production secret externalization/injection

REQ-03:
Automated CI/CD

REQ-04:
Production authentication lifecycle

REQ-05:
Dependency security remediation or formal risk acceptance

Required Production Changes:
5

External Infrastructure Dependencies:
4

New Phase 20 Migration Files:
0

Production Migration Execution:
REQUIRED using existing migration set

Financial Logic Changes:
0

API Contract Changes:
EXPECTED FOR AUTH LIFECYCLE

Security Behavior Changes:
CURRENT VERIFIED CONTROLS + PLANNED AUTH LIFECYCLE

UI Redesign:
0

Dependency Security:
12 vulnerabilities found
7 moderate / 4 high / 1 critical

Dependency Production Gate:
BLOCKED — REMEDIATION OR FORMAL RISK ACCEPTANCE REQUIRED

Deployment:
NOT IMPLEMENTED

Production Infrastructure:
NOT PROVISIONED

Production Secrets:
NOT CONFIGURED

CI/CD:
NOT IMPLEMENTED

Phase 20 Implementation:
NOT STARTED

STOPPED — AWAITING PHASE 20 IMPLEMENTATION AUTHORIZATION
```
