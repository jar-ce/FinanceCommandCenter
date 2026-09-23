# PHASE 16 — REPORTS & ANALYTICS SUBSYSTEM DOCUMENTATION

## Executive Summary

Phase 16 delivers a production-grade **Reports & Analytics Subsystem** for **Finance Command Center — APEX OS**. It projects the platform's canonical financial datasets (Portfolio, Digital Khata, IPO Tracker, Alerts & Notifications, Market Data) into period-based analytical reports and structured DTO contracts.

---

## Key Architectural Guarantees

1. **Zero Duplicate Financial Engines**: All financial calculations leverage Phase 13 (`PnlService`), Phase 12 (`PortfolioService`), and Phase 15 (`DashboardService`). No second calculation engine was introduced.
2. **Zero Schema Migrations**: All analytical reports are calculated on-demand over indexed domain repositories. **Tables Added: 0**, **Migrations Added: 0**.
3. **UTC Timezone Boundaries**: API and Database timestamps remain strict UTC ISO strings. User calendar presets (`TODAY`, `CURRENT_MONTH`, etc.) convert local calendar dates (default `Asia/Kolkata` / UTC+05:30) into exact UTC ISO boundaries before executing queries.
4. **Arbitrary-Precision Arithmetic**: All financial aggregations preserve `Decimal.js` precision rules without native floating-point math.
5. **Strict Identity Isolation**: Every report route requires a valid UUID `x-user-id` header. Malformed or missing headers return HTTP 401 Unauthorized.

---

## Implemented API Catalog

| Endpoint | DTO Contract | Description |
| :--- | :--- | :--- |
| `GET /api/v1/reports/summary` | `ReportSummaryDTO` | Executive cross-domain financial summary and telemetry |
| `GET /api/v1/reports/portfolio-performance` | `PortfolioPerformanceReportDTO` | Hybrid current snapshot & period performance with return metrics |
| `GET /api/v1/reports/asset-allocation` | `AssetAllocationReportDTO` | Asset class distribution & holding weight percentages |
| `GET /api/v1/reports/realized-pnl` | `PaginatedResponse<RealizedPnLRecord>` | Paginated transaction-level realized P&L records |
| `GET /api/v1/reports/khata-cashflow` | `KhataCashFlowReportDTO` | Period cash inflow, outflow, net movement, and party summaries |
| `GET /api/v1/reports/ipo-participation` | `IPOParticipationReportDTO` | IPO capital committed, application breakdown & verified allotment success rate |
| `GET /api/v1/reports/alerts-analytics` | `AlertsAnalyticsReportDTO` | Alert rule distribution, trigger counts & notification analytics |

---

## Date Range & Timezone Model

Calendar filtering is governed by `DateRangeResolver.ts`:
- **Presets Supported**: `TODAY`, `YESTERDAY`, `CURRENT_WEEK`, `PREVIOUS_WEEK`, `CURRENT_MONTH`, `PREVIOUS_MONTH`, `CURRENT_QUARTER`, `PREVIOUS_QUARTER`, `CURRENT_YEAR`, `PREVIOUS_YEAR`, `ALL_TIME`, `CUSTOM`.
- **Conversion Rule**: Local start-of-day (`00:00:00.000`) and end-of-day (`23:59:59.999`) in `Asia/Kolkata` (+05:30) are converted to UTC before querying.
  - Example `TODAY` on 2026-09-22:
    - `fromUtc`: `2026-09-21T18:30:00.000Z`
    - `toUtc`: `2026-09-22T18:29:59.999Z`

---

## Financial Metrics & Calculation Semantics

- **Active Acquisition Cost**: Sum of current active holding cost bases ($Qty \times AvgCost$). Removed cost basis from SELL transactions is excluded from active snapshot.
- **Period Realized P&L**: Sum of realized gains/losses from SELL transactions strictly within the selected date range `[fromDate, toDate]`.
- **Current Snapshot Unrealized P&L %**: $\frac{\text{Current Unrealized P\&L}}{\text{Active Acquisition Cost}} \times 100$.
- **Period Simple Return %**:
  $$\text{Period Simple Return \%} = \frac{\text{Period Realized P\&L}}{\text{Net Capital Invested}} \times 100$$
  where $\text{Net Capital Invested} = \text{BUY total} - \text{SELL proceeds}$.
  - `currentSnapshot.unrealizedPnL` is **NOT** included in period Simple Return.
  - `currentSnapshot` metrics remain strictly current-state metrics.
  - `periodPerformance` metrics remain strictly period-state metrics.
  - This strict separation prevents current and period financial states from being mixed.
- **XIRR / CAGR Delegation**:
  - **Multi-portfolio Aggregations**: Sets `xirrPercent = null`, `xirrStatus = UNAVAILABLE`, `cagrPercent = null`, and `cagrStatus = UNAVAILABLE` with explicit explanation message. XIRR and CAGR values are never averaged across portfolios.
  - **Single Portfolio XIRR**: Delegates to canonical Phase 13 `PnlService.getPnLSummary()` Newton-Raphson cash flow solver requiring $100\%$ valuation coverage and $\ge 2$ non-same-day cash flows.
  - **Single Portfolio CAGR**: Delegates directly to canonical Phase 13 `PnlService` eligibility logic (single BUY lump-sum transaction, $100\%$ valuation coverage, positive valuation, and holding duration $\ge 30$ days). Phase 16 does not create a duplicate CAGR engine or impose any artificial "> 1 year" requirement.
- **IPO Allotment Success Rate**:
  $$\text{Allotment Rate \%} = \frac{\text{Allotted Count} + \text{Partially Allotted Count}}{\text{Total Verified Outcomes}} \times 100$$
  Unverified outcomes and cancelled applications are strictly excluded from the denominator.

---

## Monorepo Verification Results

- **Backend Test Suite (`apps/api/src/__tests__/reports.test.ts`)**: 18 / 18 Passed
- **Frontend Test Suite (`apps/web/src/__tests__/reports-ui.test.tsx`)**: 6 / 6 Passed
- **Database Schema Impact**: 0 Tables Added / 0 Migrations Added
- **Phase Boundaries**: Phase 16 COMPLETE | Phase 17+ NOT STARTED
