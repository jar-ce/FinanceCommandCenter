# PHASE 16 — REPORTS & ANALYTICS IMPLEMENTATION PLAN
## Master Architectural Specification & Design Plan (Revised & Verified)

**Project:** Finance Command Center — APEX OS  
**Path:** `D:\FinanceCommandCenter`  
**Phase:** Phase 16 — Reports & Analytics  
**Status:** 🟡 **PLANNING COMPLETE & VERIFIED — AWAITING IMPLEMENTATION AUTHORIZATION**  

---

### 1. EXECUTIVE SUMMARY

Phase 16 introduces a production-grade **Reports & Analytics Subsystem** for APEX OS. The primary goal is to transform APEX OS's existing canonical financial data into structured, analytical, period-based views and report-ready DTO projections.

#### Core Architectural Guarantees:
1. **Zero Duplicate Calculation Engines**: Phase 16 reuses the canonical financial calculations from Phase 13 (`PnlService`), Phase 12 (`PortfolioService`), and Phase 15 (`DashboardService`).
2. **Zero Schema Migrations**: All analytical reports are calculated on-demand via live query aggregation over indexed domain repositories. **Tables Added: 0**, **Migrations Added: 0**.
3. **Arbitrary-Precision Arithmetic**: All financial monetary aggregations and percentages preserve `Decimal.js` precision rules.
4. **Strict Identity Isolation**: Every report query requires a valid authenticated `x-user-id` UUID header.
5. **No Third-Party Export or Heavy Chart Dependencies**: Export engines (PDF, CSV, Excel) and heavy charting libraries (Recharts, Chart.js) are explicitly deferred to future phases to keep APEX OS lightweight, secure, and fast.

---

### 2. DATE RANGE SEMANTICS (STRICT TIMEZONE CONVERSION MODEL)

- **Database & API Storage**: All timestamps in PostgreSQL (`timestamp with time zone`) and API DTOs are stored and returned in UTC ISO format (e.g. `2026-09-22T00:00:00.000Z`).
- **Calendar Preset Boundaries**: Preset selections (`TODAY`, `YESTERDAY`, `CURRENT_WEEK`, `PREVIOUS_WEEK`, `CURRENT_MONTH`, `PREVIOUS_MONTH`, `CURRENT_QUARTER`, `PREVIOUS_QUARTER`, `CURRENT_YEAR`, `PREVIOUS_YEAR`, `ALL_TIME`) represent calendar date boundaries in the user's operational timezone (defaulting to Indian Standard Time `Asia/Kolkata` / UTC+05:30).
- **Backend Conversion Rule**:
  - The API controller or service resolves the local calendar date boundary (e.g., `TODAY` = `2026-09-22 00:00:00.000` to `2026-09-22 23:59:59.999` in `Asia/Kolkata`).
  - Converts local calendar start/end into UTC ISO bounds (`2026-09-21T18:30:00.000Z` to `2026-09-22T18:29:59.999Z`) before executing database query filters.
- **Custom Ranges**: `fromDate` and `toDate` query parameters accept ISO 8601 strings. If a plain date string (`YYYY-MM-DD`) is passed, it is expanded using local start/end boundaries and converted to UTC.
- **No Schema Impact**: Timezone conversion logic is handled strictly in application utility code (`DateRangeResolver`). **0 new tables or database columns added**.

---

### 3. CANONICAL SERVICE REUSE MAP & METHOD VERIFICATION

Every referenced service method has been audited against the active repository implementation:

