# Phase 12 — Portfolio & Holdings Architecture & Technical Documentation

## Architectural Overview
Phase 12 implements the **Personal Portfolio & Holdings System** for **Finance Command Center — APEX OS**.

This phase connects user investment portfolios and transaction ledgers to the Phase 9 canonical market-data architecture (`market_instruments`, `market_quotes`).

```
+---------------------------------------------------------------------------------+
|                                APEX OS Web App                                  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                         PortfolioPage (/portfolio)                        |  |
|  | - Portfolio Selector Dropdown & Switcher (Active / Archived)              |  |
|  | - Toolbar: New Portfolio, Rename, Archive/Restore, Add Transaction          |  |
|  | - Metrics Strip: Total Holdings, Cost Basis, Market Value, Freshness Badges |  |
|  | - Active Holdings Table (ResizableTable)                                  |  |
|  | - Transaction History Ledger Table (ResizableTable)                       |  |
|  | - Add Transaction Modal (Phase 10 Securities Search + SELL Oversell Check) |  |
|  +-------------------------------------+-------------------------------------+  |
+----------------------------------------|----------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                           Fastify REST API Gateway                              |
|   GET    /api/v1/portfolios               POST   /api/v1/portfolios             |
|   GET    /api/v1/portfolios/:id           PATCH  /api/v1/portfolios/:id         |
|   POST   /api/v1/portfolios/:id/archive   POST   /api/v1/portfolios/:id/restore |
|   GET    /api/v1/portfolios/:id/holdings  GET    /api/v1/portfolios/:id/txs     |
|   POST   /api/v1/portfolios/:id/txs                                             |
+----------------------------------------|----------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                         PostgreSQL / Drizzle Database                           |
|   portfolios (id, user_id, name, description, status, created_at, updated_at)    |
|   portfolio_transactions (id, portfolio_id, instrument_id, type, date, qty...)   |
|   CHECK CONSTRAINTS: qty > 0, price >= 0, charges >= 0, taxes >= 0...           |
|   FOREIGN KEYS: portfolio_id -> portfolios(id) ON DELETE RESTRICT               |
+---------------------------------------------------------------------------------+
```

---

## Technical Design & Invariants

### 1. Financial History Protection
- `portfolio_transactions.portfolio_id` is configured with `ON DELETE RESTRICT`.
- Financial transaction history is permanent and auditable; it is never automatically deleted through portfolio deletion.
- Portfolio lifecycle remains `ACTIVE` -> `ARCHIVED`. There is no ordinary `DELETE` API for portfolios.

### 2. Transaction Amount Formulas & Decimal.js Precision
- All calculations are performed using `Decimal.js` (zero native JavaScript floating-point arithmetic).
- **BUY Transaction**:
  - `grossAmount = quantity × price`
  - `totalAmount = grossAmount + charges + taxes`
  - BUY charges and taxes are included in acquisition cost.
- **SELL Transaction**:
  - `grossAmount = quantity × price`
  - `totalAmount = grossAmount - charges - taxes`
  - SELL `totalAmount` represents net proceeds (and proceeds are NOT used to reduce cost basis).

### 3. Weighted-Average Cost Basis Formulas
- `totalAcquisitionCost` = remaining cost basis of the current active holding.
- **After BUY**:
  - `newCostBasis = oldCostBasis + grossAmount + charges + taxes`
- **After SELL**:
  - `costRemoved = averageCost × soldQuantity`
  - `remainingCostBasis = oldCostBasis - costRemoved`
  - `averageCost = remainingCostBasis / remainingQuantity`

### 4. Concurrent SELL Protection & Row-Level Locking
- `PortfolioService.addTransaction` executes within an atomic `withTransaction()` boundary.
- Row-level lock acquired via `SELECT ... FOR UPDATE` on the target portfolio row (`lockPortfolioForUpdate`).
- Current available holding quantity is recalculated inside the locked transaction before inserting a SELL. If `requestedSellQuantity > currentAvailableQuantity`, the transaction aborts and returns `422 Unprocessable Entity` (`OVERSELL_ERROR`).

### 5. Deterministic Ledger Ordering & Transaction Dates
- Ledger calculation processing order: `transaction_date ASC`, `created_at ASC`, `id ASC`.
- Historical transaction dates (`transaction_date <= NOW()`) are supported and process chronologically.
- Future-dated transactions (`transaction_date > NOW()`) are rejected server-side with `422 Unprocessable Entity` (`FUTURE_TRANSACTION_DATE`).

### 6. User Security & Identity Isolation
- Every portfolio belongs to a `users.id` (UUID FK).
- Development identity header (`x-user-id`) is strictly required and enforced server-side.
- Missing, empty, or malformed `x-user-id` returns `401 Unauthorized`.
- Cross-user read/write requests return `404 Not Found`. No default or fallback identity exists in runtime request handling.

### 7. Market Data & Batch Quote Integration
- Active holdings fetch current prices dynamically via Phase 9 `IMarketRepository.getBatchQuotes(instrumentIds)`.
- Preserves Phase 9 freshness badges (`LIVE`, `EOD`, `STALE`, `UNAVAILABLE`).
- Missing or unavailable provider quotes render `UNAVAILABLE` or `—` cleanly without mock prices.

### 8. Phase 12 vs Phase 13 P&L Boundary
- Phase 12 calculates holding-level display fields:
  - `marketValue = quantity × currentPrice`
  - `unrealizedGainLoss = marketValue - totalAcquisitionCost`
  - `unrealizedGainLossPercent = (unrealizedGainLoss / totalAcquisitionCost) × 100`
- These are basic display-level holding metrics only. No Phase 13 P&L analytics engine exists (no realized P&L reports, XIRR, CAGR, benchmark comparisons, performance timelines, or risk dashboards).

---

## Database Migrations
- Migration: `apps/api/src/db/migrations/0009_portfolio_schema.sql`
- Registered in `apps/api/src/db/migrations/meta/_journal.json` at `idx: 9`.
- Tables created: `portfolios`, `portfolio_transactions`.

---

## Phase Boundary Audit

| Module | Status | Boundary Rule |
|---|---|---|
| **Phase 12 — Portfolio & Holdings** | **ACTIVE / IMPLEMENTED** | Consumes Phase 9 & 10 APIs |
| **Phase 13 — P&L & Analytics** | **NOT IMPLEMENTED** | Zero realized P&L reports, XIRR, CAGR |
| **Phase 14 — Alerts** | **NOT IMPLEMENTED** | Zero price alert triggers |
| **Phase 15 — Dashboard Market Widgets**| **NOT IMPLEMENTED** | Zero dashboard market widgets |
| **Phase 16 — Financial Reports** | **NOT IMPLEMENTED** | Zero report export engine |
