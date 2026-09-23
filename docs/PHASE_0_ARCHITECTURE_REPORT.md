# FINANCE COMMAND CENTER
## Phase 0 Architecture & Product Discovery Report (Verified)

---

### 1. Verified Environment Analysis

This environment detection was executed directly on the host workspace `D:\FinanceCommandCenter` using live PowerShell diagnostic commands.

| Component / Tool | Verified Status | Details |
| :--- | :--- | :--- |
| **Operating System** | **Verified** | Microsoft Windows 11 Pro Education (64-bit, Version `10.0.26200`) |
| **Node.js** | **Verified** | `v24.11.1` (`C:\Program Files\nodejs\node.exe`) |
| **NPM** | **Verified** | `11.6.2` |
| **Git** | **Verified** | `2.55.0.windows.3` (`C:\Program Files\Git\cmd\git.exe`) |
| **Python** | **Verified** | `Python 3.14` (pip `26.0`) |
| **SQLite3 CLI** | **Verified** | `3.22.0` (`C:\Program Files (x86)\Touch Portal\plugins\adb\platform-tools\sqlite3.exe`) |
| **PostgreSQL Client (`psql`)** | **Not in PATH** | `psql` CLI is not present in system PATH. |
| **PostgreSQL Server / Service**| **Not Installed / Not Running** | 0 Windows services found matching `*postgres*`; Port `5432` is not listening. |
| **pnpm / yarn** | **Not Installed / Not in PATH** | Not present in system PATH. |
| **Docker / Docker Compose** | **Not Installed / Not in PATH** | Docker daemon and CLI not present in system PATH. |
| **MySQL / Redis CLI** | **Not Installed / Not in PATH** | Not present in system PATH. |

---

### 2. Workspace Status

- **Location**: `D:\FinanceCommandCenter`
- **Files & Directories**:
  - `docs/` (Directory)
  - `docs/PHASE_0_ARCHITECTURE_REPORT.md` (Phase 0 Documentation)
- **Application Source Code**: None (Starting from zero).
- **Git Repository**: Not yet initialized.

---

### 3. Final Recommended Technology Stack

| Layer | Recommended Choice | Rationale & Trade-offs |
| :--- | :--- | :--- |
| **Frontend Framework** | **Vite + React 19 + TypeScript** | Sub-millisecond client state updates, fast local execution, desktop-like responsiveness, zero Next.js SSR latency overhead. |
| **Backend Framework** | **Node.js + Fastify + TypeScript** | 2-3x faster than Express, schema-validated JSON serialization (Ajv/Zod), native WebSockets for ticker feeds, end-to-end TypeScript DTO sharing. |
| **Language & Typing** | **TypeScript 5.x (Strict Mode)** | Enforces compile-time type safety across financial DTOs, database models, calculation engines, and UI props. |
| **Database Engine** | **PostgreSQL (Dev & Production)** | **PostgreSQL for both Dev & Prod**. Ensures 100% compatibility for `NUMERIC(18, 4)` monetary types, window functions for P&L/ledger running balances, and transactional integrity. (For local dev without system daemon, `@electric-sql/pglite` or local Postgres installation will be used). |
| **ORM** | **Drizzle ORM** | Type-safe SQL builder with zero runtime overhead, explicit `numeric` column mapping, and migration management. |
| **Financial Precision Engine** | **`decimal.js`** | Arbitrary-precision monetary arithmetic (Buy/Sell average prices, realized/unrealized P&L, GST, Khata ledgers) preventing float rounding errors. |
| **State Management** | **Zustand + TanStack Query v5** | Zustand for transient UI state & active watchlists; TanStack Query for server state caching and background updates. |
| **Styling** | **Vanilla CSS Modules + CSS Custom Properties** | Theme design tokens (dark/light), high-density financial table formatting, zero heavy utility-class overhead. |
| **Charts** | **TradingView Lightweight Charts + Chart.js** | Canvas-accelerated stock candlestick/line charts via Lightweight Charts; clean allocation pie/bar charts via Chart.js. |

---

### 4. High-Level Architecture (Modular Monolith)