| Service | Method Name | Actual Signature | Purpose | Phase 16 Usage |
| :--- | :--- | :--- | :--- | :--- |
| `PnlService` | `getPnLSummary` | `getPnLSummary(portfolioId: string, userId: string): Promise<PnLSummaryRecord>` | Single portfolio market value, cost basis, realized/unrealized P&L, coverage & return metrics | Reused directly for portfolio performance snapshots |
| `PnlService` | `getHoldingPnL` | `getHoldingPnL(portfolioId: string, userId: string): Promise<HoldingPnLRecord[]>` | Holding-level current price, cost basis, unrealized P&L & freshness | Reused for asset allocation reports |
| `PnlService` | `getRealizedPnL` | `getRealizedPnL(portfolioId: string, userId: string, fromDate?: string, toDate?: string): Promise<RealizedPnLRecord[]>` | Transaction-level realized gain/loss with date filtering | Reused for realized P&L reports |
| `PortfolioService` | `getUserPortfolios` | `getUserPortfolios(userId: string, includeArchived?: boolean): Promise<PortfolioRecord[]>` | Fetches user portfolios with active holding counts | Reused for portfolio selection & multi-portfolio reports |
| `PortfolioService` | `getPortfolioHoldings` | `getPortfolioHoldings(portfolioId: string, userId: string): Promise<PortfolioHoldingRecord[]>` | Raw holding position quantities and average cost | Reused for portfolio inventory inspection |
| `KhataService` | `listAccounts` | `listAccounts(filter: AccountFilter): Promise<{ accounts: AccountWithBalance[]; summary: KhataSummary }>` | Digital Khata account balances, receivable/payable totals | Reused for Khata cash flow reports |
| `KhataService` | `getAccountLedger` | `getAccountLedger(filter: TransactionFilter): Promise<{ account: AccountWithBalance; transactions: KhataTransactionRow[]; totalCount: number }>` | Account transaction ledger with running balance | Reused for account-wise cash flow analysis |
| `IPOService` | `listIPOs` | `listIPOs(filters?: IPOFilters): Promise<{ ipos: IPOMasterRecord[]; total: number }>` | Fetches active/historical IPO catalog issues | Reused for IPO market activity context |
| `IPOApplicationService` | `listApplications` | `listApplications(filters: IPOApplicationFilters): Promise<{ applications: EnrichedIPOApplication[]; total: number }>` | User IPO applications with issue & account details | Reused for IPO participation reports |
| `AlertService` | `getUserAlertRules` | `getUserAlertRules(userId: string, status?: AlertRuleStatus): Promise<AlertRuleRecord[]>` | Fetches configured user alert rules | Reused for alerts intelligence report |
| `NotificationService` | `getUserNotifications` | `getUserNotifications(userId: string, status?: NotificationStatus, limit?: number): Promise<{ items: NotificationRecord[]; unreadCount: number }>` | User notifications & unread counters | Reused for notification statistics |
| `WatchlistService` | `getUserWatchlists` | `getUserWatchlists(userId: string, includeArchived?: boolean): Promise<WatchlistRecord[]>` | User watchlists with item counts | Reused for market monitor reports |
| `MarketDataService` | `getBatchQuotes` | `getBatchQuotes(symbolsOrIds: string[]): Promise<{ status: MarketProviderStatus; data: Map<string, MarketQuoteRecord> }>` | Batch quote retrieval | Reused for asset allocation quote enrichment |

*All required financial algorithms (Realized P&L, Unrealized P&L, Simple Return %, XIRR, CAGR) remain centralized in `PnlService`. No new calculation engines will be created.*

---

### 4. FINANCIAL METRIC CLASSIFICATION & PRECISION RULES

To prevent mixing current-state and period-state metrics, Phase 16 explicitly categorizes all financial variables:

| Metric | Classification | Definition / Formula |
| :--- | :--- | :--- |
| **Active Position Acquisition Cost** | **CURRENT STATE** | Cost basis of active ($\text{quantity} > 0$) positions: $\sum (\text{activeQuantity} \times \text{averageCost})$. |
| **Historical Acquisition Cost** | **HISTORICAL** | Cumulative total of all BUY gross amounts + charges + taxes across all history. |
| **Cost Removed Through SELL** | **HISTORICAL / PERIOD** | Cost basis removed when positions were sold: $\sum (\text{soldQuantity} \times \text{averageCostBeforeSell})$. |
| **Period Realized P&L** | **PERIOD STATE** | Realized gain/loss from SELL transactions whose `transactionDate` falls within `[fromDate, toDate]`. |
| **Current Unrealized P&L** | **CURRENT STATE** | Market value minus active acquisition cost for current active positions: $\sum (\text{marketValue} - \text{activeAcquisitionCost})$. |
| **Total Portfolio P&L** | **HYBRID STATE** | $\text{Cumulative Realized P\&L} + \text{Current Unrealized P\&L}$. |

