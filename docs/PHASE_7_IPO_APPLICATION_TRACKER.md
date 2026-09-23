# APEX OS — Phase 7 — IPO Application Tracker Technical Architecture & Domain Specification

## Executive Summary
Phase 7 introduces the personal **IPO Application Tracker** module for **Finance Command Center — APEX OS**. It enables users to record, manage, and monitor personal IPO applications (linking which IPO, through which broker/account, number of lots/shares, application amount, payment reference, and application status) while referencing the canonical Phase 6 IPO Master records without duplicating master data or prematurely implementing Phase 8 allotment checking.

---

## 1. Domain Model & Accounting Semantics

### Domain Entity: `IPOApplication`
- **Identity**: `id` (UUID v4 PK), `userId` (UUID v4 FK to `users.id`), `ipoId` (UUID v4 FK to canonical `ipos.id`), `applicationAccountId` (UUID v4 FK to `khata_accounts.id`).
- **Application Details**: `applicationDate` (UTC timestamp), `lotsApplied` (integer > 0), `quantityApplied` (integer > 0).
- **Financial Fields**: `applicationAmount` (Stored as `NUMERIC(18, 4)`). Represents user's recorded application amount. Calculated reference estimate `estimatedAmount = priceBandHigh * quantityApplied` is available for UI assistance via `Decimal.js` fixed-precision arithmetic.
- **Payment & Metadata**: `paymentReference` (UPI mandate ID or transaction reference), `notes`.
- **Referential Integrity**:
  - `user_id`: Foreign key to `users.id` with `ON DELETE RESTRICT`. Preserves financial application ledger entries even if user account deletion is attempted.
  - `ipo_id`: Foreign key to `ipos.id` with `ON DELETE RESTRICT`. Prevents deletion of canonical IPO master records referenced by historical applications.
  - `application_account_id`: Foreign key to `khata_accounts.id` with `ON DELETE RESTRICT`. Prevents deletion of financial accounts tied to application history.

### Application Status Lifecycle Matrix
Phase 7 enforces a strict deterministic application lifecycle. Status values represent payment/application progress only and explicitly exclude allotment outcomes:
- **`DRAFT`**: Saved application draft. Transitions to `SUBMITTED` or `CANCELLED`.
- **`SUBMITTED`**: Application order submitted to broker/bank. Transitions to `PAYMENT_PENDING`, `PAYMENT_CONFIRMED`, `COMPLETED`, or `CANCELLED`.
- **`PAYMENT_PENDING`**: Payment mandate created; awaiting user approval/block. Transitions to `PAYMENT_CONFIRMED`, `COMPLETED`, or `CANCELLED`.
- **`PAYMENT_CONFIRMED`**: Payment mandate accepted and funds blocked. Transitions to `COMPLETED` or `CANCELLED`.
- **`COMPLETED`**: Application & payment workflow completed. **Terminal state**. (Note: `COMPLETED` signifies application submission completion, NOT share allotment).
- **`CANCELLED`**: Application withdrawn or cancelled. **Terminal state**.

> **Strict Phase Boundary Notice**: Allotment outcomes (`ALLOTTED`, `NOT_ALLOTTED`, `PARTIALLY_ALLOTTED`), registrar scraping, CAPTCHA/OTP automation, and PAN allotment checking belong exclusively to Phase 8.

---

## 2. Account Infrastructure Semantics & Validation
- **Khata Account Reuse**: Reuses Phase 5 `khata_accounts` (`application_account_id`). This is semantically correct because `khata_accounts` represents personal financial ledgers/accounts (bank accounts, demat accounts, customer/supplier ledgers) owned by the user.
- **Ownership Verification**: Before creating or updating an IPO application, `IPOApplicationService` checks `IKhataAccountRepository.findById(applicationAccountId, userId)`. Accounts owned by other users return `ACCOUNT_NOT_FOUND`.
- **Archived Account Guard**: `IPOApplicationService` verifies `account.status !== 'ARCHIVED'` and `account.archivedAt === null`. Attempting to use an archived account throws `ACCOUNT_ARCHIVED` (HTTP 400).

---

## 3. Security & Ownership Boundary

- **Development Identity Adapter**: All API routes (`/api/v1/ipo/applications`) are protected by a fail-closed preHandler hook validating `x-user-id` as a valid UUID string matching `users.id`. Missing or malformed identity headers return `HTTP 401 Unauthorized`.
- **User Data Isolation**: Every application query, retrieval, creation, update, status transition, and cancellation is strictly scoped to `userId === req.userId`. User A cannot view, edit, status-transition, or cancel User B's applications.
- **PATCH vs Status Separation**:
  - `PATCH /api/v1/ipo/applications/:id`: Updates editable metadata only (`paymentReference`, `notes`). Status changes via `PATCH` body are completely ignored/rejected by schema validation.
  - `POST /api/v1/ipo/applications/:id/status`: Dedicated endpoint for lifecycle state transitions enforcing the state machine.
  - `POST /api/v1/ipo/applications/:id/cancel`: Dedicated non-destructive cancellation endpoint.

---

## 4. Database Schema & Migration Journal

- **Table**: `ipo_applications`
- **Migration Scripts**:
  - `0004_ipo_application_schema.sql` (Base schema creation)
  - `0005_fix_ipo_applications_user_fk.sql` (Enforces `user_id` UUID type matching `users.id` and sets `ON DELETE RESTRICT`)
- **Journal Registry**: `apps/api/src/db/migrations/meta/_journal.json`

---

## 5. API Specification

- `GET /api/v1/ipo/applications`: List user's IPO applications with pagination (`page`, `limit`), search (issuer, IPO name, symbol, account, payment reference), status filter, IPO filter, account filter, and date range filters. Includes summary count deck.
- `POST /api/v1/ipo/applications`: Create IPO application after validating identity, canonical IPO existence, and active account ownership.
- `GET /api/v1/ipo/applications/:id`: Retrieve single detailed application record with joined canonical IPO master fields and account display name.
- `PATCH /api/v1/ipo/applications/:id`: Update editable fields (`notes`, `paymentReference`).
- `POST /api/v1/ipo/applications/:id/status`: Transition application status adhering to the lifecycle matrix.
- `POST /api/v1/ipo/applications/:id/cancel`: Cancel active application non-destructively.

---

## 6. Audit Events
Mutating actions record audit logs in `audit_logs`:
- `IPO_APPLICATION_CREATED`
- `IPO_APPLICATION_UPDATED`
- `IPO_APPLICATION_STATUS_CHANGED`
- `IPO_APPLICATION_CANCELLED`

No secrets, passwords, OTPs, or API keys are logged.
