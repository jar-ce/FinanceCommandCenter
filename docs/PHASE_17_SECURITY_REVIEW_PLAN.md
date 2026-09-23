# PHASE 17 — SECURITY REVIEW & REMEDIATION PLAN
**Project**: Finance Command Center — APEX OS  
**Project Path**: `D:\FinanceCommandCenter`  
**Phase Status**: **PLANNING ONLY — READ-ONLY SECURITY REVIEW FINALIZED**

---

> [!IMPORTANT]
> **READ-ONLY PLANNING GATE**: This document represents the evidence-based Phase 17 Security Review & Remediation Plan. **Zero application code, zero database schemas, zero migrations, and zero dependency lockfiles have been modified during this planning phase.**

---

## 1. Executive Summary

Phase 17 performs an exhaustive, evidence-grounded security review of the **Finance Command Center — APEX OS** codebase across all 16 implemented phases (Phases 0–16). The evaluation scrutinizes system architecture, trust boundaries, identity resolution, route authorization, financial calculation integrity, database constraints, HTTP server configurations, secrets management, file handling, dependency security, and error handling.

### Key Audit Findings Summary:
1. **Unauthenticated Header-Based Identity Boundary (Critical Risk - SEC-01)**: Identity resolution across all Fastify routes relies on a caller-supplied HTTP header (`x-user-id`) parsed via Zod UUID syntax validation (`resolveDevelopmentIdentity`). The header is trusted implicitly as a caller-controlled identity hint without cryptographic signature, verified session token, or principal binding.
2. **Missing Security Headers & CORS Defaults (High Risk - SEC-02)**: Fastify HTTP server lacks HTTP security headers (`@fastify/helmet` - CSP, HSTS, X-Frame-Options, X-Content-Type-Options) and CORS allows credentials with `http://localhost:3000`.
3. **Unsafe Authentication Secret Fallback (High Risk - SEC-03)**: Unsafe authentication-secret fallback/configuration present, currently not bound to active JWT authentication (`JWT_SECRET` in `apps/api/src/config/env.ts`).
4. **Role-Based Authorization Gap in Security Master (Medium Risk - SEC-04)**: `POST /api/v1/market/instruments` allows any caller presenting a valid UUID `x-user-id` to insert/update securities in the global master without administrative RBAC checks.
5. **Role-Based Authorization Gap in IPO Master Sync (Medium Risk - SEC-07)**: `POST /api/v1/ipo/sync` allows any caller presenting a valid UUID `x-user-id` to trigger external IPO provider synchronization and mutate the global canonical IPO master without administrative/system RBAC checks.
6. **Hardcoded Identity Fallbacks in Web UI (Low Risk - SEC-05)**: Multiple React page components (`KhataPage.tsx`, `AlertsPage.tsx`, `IpoApplicationsPage.tsx`) contain hardcoded UUID strings (`11111111-1111-4111-a111-111111111111`) rather than deriving user identity from an authenticated session context.
7. **Permissive CORS Configuration (Low Risk - SEC-06)**: Static CORS origin setting allowing local development frontend with credentials.
8. **Strong Financial Integrity & Database Protection (Verified Control)**: Database schemas enforce strict `ON DELETE RESTRICT` constraints on financial ledgers (`portfolio_transactions`, `khata_transactions`, `portfolios`), `Decimal.js` is consistently used for monetary math, and `NUMERIC(18, 4)` is enforced at the database tier.

---

## 2. Repository Security Scope