#### CAGR & XIRR Rules:
- **CAGR**: Phase 16 **does not redefine CAGR**. CAGR remains delegated strictly to `PnlService.calculateReturnMetrics()` and its established eligibility rules (single lump-sum BUY, 100% valuation coverage, holding period $\ge 30$ days). Otherwise `UNAVAILABLE`.
- **XIRR**: Newton-Raphson annualized solver. Requires 100% valuation coverage (`isFullValuation === true`). For multiple portfolios, `xirrPercent` is set to `null` (`xirrStatus = 'UNAVAILABLE'`).

---

### 5. DIGITAL KHATA CASH FLOW & IPO ALLOTMENT METRICS

#### 5.1 Digital Khata Cash Flow Metrics
- **Total Cash Inflow**: Sum of all `MONEY_IN` transactions within `[fromDate, toDate]`.
- **Total Cash Outflow**: Sum of all `MONEY_OUT` transactions within `[fromDate, toDate]`.
- **Net Cash Movement**: $\text{Total Cash Inflow} - \text{Total Cash Outflow}$.
- **Receivable & Payable**: Current active account balances where `netBalance > 0` (Receivable) and `netBalance < 0` (Payable).
- *(Note: Proposed "Cash Velocity" metric was REMOVED to avoid inventing unverified accounting concepts).*

#### 5.2 IPO Allotment Metrics
- **Numerator**: Applications linked to allotment records where `allotmentStatus IN ('ALLOTTED', 'PARTIALLY_ALLOTTED')`.
- **Denominator**: Applications linked to allotment records where `verificationStatus === 'VERIFIED'` and application `status !== 'CANCELLED'`.
- **Allotment Success Rate %**:
  $$\text{Allotment Rate \%} = \frac{\text{Allotted Applications}}{\text{Verified Non-Cancelled Applications}} \times 100$$
- **Unverified Outcomes**: Applications with `verificationStatus !== 'VERIFIED'` (e.g. `UNVERIFIED`, `STALE`, `UNAVAILABLE`, `MANUAL_REQUIRED`) are surfaced in unverified summary counts but excluded from the rate denominator to prevent distorting accuracy.

---

### 6. PORTFOLIO PERFORMANCE ENDPOINT SEMANTICS

`GET /api/v1/reports/portfolio-performance` is defined as a **Hybrid Portfolio Performance Report**:
- **`currentSnapshot`**: Current total market value, active acquisition cost, current unrealized P&L, unrealized P&L %, valuation coverage %, and quote freshness.
- **`periodPerformance`**: Realized P&L within `[fromDate, toDate]`, net capital invested during period ($\text{BUY total} - \text{SELL proceeds}$), period Simple Return %, and XIRR/CAGR status.
- Query parameters: `portfolioId?`, `fromDate?`, `toDate?`, `preset?`, `includeArchived?`. Default date range: `ALL_TIME`.

---

### 7. REPORT CONTRACT & DTO-API-UI MAPPING MATRICES

#### 7.1 Report Contract Matrix

