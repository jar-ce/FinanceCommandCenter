# Phase 11 — Watchlist Architecture & Technical Documentation

## Architectural Overview
Phase 11 implements the **Personal Stock Watchlist System** for **Finance Command Center — APEX OS**.

This phase connects user-managed security watchlists to the Phase 9 canonical market-data architecture (`market_instruments`, `MarketDataService`).

```
+---------------------------------------------------------------------------------+
|                                APEX OS Web App                                  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                         WatchlistPage (/watchlist)                        |  |
|  | - Watchlist Selector Dropdown & Switcher (Active / Archived)              |  |
|  | - Toolbar: Create Watchlist, Rename, Archive/Restore, Add Instrument       |  |
|  | - Metrics Strip: Total Items, Live Quotes, Stale Count, Unavailable Count   |  |
|  | - ResizableTable Primitive (Symbol, Name, Exchange, Price, Change %, State) |  |
|  | - Add Instrument Search Modal (Reuses Phase 10 Securities Search API)       |  |
|  +-------------------------------------+-------------------------------------+  |
+----------------------------------------|----------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                           Fastify REST API Gateway                              |
|   GET    /api/v1/watchlists               POST   /api/v1/watchlists             |
|   GET    /api/v1/watchlists/:id           PATCH  /api/v1/watchlists/:id         |
|   POST   /api/v1/watchlists/:id/archive   POST   /api/v1/watchlists/:id/restore |
|   POST   /api/v1/watchlists/:id/items     DELETE /api/v1/watchlists/:id/items/:id|
+----------------------------------------|----------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                         PostgreSQL / Drizzle Database                           |
|   watchlists (id, user_id, name, description, status, sort_order)              |
|   watchlist_items (id, watchlist_id, instrument_id, sort_order)                 |
|   UNIQUE INDEX: idx_watchlist_items_unique (watchlist_id, instrument_id)       |
+---------------------------------------------------------------------------------+
```

---

## Technical Design & Invariants

### 1. Watchlist Does Not Own Market Instruments
- Watchlists reference `market_instruments.id` from Phase 9.
- No duplicate symbols, company names, or provider instrument records are created.
- Removing an item deletes the `watchlist_items` membership row without deleting the underlying `market_instruments` record.

### 2. User Security & Identity Isolation
- Every watchlist belongs to a `users.id` (UUID FK).
- Development identity header (`x-user-id`) is strictly required and enforced server-side.
- **No Runtime Fallback Identity**: No automatic, default, or fallback user identity exists anywhere in runtime request handling. Requests without a valid `x-user-id` header return `401 Unauthorized`.
- The test UUID `00000000-0000-4000-a000-000000000001` exists solely as an explicit test fixture in automated tests and frontend development components; it is never automatically assumed or resolved as a fallback server-side.
- User B cannot read, rename, archive, restore, add items to, or remove items from User A's watchlist.
- Missing, empty, or malformed `x-user-id` header returns `401 Unauthorized`.

### 3. Duplicate Prevention Invariant
- Prevented at multiple layers:
  - Database: `UNIQUE INDEX idx_watchlist_items_unique (watchlist_id, instrument_id)`.
  - Service: `isItemInWatchlist` pre-check returning `409 Conflict`.
  - UI: "Added" disabled button state in search modal.

### 4. Non-Destructive Archiving & Restore
- Watchlists use non-destructive archiving (`status = 'ARCHIVED'`).
- Archived watchlists remain readable, but adding or deleting items returns `422 Unprocessable Entity`.
- `POST /api/v1/watchlists/:id/restore` reactivates archived watchlists.

### 5. Market Data & Freshness Integration
- Watchlist items dynamically fetch real-time/cached quotes via `IMarketRepository.getQuoteByInstrumentId`.
- Preserves Phase 9 freshness badges (`LIVE`, `EOD`, `STALE`, `UNAVAILABLE`).
- Zero Fake Data: Missing or unavailable provider quotes render `UNAVAILABLE` or `—` cleanly without mock prices.

### 6. ResizableTable Primitive
- The Watchlist main table uses global `ResizableTable`.
- Every column (`Symbol`, `Instrument Name`, `Exchange / Market`, `Type`, `Last Price`, `Change / %`, `Session`, `Freshness`, `Actions`) is user-resizable.

---

## Database Migrations
- Migration: `apps/api/src/db/migrations/0008_watchlist_schema.sql`
- Tables created: `watchlists`, `watchlist_items`.

---

## Phase Boundary Audit

| Module | Status | Boundary Rule |
|---|---|---|
| **Phase 11 — Watchlist** | **ACTIVE / IMPLEMENTED** | Consumes Phase 9 & 10 APIs |
| **Phase 12 — Portfolio** | **NOT IMPLEMENTED** | Zero holdings or portfolio tables |
| **Phase 13 — P&L & Analytics** | **NOT IMPLEMENTED** | Zero P&L calculations |
| **Phase 14 — Alerts** | **NOT IMPLEMENTED** | Zero price alert triggers |
| **Phase 15 — Dashboard Market Widgets**| **NOT IMPLEMENTED** | Zero dashboard market widgets |
| **Phase 16 — Financial Reports** | **NOT IMPLEMENTED** | Zero report export engine |
