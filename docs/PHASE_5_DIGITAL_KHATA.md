# APEX OS — Phase 5 — Digital Khata Technical Architecture & Financial Integrity Documentation

## Executive Summary
Phase 5 implements the **Digital Khata** module for **Finance Command Center — APEX OS**. Following the Financial Integrity & Ownership Correction pass, the module enforces non-destructive historical transaction reversals, `ON DELETE RESTRICT` database foreign key constraints, archived account transaction guards, server-side multi-tenant ownership security, and 28-digit financial arithmetic.

---

## 1. Domain Model & Accounting Semantics

### Entity Relationships
- **`KhataAccount`**: Represents a financial contact (`CUSTOMER`, `SUPPLIER`, `BUSINESS`, `PERSONAL`).
- **`KhataTransaction`**: Immutable financial ledger record.

### Key Financial Rules
1. **Posting Direction**:
   - `MONEY_IN` (+ Credit / You Gave): Funds/goods provided. Increases Receivable.
   - `MONEY_OUT` (- Debit / You Got): Funds/repayment received. Decreases Receivable / Increases Payable.
2. **Deterministic Running Balance**:
   $$\text{Balance} = \sum (\text{ACTIVE MONEY\_IN}) - \sum (\text{ACTIVE MONEY\_OUT})$$
3. **Status Badges**:
   - `RECEIVABLE` ($>0$, Emerald `#10B981`)
   - `PAYABLE` ($<0$, Rose `#F43F5E`)
   - `SETTLED` ($=0$, Slate `#64748B`)

---

## 2. Financial Integrity Corrections

### 2.1 Non-Destructive Transaction Reversals
- Reversing a transaction does **NOT physically DELETE** database rows.
- Sets `status = 'REVERSED'`, `reversed_at = NOW()`, `reversed_by = userId`, `reversal_reason = reason`.
- `getAccountTotals` filters `WHERE status = 'ACTIVE'`, dynamically adjusting balances while preserving historical audit trails.
- Duplicate reversal attempts are safely rejected with `KHATA_TRANSACTION_ALREADY_REVERSED` (400 Bad Request) and cannot alter the ledger more than once.

### 2.2 Account Archiving & FK Protection
- Accounts can be archived (`status = 'ARCHIVED'`). Historical transaction history remains preserved and viewable.
- Posting new transactions to an archived account is **strictly rejected** with HTTP 400 (`ACCOUNT_ARCHIVED`).
- Foreign Key constraint `khata_transactions.account_id` enforces **`ON DELETE RESTRICT`**. Account deletion cannot cascade-delete transaction history.

---

## 3. Database Schema & Migration Journal

### Migrations
- Initial DDL: `apps/api/src/db/migrations/0001_khata_schema.sql`
- Integrity DDL: `apps/api/src/db/migrations/0002_khata_integrity.sql`
- Journal Registry: `apps/api/src/db/migrations/meta/_journal.json`

---

## 4. Security & Development Identity Boundary
- **Development Identity Adapter**: The current `x-user-id` header mechanism is a `DevelopmentIdentityAdapter` providing a temporary authenticated-user boundary for local development and testing until future production authentication layers are implemented. It is **NOT** production authentication.
- **Fail-Closed Execution**: Fastify preHandler hook enforces `resolveDevelopmentIdentity(request)` with `z.string().uuid()` validation. Requests without a valid `x-user-id` header or with a malformed/non-UUID value are strictly rejected with HTTP 401 Unauthorized rather than assigned a default user. No default user fallback occurs.
- **Server-Side Ownership**: Server-side repository layer enforces `WHERE user_id = :userId`. User B cannot read, modify, archive, or post transactions to User A's accounts (returns 404 / rejected).

---

## 5. Verification Results
- **Vitest Unit Test Suite**:
  - `apps/api`: **21 / 21 tests passed** (includes ownership, archive, reversal, and HTTP 401/404 identity boundary tests).
  - `apps/web`: **12 / 12 tests passed**.
  - **Total**: **33 / 33 tests passed**.
- **TypeScript Type-Check**: **0 errors**.
- **Production Web Build**: Vite production build succeeded cleanly (`✓ built in 15.92s`).