| Report | DTO | Service Source | API Endpoint | Date Range | Pagination | Freshness | Multi-Portfolio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Executive Summary** | `ReportSummaryDTO` | `ReportService.getSummary` | `GET /api/v1/reports/summary` | Optional (`ALL_TIME`) | No | Severity Aggregated | Supported (Additive) |
| **Portfolio Performance** | `PortfolioPerformanceReportDTO` | `ReportService.getPortfolioPerformance` | `GET /api/v1/reports/portfolio-performance` | Supported | No | Severity Aggregated | Supported (XIRR = null) |
| **Asset Allocation** | `AssetAllocationReportDTO` | `ReportService.getAssetAllocation` | `GET /api/v1/reports/asset-allocation` | Current State | No | Per Instrument | Supported (Additive) |
| **Realized P&L Ledger** | `PaginatedResponse<RealizedPnLRecord>` | `PnlService.getRealizedPnL` | `GET /api/v1/reports/realized-pnl` | Supported | Yes (`page`, `limit`) | N/A (Historical) | Supported |
| **Digital Khata Cash Flow** | `KhataCashFlowReportDTO` | `ReportService.getKhataCashFlow` | `GET /api/v1/reports/khata-cashflow` | Supported | Yes (`limit`) | N/A (Ledger) | N/A |
| **IPO Participation** | `IPOParticipationReportDTO` | `ReportService.getIPOParticipation` | `GET /api/v1/reports/ipo-participation` | Supported | No | N/A (Application) | N/A |
| **Alerts Intelligence** | `AlertsAnalyticsReportDTO` | `ReportService.getAlertsAnalytics` | `GET /api/v1/reports/alerts-analytics` | Supported | No | N/A (Alerts) | N/A |

#### 7.2 DTO $\rightarrow$ API $\rightarrow$ UI Mapping Matrix

| Producer DTO | Service Method | API Endpoint | UI Consumer Component |
| :--- | :--- | :--- | :--- |
| `ReportSummaryDTO` | `ReportService.getSummary()` | `GET /api/v1/reports/summary` | `ReportHeader.tsx`, `ReportsPage.tsx` |
| `PortfolioPerformanceReportDTO` | `ReportService.getPortfolioPerformance()` | `GET /api/v1/reports/portfolio-performance` | `PortfolioReportView.tsx` |
| `AssetAllocationReportDTO` | `ReportService.getAssetAllocation()` | `GET /api/v1/reports/asset-allocation` | `PortfolioReportView.tsx` |
| `PaginatedResponse<RealizedPnLRecord>` | `PnlService.getRealizedPnL()` | `GET /api/v1/reports/realized-pnl` | `PortfolioReportView.tsx` |
| `KhataCashFlowReportDTO` | `ReportService.getKhataCashFlow()` | `GET /api/v1/reports/khata-cashflow` | `KhataReportView.tsx` |
| `IPOParticipationReportDTO` | `ReportService.getIPOParticipation()` | `GET /api/v1/reports/ipo-participation` | `IPOReportView.tsx` |
| `AlertsAnalyticsReportDTO` | `ReportService.getAlertsAnalytics()` | `GET /api/v1/reports/alerts-analytics` | `AlertsAnalyticsView.tsx` |

*Every proposed DTO has an explicit service producer, REST endpoint, and UI consumer.*

---

### 8. SERVICE VS REPOSITORY QUERY STRATEGY

To ensure maximum query efficiency without duplicating business logic:
1. **Existing Domain Services**: Used when canonical business logic must be executed (e.g. `PnlService.getPnLSummary()` for FIFO/WAVG cost basis and realized P&L).
2. **Direct Repository Read Queries**: Used when fetching structured date-range slices where canonical calculation is not required (e.g., `IKhataTransactionRepository.listByAccountId()` for ledger date ranges, `IAlertRepository.getUserAlertRules()` for active rules). No business logic is duplicated.

---

### 9. PERFORMANCE & BOUNDED QUERY STRATEGY

- **Bounded Date Ranges**: Queries without explicit date bounds default to `ALL_TIME` with strict result pagination limits.
- **Pagination**: All transaction ledgers enforce maximum `limit` bounds (e.g., max 100 per page).
- **Deterministic Sorting**: All report lists sort deterministically by date DESC (e.g., `transactionDate DESC`, `createdAt DESC`).
- **Zero N+1 Queries**: Instrument quotes enriched via batch lookup `IMarketRepository.getBatchQuotes()`.

---

### 10. CHART & EXPORTS STRATEGY

- **Zero Heavy Chart Dependencies**: No third-party charting libraries (Recharts, Chart.js, D3) will be installed. Asset allocation distribution bars and telemetry visualizers use clean Vanilla CSS and inline React SVG shapes.
- **Exports Scope Control**: Export engines (PDF, CSV, Excel) and email delivery are **explicitly OUT OF SCOPE** for Phase 16 and deferred to future phases.

