# APEX OS — Phase 8 — IPO Allotment Checker Technical Architecture & Domain Specification

## Executive Summary
Phase 8 introduces the **IPO Allotment Checker** module for **Finance Command Center — APEX OS**. It provides an independent verification layer to track, check, and manually record official and user-verified share allotment results associated with personal Phase 7 IPO applications (`ipo_applications`).

---

## 1. Domain Model & Accounting Semantics

### Domain Entity: `IPOAllotmentResult`
- **Identity**: `id` (UUID v4 PK), `userId` (UUID v4 FK to `users.id`, `ON DELETE RESTRICT`), `applicationId` (UUID v4 FK to `ipo_applications.id`, `ON DELETE RESTRICT`).
- **Allotment Status Domain**:
  - `UNKNOWN`: Initial unchecked status.
  - `PENDING`: Allotment process ongoing at registrar.
  - `ALLOTTED`: Full allotment received (`allottedQuantity == appliedQuantity`).
  - `PARTIALLY_ALLOTTED`: Partial shares allotted (`0 < allottedQuantity < appliedQuantity`).
  - `NOT_ALLOTTED`: Zero shares allotted (`allottedQuantity == 0`).
  - `REJECTED`: Application rejected by exchange/bank/registrar (`allottedQuantity == 0`).
- **Verification Status Domain**:
  - `UNVERIFIED`: Result entered without proof/source confirmation.
  - `VERIFIED`: Result officially confirmed or manually verified with explicit user confirmation.
  - `STALE`: Verified result is older than the freshness threshold.
  - `UNAVAILABLE`: Automated provider access is currently unavailable.
  - `MANUAL_REQUIRED`: Provider requires manual check via official registrar portal.
- **Verification Method**:
  - `PROVIDER_API`: Automated verification via provider API.
  - `PUBLIC_OFFICIAL`: Official public feed verification.
  - `MANUAL`: Explicit user manual verification confirmation.
- **Quantities & Ratios**: `appliedQuantity` (> 0), `allottedQuantity` (>= 0 and <= appliedQuantity), `allotmentRatio` (calculated via `Decimal.js`: `allottedQuantity / appliedQuantity`).
- **Provenance Metadata**: `provider`, `source`, `externalReference`, `retrievedAt`, `verifiedAt`, `notes`.

> **Phase 7 Decoupling Notice**: Allotment checking reads Phase 7 applications, but NEVER alters `ipo_applications.status` or reinterprets application completion (`COMPLETED`) as share allotment.

---

## 2. Single Canonical Result & State Protection Rules

### Single Canonical Record per Application
- **Unique Constraint**: Unique index on `application_id` (`idx_ipo_allotment_app_unique`) in `ipo_allotment_results`.
- **Single Canonical Record**: Repeated provider checks or manual verifications update the single canonical current result for that application rather than creating duplicate active records.

### State Protection Against Provider Refreshes
- **Rule**: A provider response returning `MANUAL_REQUIRED`, `UNAVAILABLE`, or `UNKNOWN` MUST NOT overwrite or downgrade an existing `ALLOTTED + VERIFIED + MANUAL` result.
- **Behavior**: When an application is already verified (`verificationStatus = VERIFIED`), executing a provider check where the provider is unavailable preserves the existing verified result and logs `IPO_ALLOTMENT_CHECK_UNAVAILABLE`.

---

## 3. History & Auditability Strategy
- **Current State**: Represented strictly by the single canonical row in `ipo_allotment_results`.
- **Material History**: Historical transitions (checks, retrievals, manual verifications, provider unavailability) are recorded in the central `audit_logs` table (`IPO_ALLOTMENT_CHECK_REQUESTED`, `IPO_ALLOTMENT_CHECK_UNAVAILABLE`, `IPO_ALLOTMENT_RESULT_RETRIEVED`, `IPO_ALLOTMENT_MANUAL_VERIFICATION`).
- **Dedicated History Table**: Not created for Phase 8. Full historical observations are auditably reconstructed via `audit_logs`.

---

## 4. Manual Verification Provenance & Safety
- **Provenance**: Manual verification explicitly records `verificationMethod = MANUAL`, `verificationStatus = VERIFIED`, `verifiedAt`, `source`, and user `notes`.
- **Meaning**: "The user manually confirmed an official outcome from the registrar portal." It does NOT imply automated verification by APEX OS.
- **Zero Credential Storage**: No PAN, DP ID, passwords, OTPs, or authentication cookies are requested or stored.

---

## 5. Strict Quantity & Invariant Integrity
- `appliedQuantity` (> 0, source of truth is Phase 7 `ipo_applications.quantity_applied`).
- `0 <= allottedQuantity <= appliedQuantity`.
- `ALLOTTED` => `allottedQuantity == appliedQuantity`.
- `NOT_ALLOTTED` / `REJECTED` => `allottedQuantity == 0`.
- `PARTIALLY_ALLOTTED` => `0 < allottedQuantity < appliedQuantity`.

---

## 6. API Specification & Security Boundary
- `GET /api/v1/ipo/allotments`: List user's allotment results with pagination, filters (`status`, `verificationStatus`, `search`, `ipoId`, `applicationId`), and summary counts. Enforces identity `x-user-id`.
- `GET /api/v1/ipo/allotments/:id`: Detail view of single allotment record with joined canonical IPO, application, and verification provenance. Enforces identity `x-user-id`.
- `POST /api/v1/ipo/applications/check/:applicationId`: User-triggered check for an application. Runs provider check or returns manual workflow requirement. Enforces identity `x-user-id`.
- `POST /api/v1/ipo/applications/verify/:applicationId`: Record explicit manual verification. Enforces identity `x-user-id`.

---

## 7. Audit Logging
Mutating allotment events record audit entries in `audit_logs`:
- `IPO_ALLOTMENT_CHECK_REQUESTED`
- `IPO_ALLOTMENT_CHECK_UNAVAILABLE`
- `IPO_ALLOTMENT_RESULT_RETRIEVED`
- `IPO_ALLOTMENT_MANUAL_VERIFICATION`

No secrets, passwords, OTPs, or API keys are logged.