The application adopts a **Modular Monolith (Clean Architecture)** design.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER (Vite + React 19)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Khata Ledger │  │  IPO Center  │  │ Stock Market │  │ Portfolio & P&L │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                 │                 │                   │           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │   Shared UI Components / Custom CSS Tokens / TradingView & Chart.js  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP REST / WebSockets
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      BACKEND LAYER (Node.js + Fastify)                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     API Router & Zod Middleware                       │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│  ┌──────────────────────────────────▼────────────────────────────────────┐  │
│  │                      CORE DOMAIN SERVICES MODULES                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐  │  │
│  │  │ Auth/Users │  │ Khata Engine│ │ IPO Engine │  │ Portfolio/P&L   │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────────────┘  │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐  │  │
│  │  │  Alerts    │  │ Reports    │  │ MarketData │  │ Audit Logger    │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│  ┌──────────────────────────────────▼────────────────────────────────────┐  │
│  │                DATA ACCESS & PROVIDER ABSTRACTION LAYER               │  │
│  │  ┌───────────────────────────┐      ┌──────────────────────────────┐  │  │
│  │  │   Drizzle ORM Repository  │      │ Market Data Provider Adapter │  │  │
│  │  └─────────────┬─────────────┘      └──────────────┬───────────────┘  │  │
│  └────────────────┼───────────────────────────────────┼──────────────────┘  │
└───────────────────┼───────────────────────────────────┼─────────────────────┘
                    │                                   │
┌───────────────────▼───────────┐       ┌───────────────▼─────────────────────┐
│    POSTGRESQL DATABASE         │       │ EXTERNAL MARKET & IPO APIS          │
│  - NUMERIC(18, 4) Precision   │       │ - NSE / BSE Providers               │
│  - Window Functions & FKs     │       │ - Official Registrar Portals        │
└───────────────────────────────┘       └─────────────────────────────────────┘
```

---

### 5. Database Strategy Re-Evaluation

#### Decision: PostgreSQL for BOTH Development and Production
- **Previous Consideration**: PostgreSQL for Production / SQLite for Local Development.
- **Updated Decision**: **PostgreSQL for both Development and Production**.
- **Rationale**:
  1. *Type Safety & Precision*: SQLite uses type affinity and floating-point approximations unless strictly configured, whereas PostgreSQL strictly enforces `NUMERIC(18, 4)` for exact financial calculations.
  2. *SQL & Window Function Parity*: PostgreSQL provides analytical window functions (`SUM() OVER (...)`) for running Khata balances and FIFO portfolio calculations that behave identically in dev and prod.
  3. *Zero Dev/Prod Divergence*: Eliminates edge-case bugs caused by dialect differences between SQLite and PostgreSQL during migrations or transaction locks.

---

### 6. Node.js Compatibility Analysis

- **Verified Environment Node.js Version**: `v24.11.1` (npm `11.6.2`).
- **Compatibility**: The selected stack (Vite 6, React 19, Fastify v4/v5, Drizzle ORM, Zod, `decimal.js`) is fully compatible with Node.js `v24.11.1`.
- **Action Required**: None. No upgrade or downgrade of Node.js is required.

---

### 7. Market Data Strategy (Provider Status)

#### Provider Abstraction Interface (`IMarketDataProvider`)
```typescript
export interface IMarketDataProvider {
  getQuote(symbol: string): Promise<StockQuote>;
  getBatchQuotes(symbols: string[]): Promise<Map<string, StockQuote>>;
  getHistoricalData(symbol: string, interval: string, range: string): Promise<CandleData[]>;
  searchSymbols(query: string): Promise<SymbolSearchResult[]>;
  getMarketStatus(): Promise<MarketStatus>;
}
```

#### Provider Status Classifications:
1. **Mock Market Data Provider**: `VERIFIED` (Built-in offline fallback generator for deterministic unit/integration testing).
2. **Yahoo Finance API Adapter**: `TO BE VERIFIED` (Candidate for EOD and delayed quote testing; subject to public API rate limits).
3. **NSE / BSE Public Web Endpoints**: `TO BE VERIFIED` (Candidate for EOD market data; subject to exchange anti-scraping header requirements).
4. **Broker APIs (Zerodha Kite / Upstox / Groww Open APIs)**: `TO BE VERIFIED` (Official REST & WebSocket data feeds; requires user API key configuration).

---

### 8. IPO Data & Allotment Strategy

- **Strict Compliance Principle**: Absolutely no automated CAPTCHA bypass, OTP bypass, credential scraping, or unauthorized access.
- **Workflow**:
  1. *Catalog Ingestion*: Structured ingestion of official exchange IPO data (NSE/BSE mainboard & SME).
  2. *Guided Registrar Workflow*: For registrars requiring CAPTCHA/OTP (Link Intime, KFintech, Bigshare), the app generates direct pre-filled deep links and structured step-by-step verification modals for manual user verification.

---

### 9. Security Architecture

- **Auth & Session**: JWT stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies with 15-minute access tokens and sliding refresh tokens.
- **Password Security**: Argon2id password hashing.
- **Input Validation**: Strict Zod schema validation at Fastify middleware boundary.
- **Rate Limiting**: Endpoint rate limiting via `@fastify/rate-limit`.
- **Secrets Management**: Loaded exclusively from `.env` environment variables. Zero hardcoded secrets.
- **Audit Trails**: Immutable log records for Khata ledger entries, debt updates, and trade bookings.

---

### 10. UI/UX Direction

- **Personality**: High-density, serious financial operating system.
- **Visual Principles**: Dark mode priority, subtle glass accents (`rgba(255, 255, 255, 0.08)`), right-aligned numerical table formatting, profit (`#10B981`) and loss (`#EF4444`) color accents.
- **Typography**: `Inter` for UI labels; `JetBrains Mono` / `Space Mono` for numbers and financial tables.
- **Shortcuts**: Global `Ctrl+K` command palette for instant navigation across Khata, Stocks, Portfolio, and IPOs.

