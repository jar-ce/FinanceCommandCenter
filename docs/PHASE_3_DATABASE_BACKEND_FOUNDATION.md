# FINANCE COMMAND CENTER (APEX OS)
## Phase 3 Database & Backend Foundation Specification

---

### 1. Executive Summary

**Phase 3 (Database & Backend Foundation)** establishes the backend architecture, Drizzle ORM PostgreSQL schema foundation, precision financial arithmetic engine, repository pattern implementations, centralized Fastify error handling, environment validation, health/readiness probes, and automated test suite for **Finance Command Center**.

No business domain workflows (Khata ledgers, IPO tracking, Stock data ingestion, Portfolio P&L calculations) or fake datasets were generated during this phase.

---

### 2. Environment & PostgreSQL Strategy

#### 2.1 Machine Environment State
- **OS**: Windows 11 (64-bit)
- **Node.js**: `v20.18.0`
- **npm**: `10.8.2`
- **Git**: `2.47.0.windows.2`
- **Native Host PostgreSQL Server**: Service installed (`17.0`) but not running on local port 5432.

#### 2.2 Concrete Development Database Strategy
- **Target Engine**: PostgreSQL (Target Production Engine: PostgreSQL 16/17).
- **Selected Local Development Engine**: **`@electric-sql/pglite`** (Embedded WebAssembly PostgreSQL database engine compiled directly from official PostgreSQL C source code v16.x).
- **RATIONALE & PRODUCTION PARITY**:
  1. **Official C Code Execution**: PGlite executes actual PostgreSQL C source code inside Node.js.
  2. **100% Dialect & Precision Parity**: Supports native PostgreSQL `NUMERIC(18, 4)`, JSONB, window functions (`SUM() OVER (...)`), UUID v4 primary keys (`gen_random_uuid()`), foreign keys, indexes, and atomic transactions.
  3. **Real Drizzle Migrations**: Executes actual Drizzle PostgreSQL migration DDL scripts (`CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid()...)`).
  4. **Zero Float Degradation**: Unlike SQLite, PGlite preserves arbitrary-precision decimal operations with zero floating-point approximation.
  5. **Deterministic Local Execution**: Enables instant local development and automated CI testing without requiring system administrator permissions or external service daemons.

---

### 3. Dependencies Added

| Package Name | Purpose / Rationale | Classification |
| :--- | :--- | :--- |
| `drizzle-orm` | Primary PostgreSQL ORM for type-safe query building | Core Database |
| `@electric-sql/pglite` | Embedded WebAssembly PostgreSQL engine | Local Dev / Testing |
| `fastify` | High-performance backend API web server | Transport Layer |
| `@fastify/cors` | Cross-Origin Resource Sharing security headers | Transport Security |
| `@fastify/rate-limit` | Endpoint IP and client rate limiting | Security |
| `fastify-type-provider-zod` | Zod schema compilation for Fastify endpoints | Request Validation |
| `zod` | Environment & DTO schema validation | Validation |
| `decimal.js` | Arbitrary-precision financial arithmetic | Financial Math |
| `dotenv` | Environment variable file loading | Configuration |
| `pino` & `pino-pretty` | Structured JSON logging with redactions | Observability |
| `drizzle-kit` | SQL DDL migration generator | Dev Dependency |
| `tsx` | TypeScript script and watch execution | Dev Dependency |
| `vitest` | Fast unit & integration test runner | Dev Dependency |

---

### 4. Database Schema Foundation & Migration System

#### 4.1 Primary Key & Timestamp Strategy
- **Primary Keys**: Native PostgreSQL UUID v4 (`id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL`). Generated in-database via PostgreSQL's built-in `gen_random_uuid()` function. Drizzle schema uses `.defaultRandom()`.
- **Timestamps**: UTC storage using `timestamp with time zone` (`created_at`, `updated_at`).

#### 4.2 Implemented Core Tables:

1. **`users` Table**:
   - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()` (UUID v4)
   - `email`: `text NOT NULL UNIQUE`
   - `name`: `text NOT NULL`
   - `created_at`: `timestamp with time zone DEFAULT now() NOT NULL`
   - `updated_at`: `timestamp with time zone DEFAULT now() NOT NULL`
   - *Indexes*: `idx_users_email` (B-tree)

2. **`audit_logs` Table**:
   - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()` (UUID v4)
   - `user_id`: `uuid REFERENCES users(id) ON DELETE SET NULL`
   - `action`: `text NOT NULL`
   - `entity_type`: `text NOT NULL`
   - `entity_id`: `text`
   - `details`: `jsonb`
   - `ip_address`: `text`
   - `created_at`: `timestamp with time zone DEFAULT now() NOT NULL`
   - *Indexes*: `idx_audit_logs_user_id` (B-tree), `idx_audit_logs_action` (B-tree)

