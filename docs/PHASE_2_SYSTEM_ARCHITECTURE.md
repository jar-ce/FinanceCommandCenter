# FINANCE COMMAND CENTER (APEX OS)
## Phase 2 System Architecture & Monorepo Foundation (Verified)

---

### 1. Executive Summary

**Finance Command Center** adopts a **Modular Monolith (Clean / Hexagonal Architecture)** design. The application brings together **Digital Khata**, **IPO Center**, **IPO Tracker**, **IPO Allotment Verification**, **Stock Market Data (NSE/BSE)**, **Watchlists**, **Portfolio**, **P&L Analytics**, **Alerts**, and **Reports** into a unified workspace.

This document defines the system boundaries, module dependencies, provider abstractions, financial calculation mechanics, database rules, security model, and workspace setup established during Phase 2.

---

### 2. High-Level Layered Architecture

The system enforces a strict unidirectional dependency flow across 6 architectural layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      1. PRESENTATION LAYER (Vite + React 19)                 │
│  - App Shell, Command Rail, Command Deck Bar, Ctrl+K Command Palette       │
│  - Reusable Data Tables (Resizable Columns), Modals, Custom CSS Tokens       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP REST / WebSockets
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      2. API / TRANSPORT LAYER (Fastify)                      │
│  - Endpoint Routers (/api/v1/...), Zod Request Validation Middleware         │
│  - HTTP Status Code Mappers, Rate Limiter, Error Envelopes                   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ DTOs & Command Messages
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      3. APPLICATION LAYER (Use Cases)                        │
│  - Orchestrates domain interactions (e.g. LogTradeUseCase, PostLedgerEntry) │
│  - Transaction Boundary Management & Application Authorization               │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ Pure Domain Entities
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      4. DOMAIN LAYER (Business Core)                         │
│  - Pure Domain Entities & Invariants (Khata Balance, FIFO Cost Basis)        │
│  - Arbitrary-Precision Arithmetic Engine (decimal.js)                        │
│  - Domain Event Emitters (e.g., LedgerEntryPosted, PriceAlertTriggered)      │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ Repository & Adapter Contracts
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      5. INFRASTRUCTURE & ADAPTER LAYER                       │
│  - Drizzle ORM PostgreSQL Repositories, Redis/In-Memory LRU Caches           │
│  - Market Data Provider Adapters (IMarketDataProvider Implementation)         │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ SQL Queries / HTTP Calls
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      6. DATABASE & EXTERNAL SERVICES                        │
│  - PostgreSQL Database (NUMERIC(18, 4) Precision, Window Functions)         │
│  - External Market Data & Registrar Services                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Layering Invariants:
- **Presentation Layer** must never import ORM repositories or execute raw database queries.
- **Domain Layer** must have zero dependencies on frameworks, HTTP routers, or UI components.
- **Infrastructure Adapters** implement domain interfaces (e.g., `IMarketDataProvider`) to decouple external provider changes from business logic.

---

### 3. Module Boundaries & Dependency Topology

The application is structured as a **Modular Monolith** containing **14 isolated domain modules**:

```
 1. Authentication (auth)          8. Watchlist (watchlist)
 2. Digital Khata (khata)          9. Portfolio (portfolio)
 3. IPO Center (ipo)              10. P&L & Analytics (pnl)
 4. IPO Tracker (ipo-tracker)     11. Alerts (alerts)
 5. IPO Allotment (ipo-allotment) 12. Reports (reports)
 6. Stock Market (stocks)         13. Settings (settings)
 7. Market Data (market-data)     14. Notifications (notifications)
```

#### Non-Dependency & Anti-Circular Rules:
1. **Portfolio Module** may depend on `Market Data` abstraction interfaces.
2. **Market Data Module** MUST NOT depend on `Portfolio` or `Watchlist`.
3. **IPO Module** may depend on `IPO Data` provider abstractions.
4. **IPO Provider Adapters** MUST NOT depend on UI code or Portfolio modules.
5. **Khata Module** operates independently of Stock Market feeds.

---

### 4. Market Data Architecture & Provider Abstraction

Market data ingestion relies strictly on the `IMarketDataProvider` interface to prevent vendor lock-in.

```
MarketDataService
      │
      ├──> IMarketDataProvider (Interface Contract)
      │          ├──> MockMarketDataProvider Adapter (Verified)
      │          ├──> YahooFinanceAdapter (To Be Verified)
      │          └──> BrokerApiAdapter (Zerodha/Upstox - To Be Verified)
      │
      └──> In-Memory LRU Cache (Live Quotes: 5s TTL, EOD Candles: 24h TTL)
```

#### Resiliency & Caching Strategy:
- **Quote Caching**: Live quotes are cached in-memory with a 5-second TTL to respect rate limits.
- **Stale Data Detection**: Quotes older than 30 seconds are tagged with `dataFreshness: "DELAYED"` or `"STALE"`.
- **Fallback Hierarchy**: Primary Provider $\rightarrow$ Secondary Provider $\rightarrow$ Cached EOD Quote $\rightarrow$ Mock Generator (in test mode).

---

### 5. IPO Data & Allotment Architecture

