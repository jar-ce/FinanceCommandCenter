# APEX OS — Market Data Architecture Reference

## Overview
This document defines the core contracts, abstractions, database types, and security boundaries governing stock market data within **Finance Command Center — APEX OS**.

## Core Architectural Invariants

1. **Internal Canonical Identity**:
   Securities are uniquely identified across APEX OS by an internal UUID v4 primary key (`market_instruments.id`). Provider-assigned identifiers (`providerInstrumentId`) are preserved as external metadata mappings.

2. **Database Types & Financial History Safety**:
   - Volume column type is explicitly defined as PostgreSQL **`BIGINT`** (`bigint('volume', { mode: 'number' })`).
   - Prices use `NUMERIC(18, 4)` and percentages use `NUMERIC(8, 4)`.
   - `market_quotes.instrument_id` references `market_instruments.id` using **`ON DELETE RESTRICT`** to prevent catastrophic deletion of price history.

3. **Provider Abstraction & Status Model**:
   Provider-specific DTOs are encapsulated within `IMarketDataProvider` implementations. Domain layers consume normalized `MarketInstrumentRecord` and `MarketQuoteRecord` models. Standard provider statuses: `AVAILABLE`, `UNAVAILABLE`, `RATE_LIMITED`, `AUTH_REQUIRED`, `PROVIDER_ERROR`, `INVALID_RESPONSE`, `STALE`.

4. **Timestamp & Freshness Semantics**:
   - `asOf`: Timestamp when the price observation occurred on the exchange.
   - `retrievedAt`: Timestamp when APEX OS cached the record.
   - Cached quotes within TTL (15s) are served as `LIVE`/`EOD`. Provider outages fall back to cached observations marked `STALE` and `marketStatus: 'UNKNOWN'`. Stale prices are never represented as `LIVE`.

5. **High-Precision Financial Calculations**:
   All monetary computations use `decimal.js` with exact 4-decimal precision. Native JavaScript floating-point arithmetic is prohibited.

6. **Zero Fake Data Policy**:
   Development stubs return `UNAVAILABLE` status with empty payloads (`data: []` or `null`). No fake tickers or prices are generated.

7. **Security & Access Boundaries**:
   - Public read endpoints: `GET /api/v1/market/instruments`, `GET /api/v1/market/instruments/:id`, `GET /api/v1/market/instruments/:id/quote`, `GET /api/v1/market/instruments/:id/history`, `GET /api/v1/market/status`.
   - Protected mutation endpoint: `POST /api/v1/market/instruments` requires valid `x-user-id` header (development/admin identity boundary).
