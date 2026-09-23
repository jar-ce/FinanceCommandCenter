# APEX OS — Phase 14 Alerts & Notifications Documentation

## 1. Overview
Phase 14 establishes the real-time evaluation, threshold-crossing alert engine, deduplication system, and in-app notification pipeline for **APEX OS — Finance Command Center**.

The architecture enforces strict condition-specific threshold modeling, zero-fallback identity isolation (`x-user-id` header required), server-side cooldown, database-level deduplication guarantees via unique index constraints, and seamless integration with the pre-existing APEX OS audit logging infrastructure.

---

## 2. Event Model & Condition-Specific Threshold Architecture

### 2.1 Condition-Specific Event Nullability
- **Numeric Threshold Alerts**: Require valid numeric values for `thresholdValue` / `thresholdPercent` during creation and evaluation. `thresholdValue` and `triggerValue` are stored as `numeric(18, 4)`.
  - `PRICE_ABOVE`
  - `PRICE_BELOW`
  - `PRICE_CHANGE_PERCENT_ABOVE`
  - `PRICE_CHANGE_PERCENT_BELOW`
  - `VOLUME_ABOVE`
  - `PORTFOLIO_TOTAL_PNL_ABOVE`
  - `PORTFOLIO_TOTAL_PNL_BELOW`
  - `PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE`
  - `PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW`

- **State-Transition Alerts**: Do **NOT** use artificial numeric defaults (e.g. `0.0000`). `thresholdValue` and `triggerValue` are stored as `NULL`.
  - `IPO_OPENING`: Triggers when IPO status transitions from `UPCOMING` to `OPEN`.
  - `IPO_CLOSING_SOON`: Triggers when an active IPO is within the configured window of its `closeDate`.

### 2.2 Persisted Threshold-Crossing State Mechanism & Stateful Hysteresis
To eliminate duplicate notifications when market prices hover around a threshold or when an IPO remains inside a notification window, `alert_rules` persists evaluation state:
- `last_evaluated_value`: Decimal string (e.g., `'1520.0000'`) or `null`.
- `last_evaluated_state`: Persisted state (`'ABOVE'`, `'BELOW'`, or `'UNKNOWN'`).

**Evaluation Rules**:
1. **State Transition Requirement**: An alert for `PRICE_ABOVE ₹1550` triggers **ONLY** on a state transition from `BELOW` (or `UNKNOWN`) to `ABOVE`.
2. **Hysteresis / Reset**: If the price remains above ₹1550 (e.g., ₹1600 → ₹1610), `last_evaluated_state` remains `ABOVE` and no duplicate event is generated. When the price drops to ₹1520, `last_evaluated_state` resets to `BELOW`. Subsequent movement to ₹1570 triggers a new alert event.
3. **Threshold Mutations**: Modifying a rule's threshold resets `last_evaluated_value` to `null` and `last_evaluated_state` to `'UNKNOWN'`.
4. **Stateful Hysteresis for `IPO_CLOSING_SOON`**:
   - **Outside Closing Window**: When `diffHours > thresholdHours` (or status is not `OPEN`), `stateConditionMet = false` and `nextEvaluatedState = 'BELOW'`. No notification triggered.
   - **Enters Closing Window**: When `0 < diffHours <= thresholdHours` and status is `OPEN`, `stateConditionMet = true`. Transition from `BELOW` -> `ABOVE` triggers the single alert notification and sets state to `ABOVE`.
   - **Remains Inside Closing Window**: On subsequent evaluations, state is already `ABOVE`. State condition does not cross a new threshold (`lastEvaluatedState === 'ABOVE'`), suppressing duplicate notifications.
   - **Leaves Closing Window / Closed**: When the IPO closes or passes its window, state resets to `BELOW`.

---

## 3. Database-Level Deduplication & Concurrency Safety

### 3.1 Unique Index Constraint
- **Constraint**: `alert_events_dedup_idx` ON `alert_events("deduplication_key")`
- **Key Format**: `${rule.id}_${timestampWindow}`
- **Concurrency Protection**: If multiple evaluators or worker processes run simultaneously, only one transaction succeeds in creating the `alert_events` record and corresponding `notifications` record. Concurrent transactions fail gracefully with `DUPLICATE_TRIGGER_DEDUPLICATED`.

