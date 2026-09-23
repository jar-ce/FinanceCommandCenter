# PHASE 15 — UNIFIED DASHBOARD & FINANCIAL COMMAND CENTER
## Architectural Documentation & Technical Specification

**Project:** Finance Command Center — APEX OS  
**Path:** `D:\FinanceCommandCenter`  
**Phase Status:** Complete & Verified  

---

### 1. Executive Summary & Core Purpose

Phase 15 replaces the Phase 4 placeholder `CommandCenterPage` with a single, production-grade operational command center. It unifies capabilities across Phase 5 (Digital Khata), Phase 6–8 (IPO Center, Application Tracker & Allotment Checker), Phase 9–10 (Market Data & Instrument Details), Phase 11 (Watchlists), Phase 12–13 (Portfolios, Holdings & P&L Analytics), and Phase 14 (Alerts & Notifications).

The Phase 15 backend architecture provides a read-only aggregation engine (`DashboardService`) exposing a single HTTP REST endpoint:
`GET /api/v1/dashboard/summary`

---

### 2. Architecture & Design Principles

#### 2.1 Read-Only Aggregation
The dashboard layer **never mutates state** and creates **0 new database tables** and **0 schema migrations**. It queries existing domain services (`PnlService`, `PortfolioService`, `WatchlistService`, `IPOService`, `IPOApplicationService`, `KhataService`, `AlertService`, `NotificationService`) to project unified telemetry and subsystem summaries.

#### 2.2 Subsystem Failure Isolation (`Promise.allSettled`)
Independent dashboard queries run concurrently using `Promise.allSettled()`. Each section envelope uses explicit status flags:
- `SUCCESS`: Section processed successfully with data records.
- `EMPTY`: Subsystem processed successfully, but the user has no records.
- `UNAVAILABLE`: Upstream provider or database service is unreachable.
- `ERROR`: Unexpected failure during subsystem execution.

If an individual subsystem fails (e.g. IPO provider timeout), that specific section transitions to `ERROR`, while the rest of the dashboard (Portfolio, Khata, Watchlists) renders unaffected (`SUCCESS`). Failures are never converted into fake zero values.

---

### 3. Metric Semantics & Multi-Portfolio Rules

#### 3.1 Monetary Value Summation
All monetary aggregations (`totalMarketValue`, `totalAcquisitionCost`, `realizedPnL`, `unrealizedPnL`, `totalPnL`, `khataNetBalance`) use `Decimal.js` arbitrary-precision arithmetic. Floating-point arithmetic is strictly prohibited.

#### 3.2 Multi-Portfolio Return Metrics
- **Simple Return % Formula**:
  $$\text{Simple Return \%} = \frac{\text{Total Realized PnL} + \text{Total Unrealized PnL}}{\text{Total Acquisition Cost}} \times 100$$
  If `totalAcquisitionCost` is zero, `simpleReturnPercent = null`.
- **Multi-Portfolio XIRR**:
  When a user has **multiple portfolios**, `xirrPercent` is set to `null` and `xirrStatus` is set to `'UNAVAILABLE'`. XIRR is never averaged across portfolios without a unified cashflow engine.

#### 3.3 Daily Market Change % Terminology
Daily price movements are derived directly from canonical quote metrics (`marketQuotes.changePercent`) and labeled **Daily Market Change %**. It is never labeled "Day Gain/Loss" unless backed by a rupee day P&L calculation, and rupee values are never manufactured from percentages.

#### 3.4 Data Freshness Hierarchy
Market quote freshness is aggregated across holdings and watchlists using the strict severity order:
$$\text{UNAVAILABLE} > \text{STALE} > \text{EOD} > \text{DELAYED} > \text{LIVE}$$

#### 3.5 IPO 24-Hour Closing Window (UTC)
IPO closing-soon status is evaluated strictly using UTC timestamps:
$$0 < \text{diffHours} \le 24 \quad \text{AND} \quad \text{status} = \text{'OPEN'}$$
Local browser time is never used for backend status determination.

---

### 4. Security & Ownership Isolation

- **Identity Enforcement**: Every request to `GET /api/v1/dashboard/summary` must supply a valid `x-user-id` HTTP header (UUID v4 format).
- **Missing or Malformed Header**: Returns `401 Unauthorized`.
- **Cross-User Data Leakage**: User A can never view or infer User B's portfolio values, Khata transactions, watchlists, applications, or alerts.

---

### 5. UI Architecture & Responsive Breakpoints

Frontend components are modularized under `apps/web/src/components/dashboard/`:
- `DashboardHeader.tsx`: Telemetry strip cards & market freshness badge.
- `AttentionBanner.tsx`: Urgent action banner for closing IPOs, unread alerts, and valuation partial warnings.
- `PortfolioSnapshot.tsx`: Aggregate P&L breakdown, Simple Return %, XIRR status, coverage %.
- `TopHoldingsTable.tsx`: Top holdings breakdown using `ResizableTable`.
- `WatchlistMatrix.tsx`: Tracked asset pulse cards with daily change %.
- `IPOPipeline.tsx`: Active IPO issues with "CLOSING SOON" badges & application tracker.
- `KhataSummary.tsx`: Net cash balances, receivable, payable, and recent transactions.
- `ActivityStream.tsx`: Unified domain event timeline.

#### Responsive Grid Layout
- **Desktop ($\ge 1200\text{px}$)**: 3-column operational layout.
- **Tablet ($768\text{px} - 1199\text{px}$)**: 2-column layout.
- **Mobile ($< 768\text{px}$)**: Single-column priority order (Banner $\rightarrow$ Telemetry $\rightarrow$ Portfolio $\rightarrow$ Holdings $\rightarrow$ Alerts $\rightarrow$ IPO $\rightarrow$ Watchlist $\rightarrow$ Digital Khata $\rightarrow$ Activity Stream).

---

### 6. Verification Report

#### 6.1 Backend API Tests (`apps/api/src/__tests__/dashboard.test.ts`)
- Security Boundary & `x-user-id` 401 rejection
- Multi-portfolio Decimal.js monetary aggregation
- Simple Return % calculation & XIRR = null multi-portfolio semantics
- Daily Market Change % terminology & freshness severity aggregation
- IPO 24-hour UTC closing window
- Subsystem failure isolation via `Promise.allSettled()`

#### 6.2 Frontend UI Tests (`apps/web/src/__tests__/dashboard-ui.test.tsx`)
- Render `CommandCenterPage` with API fetch & manual refresh control
- Header telemetry, attention banner, portfolio snapshot, top holdings, watchlist matrix, IPO pipeline, Khata summary, activity stream
- Section-level partial failure error containers

#### 6.3 Command Execution Verification
- `npm run type-check`: Passed (Exit code 0)
- `npm run build`: Passed (Exit code 0)
- API Tests: 9 / 9 Passed
- Web Tests: 10 / 10 Passed
- Monorepo Test Files: 26 / 26 Passed

---

### 7. Known Limitations & Scope Protection

1. **No Real-Time Event Bus**: Unified Activity Stream is generated in-memory from timestamped domain records (`KHATA`, `PORTFOLIO`, `IPO`, `NOTIFICATION`). Market quote ticks are not saved as activity events.
2. **No Multi-Portfolio Cashflow XIRR**: Multi-portfolio XIRR is set to `null` (`UNAVAILABLE`) as specified by approved semantics.
3. **Phase Protection**: PDF exports, broker execution, external push notifications, and analytics engines remain strictly out of scope for Phase 15.
