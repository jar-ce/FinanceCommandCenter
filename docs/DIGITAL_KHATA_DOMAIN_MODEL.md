# APEX OS — Digital Khata Domain Model & Financial Accounting Specification

## Executive Summary
Digital Khata is an enterprise-grade Accounts Receivable & Payable ledger engine within **Finance Command Center — APEX OS**. It provides strict double-entry-compatible balance tracking, non-destructive historical transaction auditing, multi-tenant server-side ownership enforcement, and 28-digit financial arithmetic.

---

## 1. Core Domain Entities

### 1.1 Account (`KhataAccount`)
- **Purpose**: Represents a external entity (customer, supplier, business partner, or personal contact) with whom financial credit or debt transactions are logged.
- **Identity & Lifecycle**:
  - `id`: Globally unique UUID v4 primary key.
  - `userId`: Owner UUID v4 referencing `users.id`.
  - `status`: Account lifecycle state (`'ACTIVE'` | `'ARCHIVED'`).
  - `archivedAt`: UTC timestamp recorded when an account is archived.
- **Lifecycle Semantics**:
  - **`ACTIVE`**: Account actively participates in financial operations. Can view ledger and post new transactions.
  - **`ARCHIVED`**: Account is soft-archived. Historical transaction ledger and balance remain **completely preserved and queryable**. However, **posting new transactions to an archived account is strictly rejected**.

### 1.2 Transaction (`KhataTransaction`)
- **Purpose**: Represents an immutable financial event between the user and an account.
- **Posting Types**:
  - **`MONEY_IN`** (+ Credit / You Gave): Money or goods/services extended to the account holder. Increases Receivable balance.
  - **`MONEY_OUT`** (- Debit / You Got): Money or repayment received from the account holder. Decreases Receivable / Increases Payable balance.
- **Transaction Immutability & Reversal Policy**:
  - Financial transactions are **never physically deleted** from the database.
  - Correcting or canceling a transaction marks `status = 'REVERSED'`, storing `reversed_at`, `reversed_by`, and `reversal_reason`.
  - Reversed transactions remain permanently stored and queryable in historical ledger statements for complete auditability.
  - **Reversal Semantics**: Duplicate reversal attempts are safely rejected with `KHATA_TRANSACTION_ALREADY_REVERSED` (400 Bad Request) and cannot alter the ledger more than once.

---

## 2. Balance Mechanics & Authoritative Equation

### 2.1 Authoritative Balance Equation
$$\text{Account Net Balance} = \sum (\text{ACTIVE MONEY\_IN}) - \sum (\text{ACTIVE MONEY\_OUT})$$

- **Effective Ledger**: Reversed transactions (`status = 'REVERSED'`) are automatically excluded from the running balance calculation.

### 2.2 Sign Convention & UI Communication
- **Positive ($>0$)**: `RECEIVABLE` (The account holder owes money to the user). Highlighted in Emerald (`#10B981`).
- **Negative ($<0$)**: `PAYABLE` (The user owes money to the account holder). Highlighted in Rose (`#F43F5E`).
- **Zero ($=0$)**: `SETTLED` (No outstanding balance). Highlighted in Muted Slate (`#64748B`).

---

## 3. Database Schema & Integrity Guarantees

### 3.1 `khata_accounts` Table
- `id` (UUID v4 PK)
- `user_id` (UUID v4 FK -> `users.id` ON DELETE CASCADE)
- `display_name` (VARCHAR 255)
- `phone` (VARCHAR 50)
- `account_type` (VARCHAR 50 — `'CUSTOMER'`, `'SUPPLIER'`, `'BUSINESS'`, `'PERSONAL'`)
- `status` (VARCHAR 50 — `'ACTIVE'`, `'ARCHIVED'`)
- `created_at`, `updated_at`, `archived_at` (TIMESTAMPTZ)

### 3.2 `khata_transactions` Table
- `id` (UUID v4 PK)
- `account_id` (UUID v4 FK -> `khata_accounts.id` **ON DELETE RESTRICT**)
- `user_id` (UUID v4 FK -> `users.id` ON DELETE CASCADE)
- `type` (VARCHAR 50 — `'MONEY_IN'`, `'MONEY_OUT'`)
- `amount` (`NUMERIC(18, 4)`)
- `running_balance` (`NUMERIC(18, 4)`)
- `transaction_date` (TIMESTAMPTZ)
- `description` (TEXT)
- `reference` (VARCHAR 255)
- `status` (VARCHAR 50 — `'ACTIVE'`, `'REVERSED'`)
- `reversed_at` (TIMESTAMPTZ)
- `reversed_by` (UUID v4 FK -> `users.id` ON DELETE SET NULL)
- `reversal_reason` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.3 Foreign Key Restriction Policy
The `account_id` foreign key constraint enforces `ON DELETE RESTRICT`. An account cannot be deleted if transaction records exist, ensuring financial ledger integrity cannot be accidentally destroyed.

---

## 4. Security & Request Identity Architecture
- **Server-Side Ownership**: Every domain query and transaction operation enforces `WHERE user_id = :userId` at the SQL layer.
- **Development Identity Adapter**: The current `x-user-id` header mechanism is a `DevelopmentIdentityAdapter` providing a temporary authenticated-user boundary for local development and testing until future production authentication layers are implemented. It is **NOT** production authentication.
- **Fail-Closed Boundary**: The adapter is fail-closed. Requests without a valid development identity header (`x-user-id`) or with a malformed/non-UUID value are strictly rejected with HTTP 401 Unauthorized rather than assigned a default user. No default user fallbacks or implicit user creations occur.