### 3.2 Atomic Trigger Transactions
All trigger side-effects execute inside a single atomic database transaction (`db.transaction()`):
1. Lock rule for update (`.for('update')`).
2. Insert `alert_events` record with deduplication key.
3. Insert `notifications` in-app record.
4. Update `alert_rules` timestamps (`last_triggered_at`, `last_evaluated_at`, `last_evaluated_value`, `last_evaluated_state`).
5. Write audit log entry via existing `IAuditLogRepository`.

---

## 4. Reused Domain Infrastructure & Zero External Providers

### 4.1 Domain Abstraction Reuse
- **IPO Data**: Reuses Phase 6 `IIPORepository` / `DrizzleIPORepository`.
- **Market Data**: Reuses Phase 9 `IMarketRepository` / `DrizzleMarketRepository`.
- **P&L Analytics**: Reuses Phase 13 `PnlService` and `DrizzlePortfolioRepository`.
- **Audit Logging**: Reuses `IAuditLogRepository` with new audit actions:
  - `ALERT_CREATED`
  - `ALERT_UPDATED`
  - `ALERT_PAUSED`
  - `ALERT_RESUMED`
  - `ALERT_ARCHIVED`
  - `ALERT_TRIGGERED`
  - `NOTIFICATION_READ`
  - `NOTIFICATION_UNREAD`
  - `NOTIFICATION_ARCHIVED`

### 4.2 Data Freshness Guard
- Evaluator skips quotes marked as `STALE` or `UNAVAILABLE`.
- Portfolio evaluation requires `valuationCoverage.coveragePercentage === '100.0000'`.

### 4.3 Zero External Provider Policy
In accordance with APEX OS architecture:
- Notifications are strictly **IN-APP** stored in PostgreSQL.
- No SMS, Email, WhatsApp, push services, or third-party webhooks are included.

---

## 5. REST API Specifications

| Method | Endpoint | Description | Auth Guard |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/alerts` | Create new alert rule | `x-user-id` |
| `GET` | `/api/v1/alerts` | List alert rules for authenticated user | `x-user-id` |
| `GET` | `/api/v1/alerts/:id` | Get alert rule by ID | `x-user-id` |
| `PATCH` | `/api/v1/alerts/:id` | Update alert rule parameters | `x-user-id` |
| `POST` | `/api/v1/alerts/:id/pause` | Pause active alert rule | `x-user-id` |
| `POST` | `/api/v1/alerts/:id/resume` | Resume paused alert rule | `x-user-id` |
| `DELETE` | `/api/v1/alerts/:id` | Archive alert rule | `x-user-id` |
| `POST` | `/api/v1/alerts/:id/evaluate` | Evaluate single alert rule against live data | `x-user-id` |
| `POST` | `/api/v1/alerts/evaluate-all` | Evaluate all active rules for authenticated user | `x-user-id` |
| `GET` | `/api/v1/notifications` | Get user notifications with status filter & pagination | `x-user-id` |
| `GET` | `/api/v1/notifications/unread-count` | Get unread notification count | `x-user-id` |
| `POST` | `/api/v1/notifications/:id/read` | Mark notification as READ | `x-user-id` |
| `POST` | `/api/v1/notifications/:id/unread` | Mark notification as UNREAD | `x-user-id` |
| `POST` | `/api/v1/notifications/:id/archive` | Mark notification as ARCHIVED | `x-user-id` |

---

## 6. Verification & Test Suite Summary

- **TypeScript Type Check**: `0` errors (`npx tsc -b packages/shared-types && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json`).
- **Production Build**: Clean build succeeded (`dist/assets/index-PQUMJMmL.js`).
- **Total Test Files Executed**: **25 Test Files** (13 API test files + 12 Web UI test files).
- **Total Monorepo Tests Passed**: **181 / 181** tests (100% pass rate).
  - API Test Suite (`apps/api`): 143 tests passed across 13 test files.
  - Web UI Test Suite (`apps/web`): 38 tests passed across 12 test files.
  - Shared Types (`packages/shared-types`): `tsc --noEmit` passed.

---

## 7. Strict Phase Gate Status

- **Phase 14**: **COMPLETE & APPROVED**
- **Phase 15**: **NOT STARTED**