---

### 11. FILE-BY-FILE IMPLEMENTATION PLAN

#### `packages/shared-types/src/index.ts`
- **Action:** MODIFY
- **Purpose:** Add Phase 16 Report DTO interface contracts (`ReportSummaryDTO`, `PortfolioPerformanceReportDTO`, `AssetAllocationReportDTO`, `KhataCashFlowReportDTO`, `IPOParticipationReportDTO`, `AlertsAnalyticsReportDTO`).
- **Dependencies:** None | **Risk:** Low | **Tests:** `npm run type-check`

#### `apps/api/src/domain/utils/DateRangeResolver.ts`
- **Action:** CREATE
- **Purpose:** Pure utility for converting user calendar presets (`TODAY`, `CURRENT_MONTH`, etc.) into UTC ISO boundaries based on user timezone offset.
- **Dependencies:** None | **Risk:** Low | **Tests:** `reports.test.ts`

#### `apps/api/src/domain/services/ReportService.ts`
- **Action:** CREATE
- **Purpose:** Read-only report aggregation service reusing `PnlService`, `PortfolioService`, `KhataService`, `IPOService`, `AlertService`.
- **Dependencies:** Existing domain services | **Risk:** Low | **Tests:** `reports.test.ts`

#### `apps/api/src/routes/reports.ts`
- **Action:** CREATE
- **Purpose:** Fastify REST API routes for `/api/v1/reports/*` (7 endpoints).
- **Dependencies:** `ReportService`, Zod validation | **Risk:** Low | **Tests:** `reports.test.ts`

#### `apps/api/src/routes/index.ts`
- **Action:** MODIFY
- **Purpose:** Register `reportRoutes` under `/reports` prefix.
- **Dependencies:** `reports.ts` | **Risk:** Low | **Tests:** `npm run test`

#### `apps/api/src/__tests__/reports.test.ts`
- **Action:** CREATE
- **Purpose:** Backend test suite for reports API & service logic (7 endpoints, security, date ranges, multi-portfolio rules).
- **Dependencies:** `ReportService`, Fastify app | **Risk:** Low | **Tests:** `vitest`

#### `apps/web/src/components/reports/` (New Directory)
- `ReportHeader.tsx`: CREATE
- `DateRangePicker.tsx`: CREATE
- `PortfolioReportView.tsx`: CREATE
- `KhataReportView.tsx`: CREATE
- `IPOReportView.tsx`: CREATE
- `AlertsAnalyticsView.tsx`: CREATE
- **Purpose:** Modular UI components for report visualization.
- **Dependencies:** Shared DTOs, `ResizableTable` | **Risk:** Low | **Tests:** `reports-ui.test.tsx`

#### `apps/web/src/pages/ReportsPage.tsx`
- **Action:** CREATE
- **Purpose:** Master Reports & Analytics workspace page with tabbed navigation and date-range controls.
- **Dependencies:** Report components, `PageContainer` | **Risk:** Low | **Tests:** `reports-ui.test.tsx`

#### `apps/web/src/__tests__/reports-ui.test.tsx`
- **Action:** CREATE
- **Purpose:** Frontend vitest test suite for report page & components.
- **Dependencies:** `ReportsPage` | **Risk:** Low | **Tests:** `vitest`

---

### 12. DATABASE GATE

- **Tables Added:** `0`
- **Migrations Added:** `0`

---

### 13. PHASE PROTECTION

Strictly excluded from Phase 16:
- Phase 17 Security Review implementation
- Phase 18 Regression implementation beyond Phase 16 tests
- Phase 19 Performance Optimization
- Phase 20 Production Preparation
- PDF, Excel, CSV exports
- Broker integration or live trading execution
- AI investment advice or stock recommendations

---

### 14. PHASE GATE STATUS

- **Phase 15**: **COMPLETE & VERIFIED**
- **Phase 16**: **PLANNING COMPLETE — AWAITING IMPLEMENTATION AUTHORIZATION**