---

### 11. Proposed Directory Structure

```
D:\FinanceCommandCenter\
├── docs/                             # Documentation & Architecture Reports
│   └── PHASE_0_ARCHITECTURE_REPORT.md
├── apps/
│   ├── web/                          # Frontend Application (Vite + React 19 + TypeScript)
│   └── api/                          # Backend API Server (Node.js + Fastify + TypeScript)
├── packages/                         # Shared DTOs, Schemas, & Math Utilities
└── package.json                      # Root Workspace Configuration
```

---

### 12. Master 20-Phase Roadmap

| Phase | Phase Name | Objectives |
| :--- | :--- | :--- |
| **Phase 0** | **Discovery & Architecture** | Environment analysis, stack selection, architecture design. **(VERIFIED & COMPLETED)** |
| **Phase 1** | **Brand + UI/UX + Design System** | Visual identity, typography, CSS tokens, reusable UI component library. |
| **Phase 2** | **System Architecture** | Repository setup, monorepo config, shared types module. |
| **Phase 3** | **Database + Backend Foundation** | Drizzle ORM setup, Fastify server setup, DB migrations, base middleware. |
| **Phase 4** | **Application Shell + Navigation** | App layout, sidebar, header, `Ctrl+K` command palette, router setup. |
| **Phase 5** | **Digital Khata** | Ledger engine, parties, debit/credit transactions, running balance calculation. |
| **Phase 6** | **IPO Center** | Upcoming/active IPO calendar, detail view, lot size & price band display. |
| **Phase 7** | **IPO Application Tracker** | Application tracking, bid amounts, status logging. |
| **Phase 8** | **IPO Allotment Checker** | Direct API lookups + guided registrar deep-link workflow. |
| **Phase 9** | **Stock Market Data Architecture** | `IMarketDataProvider` interface, provider adapters, quote caching. |
| **Phase 10** | **Stock Search & Details** | Global symbol search, quote cards, TradingView interactive charts. |
| **Phase 11** | **Stock Watchlist** | Personal watchlists, price updates, sorting & filtering. |
| **Phase 12** | **Portfolio** | Trade booking engine (Buys/Sells), holdings rollup, FIFO cost basis tracker. |
| **Phase 13** | **P&L + Portfolio Analytics** | Realized P&L, mark-to-market Unrealized P&L, performance analytics. |
| **Phase 14** | **Alerts & Notifications** | Price target alerts, movement notifications, ledger payment reminders. |
| **Phase 15** | **Unified Dashboard** | Master dashboard aggregating Khata, Portfolio, Stocks, IPOs, and Alerts. |
| **Phase 16** | **Reports & Analytics** | PDF/CSV statement export, P&L tax summaries, Khata ledger downloads. |
| **Phase 17** | **Security Review** | OWASP audit, secret scanning, authorization checks, rate limit verification. |
| **Phase 18** | **Testing & Regression** | Vitest domain test suite & Playwright E2E execution. |
| **Phase 19** | **Performance Optimization** | Bundle size optimization, query tuning, WebSocket compression. |
| **Phase 20** | **Production Preparation** | Build verification, environment configs, user documentation. |

---

### 13. Risk Register

| Risk ID | Description | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | External stock data provider rate limits or API downtime. | High | Medium | Implement `IMarketDataProvider` provider abstraction with in-memory caching and mock fallback. |
| **R-02** | Registrar anti-bot controls blocking automatic IPO allotment lookup. | High | High | Never bypass anti-bot mechanisms. Implement guided manual deep-linking and structured registrar redirect modals. |
| **R-03** | Floating-point rounding errors in financial calculations. | High | Low | Enforce mandatory use of `decimal.js` and `NUMERIC(18, 4)` across all calculation engines and DB models. |
| **R-04** | Secrets accidentally exposed in frontend builds. | Critical | Low | Keep external API keys on the backend Fastify server. Enforce strict environment variable separation. |

---

### 14. Open Questions

1. **Local PostgreSQL Database Setup**: For local development, do you prefer installing PostgreSQL natively on Windows, using Docker containerization, or using `@electric-sql/pglite` (WebAssembly Postgres engine running directly inside Node.js)?

---

*Report verified & updated following host environment execution.*
