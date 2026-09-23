# Phase 9 — Stock Market Data Architecture

## Architectural Overview
Phase 9 establishes the canonical market data infrastructure for **Finance Command Center — APEX OS**.

The system provides a decoupled, provider-agnostic framework for managing financial security masters, price quote caching, freshness state transitions, and high-precision financial arithmetic.

```
                  +-----------------------------------+
                  |        Fastify REST Layer         |
                  |  GET /api/v1/market/instruments   |
                  |  GET /api/v1/market/status        |
                  |  POST /api/v1/market/instruments* |
                  |  (*Protected Dev/Admin Mutation)   |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  |        MarketDataService          |
                  |  - Decimal.js Price Engine        |
                  |  - Cache TTL & Stale Rules        |
                  +---------+---------------+---------+
                            |               |
             +--------------+               +--------------+
             |                                             |
             v                                             v
+-------------------------+                   +-------------------------+
|   IMarketRepository     |                   |   IMarketDataProvider   |
| (Drizzle / PostgreSQL)  |                   |  (Development / Real)   |
| - market_instruments    |                   |  - Zero Fake Data       |
| - market_quotes         |                   |  - Provider DTOs        |
+-------------------------+                   +-------------------------+
```

---

## Key Technical Decisions & Invariants

### 1. Security Identity & Master Entity Architecture
- **Canonical Internal Identity (`market_instruments.id`)**: Every security is assigned an immutable internal UUID v4 upon registration.
- **Provider Instrument Mapping (`provider`, `providerInstrumentId`)**: Vendor-specific identifiers (e.g. `NSE_RELIANCE_EQ`, ISIN) are preserved explicitly as metadata attributes. Conceptual multi-provider mappings retain the canonical internal UUID while mapping to respective vendor IDs.
- **Exchange Identity & Uniqueness**: Composite unique index `idx_market_instruments_exch_sym` on `(exchange, symbol)` enforces exchange-symbol uniqueness across the security master.

### 2. Mutation Endpoint Security & Administrative Boundary
- Public read endpoints (`GET /instruments`, `GET /instruments/:id`, `GET /instruments/:id/quote`, `GET /instruments/:id/history`, `GET /status`) serve public market reference data.
- Mutating endpoint (`POST /api/v1/market/instruments`) is protected by APEX OS development/admin identity validation (`x-user-id` header matching a valid UUID). Anonymous requests attempting to inject arbitrary tickers are rejected with `401 Unauthorized`.

### 3. Financial History Protection & Delete Safety
- Foreign key `market_quotes.instrument_id` references `market_instruments.id` using `ON DELETE RESTRICT`.
- Securities must never be hard-deleted from the database when market quote observations exist. Instrument lifecycle transitions use the `status` column (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `DELISTED`).

### 4. Zero Fake Data Policy
- The default development provider (`DevelopmentMarketDataProvider`) returns `status: 'UNAVAILABLE'` with empty datasets (`data: []` or `null`).
- No fake stock tickers, mock prices, or fabricated OHLC candles are generated in development mode.

### 5. Price Freshness & Stale Data Degradation Rules
- Quote responses include explicit timestamps (`asOf` exchange observation time vs `retrievedAt` cache fetch time) and status indicators (`dataFreshness`, `marketStatus`).
- **Fresh State**: Cached quotes within TTL (15s) marked `LIVE`/`EOD` are served directly.
- **Provider Update State**: Stale quotes query the provider; on success, prices update with `dataFreshness: 'LIVE'`.
- **Provider Failure State**: Provider outages preserve existing cached prices but degrade status to `dataFreshness = 'STALE'` and `marketStatus = 'UNKNOWN'`. Stale prices are NEVER labeled as `LIVE` or `AVAILABLE`.

### 6. Decimal.js High-Precision Arithmetic
- All financial calculations (`change = lastPrice - previousClose`, `changePercent = (change / previousClose) * 100`) execute via `decimal.js`.
- Verified exact precision (e.g., `0.1 + 0.2` evaluates to exact `'0.3000'`) without IEEE-754 floating-point drift.

---

## Database Schemas

### `market_instruments`
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary Key (Default: `gen_random_uuid()`) |
| `symbol` | VARCHAR(50) | NO | Ticker symbol (e.g., `RELIANCE`, `TCS`) |
| `display_name` | VARCHAR(255) | NO | Security display name |
| `exchange` | VARCHAR(50) | NO | Exchange identifier (`NSE`, `BSE`, `NASDAQ`, etc.) |
| `market` | VARCHAR(50) | NO | Market segment (Default: `IN`) |
| `security_type` | VARCHAR(50) | NO | Instrument class (`EQUITY`, `ETF`, `MUTUAL_FUND`, `INDEX`, etc.) |
| `currency` | VARCHAR(10) | NO | Currency symbol (`INR`, `USD`) |
| `provider` | VARCHAR(50) | NO | Primary data provider ID |
| `provider_instrument_id` | VARCHAR(255) | YES | Provider-specific instrument code |
| `status` | VARCHAR(50) | NO | Lifecycle status (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `DELISTED`) |
| `created_at` / `updated_at` | TIMESTAMP WITH TIME ZONE | NO | Record timestamps |

### `market_quotes`
| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary Key (Default: `gen_random_uuid()`) |
| `instrument_id` | UUID | NO | Foreign Key to `market_instruments.id` (**ON DELETE RESTRICT**) |
| `last_price` | NUMERIC(18, 4) | YES | Last traded price |
| `previous_close` | NUMERIC(18, 4) | YES | Previous session closing price |
| `open` / `high` / `low` / `close` | NUMERIC(18, 4) | YES | Session OHLC prices |
| `volume` | **BIGINT** | NO | Traded volume (Default: `0`) |
| `change` | NUMERIC(18, 4) | NO | Absolute price change (`Decimal.js`) |
| `change_percent` | NUMERIC(8, 4) | NO | Percentage change (`Decimal.js`) |
| `currency` | VARCHAR(10) | NO | Currency symbol (`INR`) |
| `market_status` | VARCHAR(50) | NO | Market state (`OPEN`, `CLOSED`, `PRE_OPEN`, `POST_CLOSE`, `HALTED`, `UNKNOWN`) |
| `data_freshness` | VARCHAR(50) | NO | Freshness state (`LIVE`, `DELAYED`, `EOD`, `STALE`, `UNAVAILABLE`) |
| `as_of` | TIMESTAMP WITH TIME ZONE | YES | Exchange market observation timestamp |
| `retrievedAt` | TIMESTAMP WITH TIME ZONE | NO | System cache retrieval timestamp |
| `provider` | VARCHAR(50) | NO | Provider identifier |
