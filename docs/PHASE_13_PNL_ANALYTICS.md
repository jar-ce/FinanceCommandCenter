# Phase 13 — P&L & Portfolio Analytics Architecture & Technical Documentation

## Architectural Overview
Phase 13 implements the canonical **P&L & Portfolio Analytics Engine** for **Finance Command Center — APEX OS**.

The engine computes auditable realized P&L, unrealized P&L, cost basis, valuation coverage, valuation timestamps, and cash-flow return metrics (XIRR/CAGR) directly from the Phase 12 chronological transaction ledger and Phase 9 market quotes.

```
+---------------------------------------------------------------------------------+
|                                APEX OS Web App                                  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                         PortfolioPage (/portfolio)                        |  |
|  | - Tab Navigation: Active Holdings | Transactions | P&L Analytics | Realized   |  |
|  | - P&L Performance Cards: Realized, Unrealized, Total, XIRR, Coverage       |  |
|  | - Holding Analytics Table (ResizableTable)                                |  |
|  | - Realized P&L Ledger (ResizableTable + Date Range Filter Controls)        |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------+-----------------------------------------+
                                        | HTTP REST API (/api/v1/portfolios/:id/pnl)
                                        v
+---------------------------------------------------------------------------------+
|                            Fastify API Layer (pnl.ts)                           |
|  - PreHandler Identity Guard (resolveDevelopmentIdentity: x-user-id header)     |
+---------------------------------------+-----------------------------------------+
                                        | Calls
                                        v
+---------------------------------------------------------------------------------+
|                         PnlService (Domain & Math Engine)                       |
|  - Consumes Weighted-Average Cost Basis from Phase 12                           |
|  - Chronological Ledger Processing: transaction_date ASC, created_at ASC, id ASC|
|  - Realized P&L per SELL: netProceeds - costRemoved                             |
|  - Decimal.js High-Precision Financial Arithmetic                               |
|  - Bounded Newton-Raphson XIRR & CAGR Cash-Flow Calculation Engine              |
|  - Valuation Coverage & Market Data Freshness Tracker                           |
+----------------------------------+----+------------------------------------+
                                   |    |
          Queries Transactions     |    | Queries Market Quotes
                                   v    v
+----------------------------------+----+------------------------------------+
|  IPortfolioRepository                 |  IMarketRepository                     |
|  (portfolio_transactions)             |  (market_quotes, market_instruments)   |
+---------------------------------------+-----------------------------------------+
```

---

## Financial Integrity Model & Formulas

### 1. Cost Basis & Average Cost (Phase 12 Compatibility)
Phase 13 strictly consumes Phase 12 weighted-average cost-basis semantics:
- **BUY Transaction**:
  $$\text{gross} = \text{quantity} \times \text{price}$$
  $$\text{totalCost} = \text{gross} + \text{charges} + \text{taxes}$$
  $$\text{costBasis}_{\text{new}} = \text{costBasis}_{\text{old}} + \text{totalCost}$$
  $$\text{quantity}_{\text{new}} = \text{quantity}_{\text{old}} + \text{quantity}$$
  $$\text{averageCost} = \frac{\text{costBasis}_{\text{new}}}{\text{quantity}_{\text{new}}}$$

### 2. Realized P&L (Path-Dependent Per SELL)
Realized P&L depends on the weighted-average acquisition cost immediately before each SELL:
- **SELL Transaction**:
  $$\text{averageCostBeforeSell} = \frac{\text{costBasis}_{\text{old}}}{\text{quantity}_{\text{old}}}$$
  $$\text{costRemoved} = \text{averageCostBeforeSell} \times \text{soldQuantity}$$
  $$\text{grossProceeds} = \text{soldQuantity} \times \text{price}$$
  $$\text{netProceeds} = \text{grossProceeds} - \text{charges} - \text{taxes}$$
  $$\text{realizedPnL} = \text{netProceeds} - \text{costRemoved}$$
  $$\text{costBasis}_{\text{new}} = \max(0, \text{costBasis}_{\text{old}} - \text{costRemoved})$$
  $$\text{quantity}_{\text{new}} = \max(0, \text{quantity}_{\text{old}} - \text{soldQuantity})$$

### 3. Simple Return % Denominator Rules
- **Formula**: Simple Return % is defined as $\frac{\text{unrealizedPnL}}{\text{totalCostBasis}} \times 100$ **ONLY** when no SELL transactions have occurred in the portfolio.
- **Validity Condition**: If SELL transactions exist ($\text{portfolioTotalRealized} \neq 0$), simple return on active cost basis is misleading because `totalPnL` includes realized gains/losses from sold shares whose acquisition cost is no longer in `totalCostBasis`. In this case, `simpleReturnPercent` returns `null` (`UNAVAILABLE`).

### 4. XIRR & Valuation Coverage Rules
- **Full Valuation Requirement**: XIRR uses current terminal portfolio market value as a positive cash flow. If `valuationCoverage` is not `FULL` (`valuedHoldingsCount < totalHoldingsCount`), XIRR returns `xirrStatus: 'UNAVAILABLE'` with message `"XIRR requires FULL valuation coverage (100% of active holdings valued)."`.
- **Numerical Robustness**: Uses a bounded Newton-Raphson algorithm ($\text{maxIter} = 100$, rate bounds $[-0.9999, 100.0]$). Returns `UNAVAILABLE` for $< 2$ cash flows, all-positive/all-negative cash flows, same-day cash flows ($d_{\max} - d_{\min} < 1 \text{ day}$), zero derivative, or non-convergence. Never returns `NaN` or `Infinity`.

### 5. CAGR Validity Rules
- **Formula**: $\left(\frac{\text{Ending Value}}{\text{Beginning Value}}\right)^{\frac{1}{N}} - 1$ where $N = \text{days} / 365.25$.
- **Validity Condition**: CAGR requires a single initial lump-sum BUY with no intermediate cash flows, full valuation coverage, positive values, and an elapsed holding period of $\ge 30$ days. If intermediate BUY/SELL transactions exist, CAGR returns `cagrStatus: 'UNAVAILABLE'` with guidance to use XIRR.

### 6. Valuation Timestamps & Phase 9 Freshness
- Exposes `valuationAsOf` (latest quote timestamp among valued holdings) and `calculatedAt` (ISO timestamp when calculation ran).
- Consumes canonical Phase 9 quote freshness (`LIVE`, `DELAYED`, `EOD`, `STALE`, `UNAVAILABLE`) without silently overriding provider statuses.

---

## API Endpoints

1. `GET /api/v1/portfolios/:id/pnl`
   - Returns portfolio-level summary overview (`PnLSummaryRecord`).
2. `GET /api/v1/portfolios/:id/pnl/holdings`
   - Returns holding-level P&L details (`HoldingPnLRecord[]`).
3. `GET /api/v1/portfolios/:id/pnl/realized?fromDate=...&toDate=...`
   - Returns chronological realized P&L ledger records (`RealizedPnLRecord[]`).
4. `GET /api/v1/portfolios/:id/pnl/performance`
   - Returns return metrics summary (`ReturnMetricsRecord`).

All endpoints require strict `x-user-id` header validation (`401 Unauthorized` on missing/malformed; `404 Not Found` on cross-user resources).

---

## Phase Gate Status

🛑 **PHASE 13 IS COMPLETE AND STOPPED FOR HUMAN REVIEW.**

Do NOT proceed to Phase 14 until explicit human authorization is given.