#### Compliance-First Allotment Strategy:
Automated allotment verification strictly complies with legal mandates and registrar security policies:
- **Zero CAPTCHA / OTP Bypass**: The system will **never** automatically attempt to solve CAPTCHAs, bypass OTPs, scrape user credentials, or circumvent anti-bot protections.
- **Dual Verification Path**:
  1. *Public API Verification*: Supported where official, structured public lookup APIs exist.
  2. *Guided Manual Verification*: For registrars requiring CAPTCHA/OTP (Link Intime, KFintech, Bigshare), the app generates direct pre-filled links and structured step-by-step verification modals for manual user verification.

---

### 6. Domain-Specific Financial Precision Policy

Floating-point numbers (`number` in JS, `FLOAT` in SQL) are strictly prohibited for financial calculations. The precision policy categorizes domain metrics:

| Financial Field Category | Database Column Type | Storage Range / Scale | Frontend Display Rounding |
| :--- | :--- | :--- | :--- |
| **Monetary Currency (₹)** | `NUMERIC(18, 4)` | Up to ₹99,999,999,999,999.9999 | 2 decimal places (`ROUND_HALF_UP`) |
| **Stock Quantities (Qty)** | `NUMERIC(18, 4)` | Fractional shares & exact units | Up to 4 decimal places |
| **Stock Prices & LTP (₹)** | `NUMERIC(18, 4)` | Sub-paisa precision pricing | 2 decimal places (`ROUND_HALF_UP`) |
| **Percentages & Returns (%)** | `NUMERIC(8, 4)` | Up to 9,999.9999% | 2 decimal places + `%` |
| **Valuation Ratios & Multiples**| `NUMERIC(10, 4)`| P/E, P/B, EV/EBITDA ratios | 2 decimal places |

#### Calculation Standard:
- All core application arithmetic uses **`decimal.js`**.
- Intermediate calculations preserve full 4-decimal scale. Rounding (`ROUND_HALF_UP`) occurs exclusively at the presentation boundary.

---

### 7. Zod & Fastify Request Validation Strategy

To prevent schema duplication, **Zod** is established as the single canonical schema definition layer:

```
HTTP Request Body / Params / Query
              ↓
  Fastify Zod Middleware Validation (fastify-type-provider-zod)
              ↓
  Inferred Strongly-Typed DTO
              ↓
  Application Layer Use Case
```

- **Canonical Schemas**: Zod schemas defined in `packages/shared-types` or module DTOs validate incoming requests and infer TypeScript types automatically without duplicating JSON Schemas.

---

### 8. PostgreSQL Development & Production Strategy

- **Target Database**: PostgreSQL for both Development and Production (ensuring 100% SQL, decimal, and window-function compatibility).
- **Current Host Status**: PostgreSQL server is **NOT running** natively on the local Windows host (Port 5432 inactive).
- **Phase 3 Local Dev Strategy**: During Phase 3 database implementation, local development will utilize either:
  1. A local PostgreSQL instance or Docker container, OR
  2. `@electric-sql/pglite` (Embedded WebAssembly PostgreSQL engine running inside Node.js for zero-setup local dev).

---

### 9. API & Transport Architecture

- **Protocol**: HTTP REST + WebSockets (for live price tickers).
- **Base URL**: `/api/v1/...`
- **Request Validation**: Mandatory Zod schema validation at Fastify middleware layer.
- **Response Envelopes**:
  ```json
  {
    "success": true,
    "data": { ... },
    "timestamp": "2026-09-15T08:58:00.000Z"
  }
  ```

---

### 10. Workspace Directory Structure & Status

```
D:\FinanceCommandCenter\
├── docs/                             # Architecture Reports & Specifications
│   ├── PHASE_0_ARCHITECTURE_REPORT.md
│   ├── PHASE_1_DESIGN_SYSTEM.md
│   └── PHASE_2_SYSTEM_ARCHITECTURE.md
├── apps/
│   ├── web/                          # Frontend Application Shell (Vite + React 19 + TypeScript)
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/                          # Backend API Server Shell (Node.js + Fastify + TypeScript)
│       ├── src/
│       │   └── server.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared-types/                 # Shared DTOs & Architectural Interfaces
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── .env.example                      # Template Environment Configuration
├── .gitignore                        # Git Exclusion Rules
├── package.json                      # Workspace Root Configuration
└── tsconfig.base.json                # Shared Base TypeScript Configuration
```

---

### 11. Security & Git Safety

- **No Committed Secrets**: Zero passwords, API keys, or private tokens committed.
- **Git Exclusion**: `.gitignore` excludes `.env`, `node_modules`, `dist`, `coverage`, and OS files.
- **Verified Allowed**: `.env.example` template committed.

---

### 12. Verification Execution Results

- **Workspace Resolution**: `npm install` executed cleanly (76 packages added, 0 vulnerabilities).
- **TypeScript Compilation**: `npm run type-check` (`tsc -b packages/shared-types apps/api apps/web --noEmit`) passed with **0 errors**.
- **Path Alias Resolution**: `@finance-command-center/shared-types` imported in `apps/api/src/server.ts` and compiled cleanly.

---

### 🚨 CURRENT STATE & RECOMMENDED NEXT PHASE

**PHASE 2 COMPLETE — PENDING FINAL APPROVAL**

**Recommended Next Phase**: **PHASE 3 — Database & Backend Foundation**
*(Configuring Drizzle ORM database connection, initial PostgreSQL schema models, Fastify server setup, base middleware, and health check endpoints).*

Waiting for explicit confirmation before proceeding to Phase 3.