#### 4.3 Migration Workflow:
- Generated Migration SQL: [`apps/api/src/db/migrations/0000_vengeful_ken_ellis.sql`](file:///D:/FinanceCommandCenter/apps/api/src/db/migrations/0000_vengeful_ken_ellis.sql)
- Automated Programmatic Runner: `npm run db:migrate` ([`apps/api/src/db/migrate.ts`](file:///D:/FinanceCommandCenter/apps/api/src/db/migrate.ts))

---

### 5. Financial Precision Policy & Precision Semantics

#### 5.1 Four-Layer Precision Semantics
To prevent precision loss and premature rounding errors, the architecture clearly separates four layers:

1. **Calculation Precision**: Core financial arithmetic occurs in application memory using `decimal.js` configured with **28 digits of precision** (`Decimal.set({ precision: 28 })`). Intermediate steps retain full un-rounded decimal precision.
2. **Database Storage Precision**: Database fields use PostgreSQL `NUMERIC(18, 4)` (18 total digits with 4 fixed decimal places). `.toDatabaseString()` formats the number to 4 decimal places for database storage.
3. **Business-Rule Rounding**: Explicit rounding (`Decimal.ROUND_HALF_UP`) is applied only when required by a documented financial or regulatory business rule (e.g. tax settlement, ledger closing).
4. **Presentation Formatting**: Display strings (`.toDisplayString()`) format the value to 2 decimal places for visual presentation without mutating or prematurely truncating the high-precision internal value.

#### 5.2 Floating-Point Arithmetic Prohibition
Floating-point primitive arithmetic (`+`, `-`, `*`, `/`, `parseFloat()`, `Number(...)`) is strictly prohibited in the core financial calculation path.

---

### 6. Fastify Backend Architecture & Error Handling

- **Architecture Boundary**:
  $$\text{HTTP Request} \rightarrow \text{Zod Middleware} \rightarrow \text{Typed DTO} \rightarrow \text{Application UseCase} \rightarrow \text{Clean Repository} \rightarrow \text{Drizzle/PostgreSQL}$$
- **Request Correlation**: Each request assigned `x-request-id` header and logged via Pino logger.
- **Sensitive Data Redaction**: Pino automatically redacts `password`, `token`, `secret`, `authorization`, `cookie`, `pan`, `panNumber`, `applicationNumber`, `dbPassword`.
- **Standard Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request parameters",
      "details": [ ... ]
    },
    "timestamp": "2026-09-15T12:45:00.000Z"
  }
  ```
- **Infrastructure Probes**:
  - `GET /api/v1/health` (Liveness, HTTP 200)
  - `GET /api/v1/ready` (Readiness, verifies PostgreSQL query execution `SELECT 1`, HTTP 200 or 503)

---

### 7. Automated Test Suite (Vitest)

All 10 test cases passed with 100% success across 4 test suites:

1. **`financial-precision.test.ts`**: Verifies exact `decimal.js` addition (`0.1 + 0.2 = 0.3000`), multiplication, `NUMERIC(18, 4)` database string formatting, and empirically tests PostgreSQL `NUMERIC(18, 4)` database casting and scale rounding (`123.4567`, `0.0001`, `999999999999.9999`, and scale 4 rounding of `123.456789` $\rightarrow$ `123.4568`).
2. **`db-migration.test.ts`**: Verifies programmatic Drizzle migration execution against PGlite PostgreSQL and tests atomic transaction rollback functionality.
3. **`repositories.test.ts`**: Verifies `DrizzleUserRepository` and `DrizzleAuditLogRepository` CRUD queries, empirical UUID v4 regex format validation (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`), and foreign key constraint relationships.
4. **`health.test.ts`**: Verifies `GET /api/v1/health` (HTTP 200) and `GET /api/v1/ready` (HTTP 200 database readiness check).

---

### 8. File Inventory (Phase 3)