The security review inspected the complete APEX OS workspace:
- **Root Monorepo**: [`package.json`](file:///D:/FinanceCommandCenter/package.json), [`.env.example`](file:///D:/FinanceCommandCenter/.env.example), [`.gitignore`](file:///D:/FinanceCommandCenter/.gitignore), [`tsconfig.base.json`](file:///D:/FinanceCommandCenter/tsconfig.base.json).
- **Backend API Application (`apps/api`)**:
  - Entrypoints & App Config: [`server.ts`](file:///D:/FinanceCommandCenter/apps/api/src/server.ts), [`app.ts`](file:///D:/FinanceCommandCenter/apps/api/src/app.ts), [`config/env.ts`](file:///D:/FinanceCommandCenter/apps/api/src/config/env.ts).
  - Middleware & Handlers: [`middleware/errorHandler.ts`](file:///D:/FinanceCommandCenter/apps/api/src/middleware/errorHandler.ts).
  - API Routes (14 route files, **75 exact verified REST endpoints**): [`routes/index.ts`](file:///D:/FinanceCommandCenter/apps/api/src/routes/index.ts), `routes/health.ts`, `routes/khata.ts`, `routes/ipo.ts`, `routes/ipo-applications.ts`, `routes/ipo-allotments.ts`, `routes/market.ts`, `routes/watchlists.ts`, `routes/portfolios.ts`, `routes/pnl.ts`, `routes/alerts.ts`, `routes/notifications.ts`, `routes/dashboard.ts`, `routes/reports.ts`.
  - Domain Services (13 services): [`domain/services/`](file:///D:/FinanceCommandCenter/apps/api/src/domain/services/).
  - Repositories (11 Drizzle implementations): [`infrastructure/repositories/`](file:///D:/FinanceCommandCenter/apps/api/src/infrastructure/repositories/).
  - Database Schemas (15 PostgreSQL schemas): [`db/schema/`](file:///D:/FinanceCommandCenter/apps/api/src/db/schema/).
- **Frontend Web Application (`apps/web`)**:
  - Shell & Router: [`App.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/App.tsx), [`main.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/main.tsx).
  - Pages & Components: [`pages/`](file:///D:/FinanceCommandCenter/apps/web/src/pages/), [`components/`](file:///D:/FinanceCommandCenter/apps/web/src/components/).
- **Shared Types (`packages/shared-types`)**: [`src/index.ts`](file:///D:/FinanceCommandCenter/packages/shared-types/src/index.ts).

---

## 3. Architecture & Trust Boundaries

### 3.1 Concepts & Definitions
- **Authentication**: Who is the caller? Verification of the caller's identity via cryptographic proof (e.g. signed session cookie, server-side session, or verified JWT). Syntax checking a caller-supplied `x-user-id` header is **NOT** authentication; it is merely treating `x-user-id` as an unauthenticated identity hint.
- **Authorization**: What may that verified caller do? Enforcement of permissions and roles (e.g. regular user vs. system administrator / system automation).
- **Ownership Validation**: Does the caller own this resource? Ensuring the authenticated principal matches the `userId` attached to the target record in database queries.

### 3.2 System Trust Flow

```text
[ Unauthenticated Browser / API Client ]
                │
                ▼ (HTTP Request with x-user-id Header)
┌─────────────────────────────────────────────────────────┐
│ Trust Boundary 1: Fastify Web Server                    │
│ - Rate Limiting (100 req/min global)                    │
│ - CORS (origin: http://localhost:3000)                  │
│ - Zod Request Compiler                                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Trust Boundary 2: Fastify Pre-Handler Hooks             │
│ - resolveDevelopmentIdentity()                          │
│   (Validates UUID syntax, TRUSTS header implicitly)     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Trust Boundary 3: Domain Services Layer                 │
│ - PnlService, PortfolioService, KhataService, etc.       │
│ - Decimal.js Math & Status Machine Enforcement           │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Trust Boundary 4: Drizzle ORM Repositories              │
│ - Parameterized SQL Queries                             │
│ - userId WHERE clause filtering                         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Trust Boundary 5: Database Tier (PostgreSQL / PGlite)   │
│ - Foreign Key ON DELETE RESTRICT Constraints            │
│ - CHECK Constraints & NUMERIC(18, 4) Scale              │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Threat Model & Asset Inventory

### 4.1 Asset Inventory
1. **Financial Records & Ledgers**: Digital Khata transaction records, portfolio trade ledgers, weighted-average cost basis, realized/unrealized P&L calculations.
2. **User Identity & Account Data**: User primary keys (`users.id`), email addresses, account ownership relationships.
3. **Operational Portfolio Data**: Portfolio metadata, active holdings, transaction histories.
4. **IPO Tracking & Allotment Data**: Applications, DP IDs, PAN references, verified allotment status records, canonical IPO master records.
5. **Alert Rules & System Notifications**: Custom alert threshold configurations, notification queues.
6. **Market Security Master & Quote Cache**: Instruments master database, quote observations, historical candles.
7. **Audit Trail**: Security event logs (`audit_logs` table).

### 4.2 Threat Actors & Scenarios
- **Unauthenticated External Attacker**: Attempts header forgery, API discovery, SQL injection, SSRF, DoS.
- **Malicious Authenticated User**: Attempts IDOR (accessing/modifying another user's portfolio/khata account), tampering with audit records, mutating global IPO/market master tables, or bypassing transaction invariants.
- **Compromised Web Browser Session**: Exploits XSS or CORS to execute unauthorized financial operations on behalf of a victim.
- **Malicious File Content (Future Requirement)**: Uploads malformed spreadsheet/PDF statement files to cause code execution, formula injection, or DoS.
- **Malicious Provider Response**: Third-party market or IPO data provider returns malformed or out-of-range payloads.
- **Dependency / Supply-Chain Attacker**: Exploits known vulnerabilities in third-party Node.js packages.

---

## 5. Complete API Route Inventory & Authorization Matrix

The codebase contains **75 exact verified REST endpoints** across 14 Fastify route modules.

| Route Path | Method | Authentication | Authorization | Ownership Check | Class | IDOR Risk | Current Control | Gap | Evidence File | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/health` | `GET` | None | Public | N/A | Public | None | Health check handler | None | `routes/health.ts` | None |
| `/api/v1/ready` | `GET` | None | Public | N/A | Public | None | Database ping check | None | `routes/health.ts` | None |
| `/api/v1/market/instruments` | `GET` | None | Public | N/A | Public | Low | Zod query validation | None | `routes/market.ts` | None |
| `/api/v1/market/instruments/:id` | `GET` | None | Public | N/A | Public | Low | Zod UUID param parse | None | `routes/market.ts` | None |
| `/api/v1/market/instruments/:id/quote` | `GET` | None | Public | N/A | Public | Low | Quote service lookup | None | `routes/market.ts` | None |
| `/api/v1/market/instruments/:id/history` | `GET` | None | Public | N/A | Public | Low | Candle service lookup | None | `routes/market.ts` | None |
| `/api/v1/market/status` | `GET` | None | Public | N/A | Public | Low | Provider status parse | None | `routes/market.ts` | None |
| `/api/v1/market/instruments` | `POST` | Header | Unrestricted | None | Private | High | UUID header check | **SEC-04**: Missing Admin RBAC | `routes/market.ts` | Require Admin Role |
| `/api/v1/khata/accounts` | `GET` | Header | User | `eq(userId)` | Private | High | `resolveDevelopmentIdentity` | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts` | `POST` | Header | User | Binds `userId` | Private | High | Zod schema parse | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts/:id` | `GET` | Header | User | Repo check | Private | High | Ownership query | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts/:id` | `PATCH` | Header | User | Repo check | Private | High | Ownership query | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts/:id/archive` | `POST` | Header | User | Repo check | Private | High | Ownership query | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts/:id/transactions` | `GET` | Header | User | Repo check | Private | High | Account ownership query | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts/:id/transactions` | `POST` | Header | User | Repo check | Private | High | Account ownership check | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/khata/accounts/:id/transactions/:txId` | `DELETE` | Header | User | Repo check | Private | High | Reversal service check | **SEC-01**: Unauthenticated header | `routes/khata.ts` | Principal Session Auth |
| `/api/v1/ipo` | `GET` | None | Public | N/A | Public | Low | Zod query parse | None | `routes/ipo.ts` | None |
| `/api/v1/ipo/:id` | `GET` | None | Public | N/A | Public | Low | Zod UUID param parse | None | `routes/ipo.ts` | None |
| `/api/v1/ipo/sync` | `POST` | Header | Unrestricted | None | Private | Med | Header UUID check | **SEC-07**: Missing Admin/System RBAC | `routes/ipo.ts` | Require Admin/System Role |
| `/api/v1/ipo/applications` | `GET` | Header | User | `eq(userId)` | Private | High | Fastify `preHandler` hook | **SEC-01**: Unauthenticated header | `routes/ipo-applications.ts` | Principal Session Auth |
| `/api/v1/ipo/applications` | `POST` | Header | User | Account ownership | Private | High | Service ownership check | **SEC-01**: Unauthenticated header | `routes/ipo-applications.ts` | Principal Session Auth |
| `/api/v1/ipo/applications/:id` | `GET` | Header | User | `eq(userId)` | Private | High | Application ownership check | **SEC-01**: Unauthenticated header | `routes/ipo-applications.ts` | Principal Session Auth |
| `/api/v1/ipo/applications/:id` | `PATCH` | Header | User | `eq(userId)` | Private | High | Application ownership check | **SEC-01**: Unauthenticated header | `routes/ipo-applications.ts` | Principal Session Auth |
| `/api/v1/ipo/applications/:id/status` | `POST` | Header | User | `eq(userId)` | Private | High | State machine check | **SEC-01**: Unauthenticated header | `routes/ipo-applications.ts` | Principal Session Auth |
| `/api/v1/ipo/applications/:id/cancel` | `POST` | Header | User | `eq(userId)` | Private | High | Cancellation guard | **SEC-01**: Unauthenticated header | `routes/ipo-applications.ts` | Principal Session Auth |
| `/api/v1/ipo/allotments` | `GET` | Header | User | `eq(userId)` | Private | High | Fastify `preHandler` hook | **SEC-01**: Unauthenticated header | `routes/ipo-allotments.ts` | Principal Session Auth |
| `/api/v1/ipo/allotments/:id` | `GET` | Header | User | `eq(userId)` | Private | High | Allotment ownership check | **SEC-01**: Unauthenticated header | `routes/ipo-allotments.ts` | Principal Session Auth |
| `/api/v1/ipo/allotments/check/:applicationId` | `POST` | Header | User | Application check | Private | High | Service ownership check | **SEC-01**: Unauthenticated header | `routes/ipo-allotments.ts` | Principal Session Auth |
| `/api/v1/ipo/allotments/verify/:applicationId` | `POST` | Header | User | Application check | Private | High | Service ownership check | **SEC-01**: Unauthenticated header | `routes/ipo-allotments.ts` | Principal Session Auth |
| `/api/v1/watchlists` | `GET` | Header | User | `eq(userId)` | Private | High | Header identity check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists` | `POST` | Header | User | Binds `userId` | Private | High | Service creation check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id` | `GET` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id` | `PATCH` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id/archive` | `POST` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id/restore` | `POST` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id/items` | `POST` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id/items/:instrumentId` | `DELETE` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/watchlists/:id/reorder` | `PATCH` | Header | User | Repo check | Private | High | Watchlist ownership check | **SEC-01**: Unauthenticated header | `routes/watchlists.ts` | Principal Session Auth |
| `/api/v1/portfolios` | `GET` | Header | User | `eq(userId)` | Private | High | Header identity check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios` | `POST` | Header | User | Binds `userId` | Private | High | Service creation check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id` | `GET` | Header | User | Repo check | Private | High | Portfolio ownership check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id` | `PATCH` | Header | User | Repo check | Private | High | Portfolio ownership check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/archive` | `POST` | Header | User | Repo check | Private | High | Portfolio ownership check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/restore` | `POST` | Header | User | Repo check | Private | High | Portfolio ownership check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/holdings` | `GET` | Header | User | Repo check | Private | High | Portfolio holdings check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/transactions` | `GET` | Header | User | Repo check | Private | High | Transaction history check | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/transactions` | `POST` | Header | User | Repo check | Private | High | Buy/Sell trade guard | **SEC-01**: Unauthenticated header | `routes/portfolios.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/pnl` | `GET` | Header | User | Repo check | Private | High | PnL calculation check | **SEC-01**: Unauthenticated header | `routes/pnl.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/pnl/holdings` | `GET` | Header | User | Repo check | Private | High | Holding PnL check | **SEC-01**: Unauthenticated header | `routes/pnl.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/pnl/realized` | `GET` | Header | User | Repo check | Private | High | Realized PnL check | **SEC-01**: Unauthenticated header | `routes/pnl.ts` | Principal Session Auth |
| `/api/v1/portfolios/:id/pnl/performance` | `GET` | Header | User | Repo check | Private | High | Performance metric check | **SEC-01**: Unauthenticated header | `routes/pnl.ts` | Principal Session Auth |
| `/api/v1/alerts` | `GET` | Header | User | `eq(userId)` | Private | High | Header identity check | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/evaluate-all` | `POST` | Header | User | `eq(userId)` | Private | High | Batch rule evaluation | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts` | `POST` | Header | User | Binds `userId` | Private | High | Service creation check | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/:id` | `GET` | Header | User | Rule check | Private | High | Rule ownership check | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/:id` | `PATCH` | Header | User | Rule check | Private | High | Rule ownership check | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/:id/pause` | `POST` | Header | User | Rule check | Private | High | Rule status guard | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/:id/resume` | `POST` | Header | User | Rule check | Private | High | Rule status guard | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/:id/archive` | `POST` | Header | User | Rule check | Private | High | Rule status guard | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/alerts/:id/evaluate` | `POST` | Header | User | Rule check | Private | High | Single rule evaluation | **SEC-01**: Unauthenticated header | `routes/alerts.ts` | Principal Session Auth |
| `/api/v1/notifications` | `GET` | Header | User | `eq(userId)` | Private | High | Header identity check | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/notifications/unread-count` | `GET` | Header | User | `eq(userId)` | Private | High | Unread counter check | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/notifications/read-all` | `POST` | Header | User | `eq(userId)` | Private | High | Bulk read update | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/notifications/:id` | `GET` | Header | User | Notification check | Private | High | Single record check | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/notifications/:id/read` | `POST` | Header | User | Notification check | Private | High | Record state update | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/notifications/:id/unread` | `POST` | Header | User | Notification check | Private | High | Record state update | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/notifications/:id/archive` | `POST` | Header | User | Notification check | Private | High | Record state update | **SEC-01**: Unauthenticated header | `routes/notifications.ts` | Principal Session Auth |
| `/api/v1/dashboard/summary` | `GET` | Header | User | Aggregated `userId` | Private | High | Executive summary check | **SEC-01**: Unauthenticated header | `routes/dashboard.ts` | Principal Session Auth |
| `/api/v1/reports/summary` | `GET` | Header | User | Aggregated `userId` | Private | High | Financial summary check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |
| `/api/v1/reports/portfolio-performance` | `GET` | Header | User | Aggregated `userId` | Private | High | Performance report check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |
| `/api/v1/reports/asset-allocation` | `GET` | Header | User | Aggregated `userId` | Private | High | Asset allocation check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |
| `/api/v1/reports/realized-pnl` | `GET` | Header | User | Aggregated `userId` | Private | High | Realized PnL report check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |
| `/api/v1/reports/khata-cashflow` | `GET` | Header | User | Aggregated `userId` | Private | High | Khata cashflow check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |
| `/api/v1/reports/ipo-participation` | `GET` | Header | User | Aggregated `userId` | Private | High | IPO history check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |
| `/api/v1/reports/alerts-analytics` | `GET` | Header | User | Aggregated `userId` | Private | High | Alerts metrics check | **SEC-01**: Unauthenticated header | `routes/reports.ts` | Principal Session Auth |

---

## 6. API Security Review

- **Zod Request Validation**: Every route compiles Zod schemas via `fastify-type-provider-zod`. Path parameters (e.g. `:id`) are strictly validated using `z.string().uuid()`. Query parameters filter integers via Zod regex.
- **SQL Injection Prevention**: Drizzle ORM parameterized queries are used throughout. No string concatenations exist in SQL queries.
- **Command Injection & SSRF**: No `exec()`, `spawn()`, or dynamic child process invocations exist in API routes. External market data providers use static base URLs configured via environment variables.

---

## 7. Database Security Review

- **Foreign Key Cascade Defenses**: Critical financial entities use `onDelete: 'restrict'`:
  ```typescript
  // In portfolio_transactions schema:
  portfolioId: uuid('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'restrict' })
  ```
- **Numeric Scale Constraints**: All financial fields use `numeric('field', { precision: 18, scale: 4 })` in PostgreSQL schemas and `Decimal.js` in domain services.
- **Check Constraints**: Database schemas enforce status enums and positive transaction bounds (e.g., `check('chk_portfolio_tx_qty', sql'${table.quantity} > 0')`).

---

## 8. Financial Integrity Security Review

- **Digital Khata Reversal Rule**: Transactions are immutable. Reversals create a corresponding balancing transaction entry rather than mutating or deleting historical entries. Double-reversal is prevented at the service layer (`KhataService.ts`).
- **Portfolio Holding Oversell Protection**: `PortfolioService.ts` checks current available holding quantity before executing a SELL. Concurrent SELL protection is verified by test cases (`portfolios.test.ts`).
- **Weighted-Average Cost Basis Integrity**: SELL cost basis is computed using historical BUY transactions prior to the sell event date, maintaining accounting consistency.

---

## 9. File & Statement Import Security Review

### 9.1 Current Implemented Attack Surface
- **Current State**: Fastify backend currently has **no binary multipart upload plugin or file storage service installed** (`fastify-multipart` is absent).
- **Endpoint Status**: There are zero active backend API endpoints that receive binary file streams, temporary file paths, or file buffer uploads.

### 9.2 Future / Deferred Import Security Requirements
Any future bank statement or broker contract note import feature (deferred to future phases) must implement the following mandatory controls:
1. **Strict File Size Limits**: Enforce maximum upload payload limit (e.g. 5 MB) at the Fastify body parser level.
2. **Spreadsheet Formula Injection Defense**: Strip or prefix leading dangerous characters (`=`, `+`, `-`, `@`, `\t`, `\r`) from CSV/Excel string cells before rendering or exporting to prevent client desktop shell execution in Excel/Calc.
3. **Memory & Decompression Bomb Protection**: Enforce zip ratio and uncompressed byte size checks during XLSX/ZIP archive expansion.
4. **Path Traversal Defenses**: Never rely on client-supplied filenames for disk persistence or directory creation.

---

## 10. Frontend Security Review

- **XSS Prevention**: React automatically escapes strings interpolated in JSX. No `dangerouslySetInnerHTML` usage was found in `apps/web/src`.
- **Client-Side Identity Hardcoding**: Pages explicitly pass `x-user-id` headers. Pages such as `KhataPage.tsx`, `AlertsPage.tsx`, and `IpoApplicationsPage.tsx` contain hardcoded test UUID strings (`11111111-1111-4111-a111-111111111111`) in client-side fetch calls.
- **Frontend Hiding vs. Authorization**: Hiding UI buttons or navigation routes client-side is **NOT** a security control. Server-side API authorization remains mandatory.

---

## 11. HTTP, CORS & Security Headers Review

### 11.1 Security Header Enforcement Architecture
Adding security headers to the Fastify API server alone does **NOT** provide complete frontend protection. Headers must be enforced at their appropriate architectural layer:

| Security Header | Enforcement Layer | Target Response | Rationale / Architectural Placement |
| :--- | :--- | :--- | :--- |
| `Content-Security-Policy` (CSP) | Frontend Static Host / Reverse Proxy | Browser HTML Page | Prevents XSS script execution in browser DOM. Belongs on HTML page responses. |
| `Strict-Transport-Security` (HSTS) | Reverse Proxy / TLS Termination | API & Frontend HTML | Enforces HTTPS connections. **Must only be recommended where HTTPS deployment exists.** |
| `X-Frame-Options` | API & Frontend Static Host | All Responses | Prevents clickjacking framing (`DENY` / `SAMEORIGIN`). |
| `X-Content-Type-Options` | API & Frontend Static Host | All Responses | Prevents MIME-sniffing (`nosniff`). |
| `Referrer-Policy` | API & Frontend Static Host | All Responses | Restricts referrer header leakage (`strict-origin-when-cross-origin`). |

### 11.2 Current Server Configuration
- **CORS Configuration**: Registered in `apps/api/src/app.ts` with `origin: env.CORS_ORIGIN` (defaults to `http://localhost:3000`) and `credentials: true`.
- **Rate Limiting**: Registered in `apps/api/src/app.ts` with global limit of `max: 100` requests per minute.

---

## 12. Secrets & Configuration Review

### 12.1 Detailed Evaluation of `JWT_SECRET`
- **A. Is JWT authentication currently implemented?**: **NO.** Authentication across all Fastify routes uses the custom `x-user-id` HTTP header.
- **B. Is `JWT_SECRET` consumed by runtime authentication code?**: **NO.** It is parsed into `env.JWT_SECRET` by `apps/api/src/config/env.ts`, but no route handler or authentication hook signs or verifies JWT tokens.
- **C. Is it only development/future configuration?**: **YES.**
- **D. Is there any active token signing or verification path?**: **NO.**
- **Correct Classification**: **Unsafe authentication-secret fallback/configuration present, currently not bound to active JWT authentication.**
- **Runtime Behavior Impact**: Removing or changing the fallback string in `config/env.ts` without providing a `.env` variable would cause Zod schema validation to fail at server startup, but does **NOT** alter existing route-level identity checking because runtime logic relies exclusively on `x-user-id`.

---

## 13. Logging & Audit Review

- **Pino Logger (`apps/api/src/infrastructure/logging/logger.js`)**: Logs structured JSON with request ID tracing. Does not log sensitive financial credentials or passwords.
- **Audit Log Table (`audit_logs`)**: Captures `userId`, `action`, `entityType`, `entityId`, `details` (JSONB), `ipAddress`, and timestamp. Key domain mutations (portfolios, khata, watchlists, alerts) write audit log entries.

---

## 14. Rate Limiting & DoS Review

- **Global Threshold**: 100 requests per minute per IP.
- **High-Cost Endpoints**: Endpoints executing multi-portfolio calculations (`/api/v1/reports/*`, `/api/v1/dashboard/summary`) are protected by global rate limiting, but should have lower dedicated rate-limit tier options for production deployment.

---

## 15. External Provider Security Review

- **Market & IPO Provider Adapters (`DevelopmentMarketDataProvider.ts`, `DevelopmentIPOProvider.ts`)**: Implements Zero-Fake-Data policy: Returns `'UNAVAILABLE'` status on missing data rather than fabricating artificial quotes or financial figures. Response parsing handles missing fields safely without throwing uncaught exceptions.

---

## 16. Dependency / Supply-Chain Security Review

### 16.1 Audit Execution & Evidence
Command executed:
```bash
npm audit --audit-level=high
```

Audit Result: **Command exited with code 1. 12 total vulnerabilities identified (7 moderate, 4 high).**

### 16.2 Vulnerability Inventory
- **`drizzle-orm` (<0.45.2)** — **HIGH SEVERITY**: Drizzle ORM has SQL injection via improperly escaped SQL identifiers ([GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9)).
- **`fastify` (<=5.12.0)** — **HIGH SEVERITY**: Fastify vulnerable to DoS via Unbounded Memory Allocation in `sendWebStream` ([GHSA-mrq3-vjjr-p77c](https://github.com/advisories/GHSA-mrq3-vjjr-p77c)), header validation bypass ([GHSA-jx2c-rxcm-jvmq](https://github.com/advisories/GHSA-jx2c-rxcm-jvmq)), protocol spoofing ([GHSA-444r-cwp2-x5xf](https://github.com/advisories/GHSA-444r-cwp2-x5xf)).
- **`find-my-way` (<=9.6.0)** — **HIGH SEVERITY**: DDoS with HTTP2 ([GHSA-c96f-x56v-gq3h](https://github.com/advisories/GHSA-c96f-x56v-gq3h)).
- **`vite` / `esbuild` / `@vitest/mocker`** — **MODERATE SEVERITY**: Path traversal in test mock runner and dev server request forwarding.

### 16.3 Remediation Execution Protocol
- **Status**: Recorded in plan. **Zero packages upgraded during Phase 17 planning.**
- **Future Execution Protocol**: During Phase 17 implementation, dependency remediation must:
  1. Inspect package compatibility to prevent breaking changes.
  2. Upgrade only required vulnerable dependencies (e.g. `drizzle-orm` to >=0.45.3, `fastify` to >=5.12.5).
  3. Preserve API compatibility where possible.
  4. Run full unit and integration test suite (`npm test`).
  5. Run TypeScript type check (`npm run typecheck` or `npx tsc --noEmit`).
  6. Run production build validation (`npm run build`).
  7. Run targeted security regression tests.
  8. **Do NOT blindly upgrade the entire dependency tree.**

---

## 17. Error Leakage Review

- **Error Handler (`apps/api/src/middleware/errorHandler.ts`)**: Formats standard JSON responses. In production, stack traces and raw internal error objects are masked from client API responses while remaining logged to server stdout/JSON log streams.

---

## 18. Existing Security Test Coverage

Existing unit and integration test suites cover:
- `khata.test.ts`: Verify transaction postings and reversal balance matching.
- `portfolios.test.ts`: Verify holding quantity oversell guards.
- `reports.test.ts`: Verify user period metrics and return calculations (17 / 17 tests passed).

---

## 19. Security Findings Register

### SEC-01: Identity Boundary Failure — Unauthenticated Header-Based Principal Resolution
- **Severity**: **CRITICAL**
- **Affected Phase**: Phase 2 / Phase 3
- **Affected File**: [`apps/api/src/routes/index.ts`](file:///D:/FinanceCommandCenter/apps/api/src/routes/index.ts) (and all route pre-handlers)
- **Evidence**: `resolveDevelopmentIdentity` extracts `x-user-id` and validates UUID syntax using Zod, but performs no token/session verification.
- **Attack Scenario**: An attacker sends HTTP requests containing arbitrary target UUIDs in the `x-user-id` header to read or modify any user's portfolio, khata accounts, and financial reports.
- **Potential Impact**: Full cross-user data exposure and unauthorized financial transaction posting.
- **Current Control**: UUID format syntax validation.
- **Gap**: Missing cryptographic principal authentication.
- **Recommended Fix**: Implement authenticated principal/session middleware (e.g., signed session cookie, server-side session, verified JWT, or another cryptographically authenticated principal mechanism).
- **Required Test**: Reject missing, malformed, or forged identity tokens with 401 Unauthorized across all 75 endpoints.

### SEC-02: Missing Server & Browser Security Headers
- **Severity**: **HIGH**
- **Affected Phase**: Phase 2
- **Affected File**: [`apps/api/src/app.ts`](file:///D:/FinanceCommandCenter/apps/api/src/app.ts)
- **Evidence**: `@fastify/helmet` is not registered; security headers are absent from API responses.
- **Attack Scenario**: Browser clients exposed to MIME-sniffing or clickjacking attacks.
- **Current Control**: None.
- **Gap**: Missing standard HTTP security headers.
- **Recommended Fix**: Register `@fastify/helmet` on API server and configure static host headers.
- **Required Test**: Assert presence of `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

### SEC-03: Unsafe Authentication Secret Fallback Configuration
- **Severity**: **HIGH**
- **Affected Phase**: Phase 2
- **Affected File**: [`apps/api/src/config/env.ts`](file:///D:/FinanceCommandCenter/apps/api/src/config/env.ts)
- **Evidence**: `JWT_SECRET` contains fallback string `'dev-jwt-secret-min-16-characters-long'`.
- **Classification**: Unsafe authentication-secret fallback/configuration present, currently not bound to active JWT authentication.
- **Potential Impact**: If future JWT authentication is enabled without overriding this variable, tokens can be forged using the published default secret.
- **Recommended Fix**: Require explicit non-default secret when `NODE_ENV=production`.
- **Required Test**: Assert server startup fails in production if `JWT_SECRET` equals default development string.

### SEC-04: Authorization / RBAC Gap on Security Master Instrument Creation
- **Severity**: **MEDIUM**
- **Affected Phase**: Phase 9 / Phase 10
- **Affected File**: [`apps/api/src/routes/market.ts`](file:///D:/FinanceCommandCenter/apps/api/src/routes/market.ts)
- **Evidence**: `POST /api/v1/market/instruments` accepts any valid UUID header without checking administrative roles.
- **Attack Scenario**: Regular users insert arbitrary or fraudulent instruments into the global market master.
- **Recommended Fix**: Restrict instrument creation to administrative principals.
- **Required Test**: Assert non-admin user receives 403 Forbidden.

### SEC-05: Hardcoded Identity Fallbacks in React UI Components
- **Severity**: **LOW**
- **Affected Phase**: Phase 4 – 16
- **Affected Files**: [`apps/web/src/pages/KhataPage.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/pages/KhataPage.tsx), [`AlertsPage.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/pages/AlertsPage.tsx)
- **Evidence**: Components fetch API data using hardcoded string `'11111111-1111-4111-a111-111111111111'`.
- **Recommended Fix**: Refactor React components to consume identity from a central `AuthContext`.
- **Required Test**: Verify frontend UI passes active authenticated session headers.

### SEC-06: Permissive Development CORS Configuration
- **Severity**: **LOW**
- **Affected Phase**: Phase 2
- **Affected File**: [`apps/api/src/app.ts`](file:///D:/FinanceCommandCenter/apps/api/src/app.ts)
- **Evidence**: CORS origin defaults to `http://localhost:3000` with `credentials: true`.
- **Recommended Fix**: Restrict allowed origins based on strict environment variable whitelist.
- **Required Test**: Assert request from unauthorized origin is rejected by CORS handler.

### SEC-07: Authorization / RBAC Gap on IPO Master Synchronization
- **Severity**: **MEDIUM**
- **Affected Phase**: Phase 6 / Phase 7
- **Affected File**: [`apps/api/src/routes/ipo.ts`](file:///D:/FinanceCommandCenter/apps/api/src/routes/ipo.ts)
- **Evidence**: `POST /api/v1/ipo/sync` accepts any valid UUID header and triggers `ipoService.syncIPOs(undefined, userId)`, mutating the shared canonical IPO master database without administrative or system RBAC checks.
- **Attack Scenario**: Unprivileged users trigger resource-intensive provider fetches and mutate shared canonical IPO records.
- **Recommended Fix**: Restrict IPO synchronization to administrative or system automation principals.
- **Required Test**: Assert non-admin user receives 403 Forbidden when calling `POST /api/v1/ipo/sync`.

---

## 20. Remediation Roadmap

### Priority 0 — Immediate Blockers (Authentication & Identity)
1. **Authenticated Principal Middleware**: Replace `resolveDevelopmentIdentity` with an authenticated principal session/token verification middleware (SEC-01).

### Priority 1 — High-Impact Security Hardening
1. **HTTP Security Headers**: Register `@fastify/helmet` on the API server and configure CSP on frontend static hosting (SEC-02).
2. **Production Secret Enforcement**: Throw startup exception if `JWT_SECRET` equals default development string in production (SEC-03).
3. **RBAC Guard on Market Master**: Add admin role check to `POST /api/v1/market/instruments` (SEC-04).
4. **RBAC Guard on IPO Master Sync**: Add admin/system role check to `POST /api/v1/ipo/sync` (SEC-07).
5. **Targeted Dependency Upgrades**: Upgrade `drizzle-orm`, `fastify`, and `find-my-way` following strict compatibility protocol.

### Priority 2 — Important System Hardening
1. **Frontend Auth Context**: Refactor frontend React pages to pull identity from a unified `useAuth()` hook (SEC-05).
2. **Dedicated Rate Limits**: Apply tighter rate limits on high-cost reporting endpoints.
3. **CORS Whitelist**: Strict production origin check (SEC-06).

### Priority 3 — Defense-in-Depth / Cleanup
1. **Spreadsheet Import Sanitization**: Implement formula stripping helper (`=`, `+`, `-`, `@`) for future statement import features.

---

## 21. Database Change Assessment

```text
Tables Added: 0
Migrations Added: 0
Schema Modified: NO
```
> [!NOTE]
> The Phase 17 Security Review Plan requires **ZERO database schema modifications or migrations** for its planning stage.
> **DATABASE CHANGE MAY BE REQUIRED — FUTURE AUTHORIZATION NEEDED**: If implementation later determines that authentication, sessions, or RBAC require new tables (e.g. `user_roles`, `sessions`, `permissions`), **STOP completely**. Do not silently create schema changes without explicit user authorization.

---

## 22. Security Test Plan

Future remediation authorization will require executing security regression tests covering all **75 verified endpoints**:
1. **Unauthenticated Access**: Reject requests missing identity tokens with 401 Unauthorized across all private endpoints.
2. **Token Forgery**: Reject tampered or forged identity tokens with 401 Unauthorized.
3. **Cross-User Data Isolation (IDOR)**: Verify User B receiving HTTP 404/403 when requesting User A resources across all 75 endpoints.
4. **Security Headers Verification**: Assert HTTP response headers contain `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.
5. **RBAC Verification for Market Master**: Assert non-admin user receiving 403 Forbidden when calling `POST /api/v1/market/instruments` (SEC-04).
6. **RBAC Verification for IPO Master Sync**: Assert non-admin user receiving 403 Forbidden when calling `POST /api/v1/ipo/sync` (SEC-07).

---

## 23. Phase 17 Implementation Boundaries

Strictly excluded from Phase 17:
- Phase 18 Regression implementation beyond Phase 17 security tests
- Phase 19 Performance Optimization
- Phase 20 Production Preparation
- Live broker integration or trading execution
- PDF/CSV/Excel exports

---

## 24. Approval Gate & Final Status

```text
PHASE 17 — SECURITY REVIEW PLAN FINALIZED

75 REST Endpoints: VERIFIED
Authorization Matrix: COMPLETE
SEC-01 Identity Boundary: VERIFIED
IPO Sync Authorization: VERIFIED
Dependency Audit Evidence: VERIFIED
Threat Model: COMPLETE
Security Findings: COMPLETE
Remediation Plan: COMPLETE
Security Test Plan: COMPLETE

Implementation: NOT STARTED
Code Changes: 0
Schema Changes: 0
Migrations: 0
Dependency Changes: 0

STOPPED — AWAITING IMPLEMENTATION AUTHORIZATION
```
