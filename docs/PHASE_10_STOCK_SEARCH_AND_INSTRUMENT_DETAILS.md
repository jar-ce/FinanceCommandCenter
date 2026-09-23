# Phase 10 — Stock Search & Instrument Details UI Architecture

## Architectural Overview
Phase 10 implements the **Stock Search & Instrument Details UI** for **Finance Command Center — APEX OS**.

This phase connects the Phase 9 backend market-data architecture (`/api/v1/market/instruments`, `/api/v1/market/instruments/:id`, `/api/v1/market/instruments/:id/quote`, `/api/v1/market/instruments/:id/history`) to a financial research workspace.

```
+---------------------------------------------------------------------------------+
|                                APEX OS Web App                                  |
|                                                                                 |
|  +-------------------------------------+   +---------------------------------+  |
|  |     StockSearchPage (/stocks)       |   |  StockDetailsPage (/stocks/:id) |  |
|  | - Debounced Query (300ms)           |   | - Canonical Instrument Header   |  |
|  | - Exchange & Type Filters           |   | - Quote Metrics & Session State |  |
|  | - Global ResizableTable Primitive   |   | - Observation/Retrieval Times   |  |
|  | - Empty, Loading, No-Results States |   | - SVG Historical Price Sparkline|  |
|  +------------------+------------------+   +----------------+----------------+  |
+---------------------|---------------------------------------|-------------------+
                      |                                       |
                      v                                       v
+---------------------------------------------------------------------------------+
|                           Fastify REST API Gateway                              |
|   GET /api/v1/market/instruments              GET /api/v1/market/instruments/:id   |
|   GET /api/v1/market/instruments/:id/quote   GET /api/v1/market/instruments/:id/history|
+---------------------------------------------------------------------------------+
```

---

## Technical Design & Invariants

### 1. Stock Search Workspace (`/stocks`)
- **Debounced Search Input**: Search queries (symbol or company display name) are debounced by 300ms to eliminate redundant API invocations during typing.
- **Filter Controls**: Exchange filtering (`NSE`, `BSE`, `NASDAQ`, `NYSE`, `MUTUAL_FUND_IN`, `OTHER`) and Security Type filtering (`EQUITY`, `ETF`, `MUTUAL_FUND`, `INDEX`, `BOND`, `DERIVATIVE`, `OTHER`).
- **Global ResizableTable Primitive**: All columns (`Symbol`, `Instrument Name`, `Exchange`, `Security Type`, `Currency`, `Status`, `Data Source`, `Actions`) are user-resizable.
- **Navigation**: Row clicks or clicking "Details" navigates to `/stocks/:id`.

### 2. Instrument Details Workspace (`/stocks/:id`)
- **Canonical Instrument Header**: Symbol, Company Name, Exchange Badge, Security Type, Currency Denomination, Lifecycle Status, and Freshness Indicator.
- **Quote Metrics Display**: Last Price, Previous Close, Change, Change %, Volume, Market Session (`OPEN`, `CLOSED`, `PRE_OPEN`, `POST_CLOSE`, `HALTED`, `UNKNOWN`), and Freshness (`LIVE`, `DELAYED`, `EOD`, `STALE`, `UNAVAILABLE`).
- **Timestamp Semantics**:
  - `asOf`: Exchange market observation timestamp.
  - `retrievedAt`: APEX OS internal cache retrieval timestamp.
- **Stale Data Notice**: If `dataFreshness === 'STALE'`, a warning banner alerts the user that the displayed price is cached historical data.
- **Historical Price Visualization**: SVG line chart visualizing OHLC candle history for intervals (`1D`, `1W`, `1M`, `1Y`).
- **Zero Fake Data Invariant**: If market data is `UNAVAILABLE`, the UI explicitly displays `UNAVAILABLE` without inventing fake tickers, stock prices, or candles.

---

## Route Registration
- `/stocks`: `StockSearchPage`
- `/stocks/:id`: `StockDetailsPage`
- `/markets/stocks`: `StockSearchPage`

---

---

## Final Verification Audit & Contract Integrity

### 1. Chart Architecture & Implementation
- **Dependency Audit**: Verified that no external charting library (`lightweight-charts`, `chart.js`) is installed in `apps/web/package.json` or root `package.json`.
- **Phase 10 Implementation**: Lightweight, responsive SVG sparkline visualization consuming real `GET /api/v1/market/instruments/:id/history` API data.
- **Contract Integrity**:
  - Plots points strictly using returned candle array `close` prices.
  - Zero synthetic candles, zero fake interpolation, zero mock points.
  - Displays empty state if `history.length === 0`.

### 2. Quote API Contract Verification
Every displayed quote field is 100% supported by the canonical Phase 9 `marketQuotes` schema (`apps/api/src/db/schema/market-quotes.ts`) and `MarketQuoteRecord` interface (`packages/shared-types`):
- `lastPrice`, `previousClose`, `open`, `high`, `low`, `volume`, `change`, `changePercent`, `currency`, `marketStatus`, `dataFreshness`, `asOf`, `retrievedAt`.
- Zero fallback constants or fake values. Null/missing values display formatted `—`.

### 3. Freshness Semantics
- `LIVE` (Green), `EOD` (Blue), `STALE` (Amber banner), `UNAVAILABLE` (Gray box).
- `asOf` explicitly labelled as **Exchange Observation Time**.
- `retrievedAt` explicitly labelled as **APEX Retrieval Time**.

### 4. Zero Fake Data & Phase Boundaries
- Zero hardcoded stock tickers, fake prices, or mock candles.
- Global `ResizableTable` used for search results with user-resizable columns.
- Strict API boundary maintained: Browser code only interacts via Fastify REST endpoints.
- Phases 11–16 functionality (**NOT IMPLEMENTED**).

### 5. Final Verification Test Metrics
- **API Tests**: 77 passed (across 9 test suites)
- **Web Tests**: 26 passed (across 8 test suites)
- **Total Tests**: 103 passed (0 failed)
- **Type Check**: Passed (`npx tsc` 0 errors)
- **Production Web Build**: Passed (`apps/web` Vite build succeeded in 1m 04s)