#### Created Backend Files:
- [`apps/api/drizzle.config.ts`](file:///D:/FinanceCommandCenter/apps/api/drizzle.config.ts)
- [`apps/api/src/config/env.ts`](file:///D:/FinanceCommandCenter/apps/api/src/config/env.ts)
- [`apps/api/src/db/schema/users.ts`](file:///D:/FinanceCommandCenter/apps/api/src/db/schema/users.ts)
- [`apps/api/src/db/schema/audit-logs.ts`](file:///D:/FinanceCommandCenter/apps/api/src/db/schema/audit-logs.ts)
- [`apps/api/src/db/schema/index.ts`](file:///D:/FinanceCommandCenter/apps/api/src/db/schema/index.ts)
- [`apps/api/src/db/index.ts`](file:///D:/FinanceCommandCenter/apps/api/src/db/index.ts)
- [`apps/api/src/db/migrate.ts`](file:///D:/FinanceCommandCenter/apps/api/src/db/migrate.ts)
- [`apps/api/src/db/migrations/0000_vengeful_ken_ellis.sql`](file:///D:/FinanceCommandCenter/apps/api/src/db/migrations/0000_vengeful_ken_ellis.sql)
- [`apps/api/src/domain/value-objects/FinancialAmount.ts`](file:///D:/FinanceCommandCenter/apps/api/src/domain/value-objects/FinancialAmount.ts)
- [`apps/api/src/domain/repositories/IUserRepository.ts`](file:///D:/FinanceCommandCenter/apps/api/src/domain/repositories/IUserRepository.ts)
- [`apps/api/src/domain/repositories/IAuditLogRepository.ts`](file:///D:/FinanceCommandCenter/apps/api/src/domain/repositories/IAuditLogRepository.ts)
- [`apps/api/src/infrastructure/repositories/DrizzleUserRepository.ts`](file:///D:/FinanceCommandCenter/apps/api/src/infrastructure/repositories/DrizzleUserRepository.ts)
- [`apps/api/src/infrastructure/repositories/DrizzleAuditLogRepository.ts`](file:///D:/FinanceCommandCenter/apps/api/src/infrastructure/repositories/DrizzleAuditLogRepository.ts)
- [`apps/api/src/infrastructure/logging/logger.ts`](file:///D:/FinanceCommandCenter/apps/api/src/infrastructure/logging/logger.ts)
- [`apps/api/src/middleware/errorHandler.ts`](file:///D:/FinanceCommandCenter/apps/api/src/middleware/errorHandler.ts)
- [`apps/api/src/routes/health.ts`](file:///D:/FinanceCommandCenter/apps/api/src/routes/health.ts)
- [`apps/api/src/routes/index.ts`](file:///D:/FinanceCommandCenter/apps/api/src/routes/index.ts)
- [`apps/api/src/app.ts`](file:///D:/FinanceCommandCenter/apps/api/src/app.ts)
- [`apps/api/src/server.ts`](file:///D:/FinanceCommandCenter/apps/api/src/server.ts)
- [`apps/api/src/__tests__/financial-precision.test.ts`](file:///D:/FinanceCommandCenter/apps/api/src/__tests__/financial-precision.test.ts)
- [`apps/api/src/__tests__/db-migration.test.ts`](file:///D:/FinanceCommandCenter/apps/api/src/__tests__/db-migration.test.ts)
- [`apps/api/src/__tests__/repositories.test.ts`](file:///D:/FinanceCommandCenter/apps/api/src/__tests__/repositories.test.ts)
- [`apps/api/src/__tests__/health.test.ts`](file:///D:/FinanceCommandCenter/apps/api/src/__tests__/health.test.ts)

#### Modified Project Files:
- [`apps/api/package.json`](file:///D:/FinanceCommandCenter/apps/api/package.json)
- [`package.json`](file:///D:/FinanceCommandCenter/package.json)
- [`.env.example`](file:///D:/FinanceCommandCenter/.env.example)

---

### 🚨 CURRENT STATE & RECOMMENDED NEXT PHASE

**PHASE 3 VERIFIED — READY FOR PHASE 4 AUTHORIZATION**

**Recommended Next Phase**: **PHASE 4 — Application Shell & Navigation**
*(Building the frontend application shell, Command Rail sidebar, top Command Deck bar, global `Ctrl+K` command palette overlay, and routing layout).*

Waiting for explicit confirmation before proceeding to Phase 4.
