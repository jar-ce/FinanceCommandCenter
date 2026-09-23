# APEX OS — Phase 6 — IPO Center Technical Architecture & Master Registry Specification

## Executive Summary
Phase 6 implements the foundational **IPO Center** module for **Finance Command Center — APEX OS**. It establishes the single canonical IPO master entity (`ipos` table), provider data abstraction (`IIPODataProvider`), zero-fake-data development provider boundary (`DevelopmentIPOProvider`), `Decimal.js` fixed-precision financial term calculations, data provenance and freshness tracking, Fastify REST APIs, and an interactive command desk interface with `ResizableTable` primitives and pipeline stage metrics.

---

## 1. Domain Model & Accounting Semantics

### Canonical Master Entity
- **`IPOMasterRecord`**: Authoritative master entity representing initial public offering offerings.
- **Single Source of Truth**: All future application tracking (Phase 7) and allotment verification (Phase 8) modules reference this canonical entity (`ipos.id`) without recreating duplicate master tables.

### Key Fields & Attributes
- **Identity**: `id` (UUID v4 PK), `externalId` (Provider Unique ID), `provider` (`DEVELOPMENT_STUB`, `NSE_PUBLIC`, `BSE_PUBLIC`), `source` (Public Exchange Feed).
- **Issuer Details**: `issuerName`, `ipoName`, `symbol`, `exchange` (`NSE`, `BSE`, `NSE_BSE`, `UNKNOWN`), `securityType` (`EQUITY`, `DEBT`), `issueType` (`MAINBOARD`, `SME`, `UNKNOWN`).
- **Lifecycle Status**: `UPCOMING`, `OPEN`, `CLOSED`, `LISTED`, `CANCELLED`, `POSTPONED`.
- **Financial Terms**: `faceValue`, `priceBandLow`, `priceBandHigh`, `lotSize`, `issueSize`, `freshIssueSize`, `offerForSaleSize` (Stored as `NUMERIC(18, 4)`).
- **Derived Terms**: `maxLotCost` = `priceBandHigh` $\times$ `lotSize` computed via `Decimal.js` fixed-precision arithmetic (`ROUND_HALF_UP`).

---

## 2. Provider Abstraction & Data Provenance

### Infrastructure Boundary (`IIPODataProvider`)
- Domain services interact strictly with `IIPODataProvider` contract (`fetchIPOs()`, `fetchIPOByExternalId()`), decoupling domain logic from HTTP, web scrapers, or specific API vendors.

### Zero Fake Data Policy
- The default development provider `DevelopmentIPOProvider` returns `[]` (empty list) when no external URL (`IPO_DATA_PROVIDER_URL`) is configured.
- Absolutely zero fake demo IPO records, fabricated dates, or invented GMP figures are hardcoded in application code.

### Duplicate Prevention & Upsert Policy
- Synchronization performs upserts on `(provider, external_id)` unique constraint index (`ipos_provider_external_id_idx`). Re-running synchronization updates authoritative fields while updating `retrievedAt` without creating duplicate records.

---

## 3. Database Schema & Migration Journal

### Migrations
- Migration DDL: `apps/api/src/db/migrations/0003_ipo_schema.sql`
- Journal Registry: `apps/api/src/db/migrations/meta/_journal.json`

---

## 4. API Endpoints

- `GET /api/v1/ipo`: List canonical IPO records with pagination (`page`, `limit`), search (`issuerName`, `ipoName`, `symbol`), status filter, exchange filter, and issue type filter. Includes pipeline count summary.
- `GET /api/v1/ipo/:id`: Retrieve single detailed canonical IPO record with derived `maxLotCost`. Returns HTTP 404 if not found.
- `POST /api/v1/ipo/sync`: Trigger provider synchronization, normalize DTOs, validate with Zod, update DB records, and record `IPO_REFRESHED` audit log.

---

## 5. Verification Results

- **Vitest Automated Test Suite**:
  - `apps/api`: **28 / 28 tests passed** (Includes migration, precision, health, Khata, and IPO domain/service/HTTP tests).
  - `apps/web`: **15 / 15 tests passed** (Includes shell, command palette, resizable table, Khata, and IPO Center UI tests).
  - **Total**: **43 / 43 tests passed** (0 failures).
- **TypeScript Type-Check**: **0 errors across monorepo**.
- **Production Web Build**: Vite production build succeeded cleanly (`✓ built in 16.25s`).
