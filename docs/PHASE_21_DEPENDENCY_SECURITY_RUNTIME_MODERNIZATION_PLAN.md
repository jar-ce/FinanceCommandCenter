# PHASE 21 — DEPENDENCY SECURITY & RUNTIME MODERNIZATION PLAN

**Project:** Finance Command Center — APEX OS  
**Codename:** APEX OS  
**Repository Path:** `D:\FinanceCommandCenter`  
**GitHub Repository:** `https://github.com/jar-ce/FinanceCommandCenter.git`  
**Primary Branch:** `main`  
**Baseline Commit:** `125c8dc90aaf2c30c3187dfad490563becda62a4`  
**Document Status:** READY FOR AUDIT (PLANNING ONLY)  

---

## 1. Executive Summary

Phase 20 implementation is complete with full functional, security, financial, and architectural integrity verified across 37 Vitest test files and 298 passing tests. However, the production release gate remains **BLOCKED** due to 12 unresolved `npm audit` advisories (7 moderate, 4 high, 1 critical), including high/critical runtime exposures in **Fastify 4.x** and **Drizzle ORM 0.36.x**.

Phase 21 is a dedicated **Planning & Execution Framework** for Dependency Security Remediation, Framework Migration, and Toolchain Modernization. This reconciled document establishes the precise, evidence-based upgrade targets, minimum secure release boundaries, breaking change mitigations, test matrices, and rollback procedures required to achieve a clean production security audit without altering Phase 0–20 functional contracts, financial precision, or system security boundaries.

> [!IMPORTANT]  
> **This phase is PLANNING ONLY.** No source code modifications, package installations, version upgrades, lockfile edits, schema changes, or deployments are executed during this planning pass.

---

## 2. Current Baseline

- **Test Suite Verification:** 37 Vitest test files | 298 total tests | 298 passed | 0 failed | 0 skipped
- **Static Analysis Gate:** `npm run type-check` PASSED (`npx tsc -b`)
- **Compilation Gate:** `npm run build` PASSED
- **Database Schema Boundary:** 0 new tables | 0 new migrations | 0 schema changes
- **Database Engine Architecture:** PostgreSQL production adapter implemented (`drizzle-orm/node-postgres` with `pg.Pool`), PGlite preserved for local development/test isolation
- **Authentication Lifecycle:** HMAC-SHA256 structured signed tokens (15m access / 7d refresh), `RedisTokenRevocationStore` (ioredis v6), production fail-fast on missing `REDIS_URL`
- **Current `npm audit` Output:** 12 vulnerabilities (7 moderate, 4 high, 1 critical)
- **Production Release Status:** **BLOCKED** by unresolved runtime dependency vulnerabilities

> [!NOTE]  
> The vulnerability count (12 vulnerabilities: 7 moderate, 4 high, 1 critical) and severity distribution above represent the exact `npm audit` output observed for the repository baseline. Individual upstream advisories may have different GHSA severity classifications; the `npm audit` result remains the authoritative repository release-gate input after implementation.

---

## 3. Runtime Audit & Node.js Policy

### 3.1 Environment & Engine Alignment Table

| Layer | Current Version | Selected Target | Policy & Justification |
| :--- | :--- | :--- | :--- |
| **Local Development** | Node.js `v24.11.1` | Node.js `24.x` | **Retain**: Workstation runs Node `v24.11.1`. Full test suite compatibility verified locally across all workspace tests. |
| **CI Workflow** | Node.js `20.x` | Node.js `22.x` | **Controlled LTS Baseline**: Upgrades `.github/workflows/ci.yml` from Node 20 to Node 22 Active LTS for reproducible CI build validation. |
| **package.json Engines**| `"node": ">=20.0.0"` | `"node": ">=22.0.0"` | **Permissive Boundary**: Supports CI Node 22 LTS baseline while permitting local execution on Node 24 without artificial version friction. |
| **Production Runtime** | Not provisioned | Node.js `22+` | **Deployment Policy**: Must align with production container/infrastructure runtime policies upon provisioning. |

### 3.2 Node.js Policy Terminology

Node 22 is the selected CI compatibility baseline within the currently supported LTS lines. Node 24 is the current local development LTS runtime and remains permitted by the `>=22` engine policy. CI uses Node 22 intentionally as a controlled reproducibility baseline, not because Node 24 is unsupported.

---

## 4. Complete Dependency Inventory

### 4.1 API Workspace Dependencies (`apps/api/package.json`)

| Package | Installed Version | Type | Vulnerability Severity | Affected Range | Minimum Secure Version | Selected Implementation Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fastify` | `4.29.1` | Prod | **Mixed (See Advisory Table)** | `<=5.12.0` | `5.12.5` | `^5.12.5` |
| `fastify-type-provider-zod` | `2.1.0` | Prod | **HIGH** (Transitive) | Fastify 4 bound | `4.0.0` | `^4.0.0` (Fastify 5 + Zod 3 compatible) |
| `@fastify/cors` | `9.0.1` | Prod | **HIGH** (Transitive) | Fastify 4 bound | `10.0.0` | `^11.3.0` (Fastify 5 compatible) |
| `@fastify/rate-limit` | `9.1.0` | Prod | **HIGH** (Transitive) | Fastify 4 bound | `10.0.0` | `^11.2.0` (Fastify 5 compatible) |
| `drizzle-orm` | `0.36.4` | Prod | **HIGH** | `<0.45.2` | `0.45.2` | `^0.45.3` |
| `drizzle-kit` | `0.28.1` | Dev | **MODERATE** (Transitive) | `<0.30.0` | `0.30.0` | `^0.31.11` |
| `@electric-sql/pglite` | `0.2.17` | Prod | Clean | N/A | `0.2.17` | Retain `0.2.17` |
| `pg` | `8.23.0` | Prod | Clean | N/A | `8.23.0` | Retain `8.23.0` |
| `@types/pg` | `8.23.1` | Dev | Clean | N/A | `8.23.1` | Retain `8.23.1` |
| `ioredis` | `6.0.0` | Prod | Clean | N/A | `6.0.0` | Retain `6.0.0` |
| `@types/ioredis` | `4.28.10` | Dev | **Legacy Typing** | Legacy v4 types | Built-in | **REMOVE** (ioredis v6 includes types) |
| `zod` | `3.25.76` | Shared | Clean | N/A | `3.25.76` | Retain `3.25.76` (Zod 3 Strategy) |
| `decimal.js` | `10.6.0` | Shared | Clean | N/A | `10.6.0` | Retain `10.6.0` |
| `pino` | `9.14.0` | Prod | Clean | N/A | `9.14.0` | Retain `9.14.0` |
| `pino-pretty` | `11.3.0` | Dev | Clean | N/A | `11.3.0` | Retain `11.3.0` |

> [!NOTE]  
> Fastify 4.29.1 is affected by multiple currently identified advisories with mixed severities. The individual advisory table in Section 5 is authoritative for specific severity levels.

### 4.2 Web Workspace Dependencies (`apps/web/package.json`)

| Package | Installed Version | Type | Vulnerability Severity | Affected Range | Minimum Secure Version | Selected Implementation Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `react` | `19.3.0` | Prod | Clean | N/A | `19.3.0` | Retain `19.3.0` |
| `react-dom` | `19.3.0` | Prod | Clean | N/A | `19.3.0` | Retain `19.3.0` |
| `react-router-dom` | `7.18.3` | Prod | Clean | N/A | `7.18.3` | Retain `7.18.3` |
| `vite` | `5.4.21` | Dev | **MODERATE** (Transitive) | `<=6.4.2` | `6.4.3` | `^6.4.3` |
| `@vitejs/plugin-react` | `4.7.0` | Dev | Clean | Compatible | `4.3.4` | `^4.3.4` (Vite 6 compatible) |
| `vitest` | `2.1.9` | Dev | **MODERATE / HIGH** | `>=2.1.0 <4.1.11` | `4.1.11` | `^4.1.11` |
| `lucide-react` | `1.46.0` | Prod | Clean | N/A | `1.46.0` | Retain `1.46.0` |
| `zustand` | `5.0.15` | Prod | Clean | N/A | `5.0.15` | Retain `5.0.15` |

---

## 5. Current Security Advisory Inventory

| Advisory ID | Subject & Description | Severity | Affected Range | Patched Version | Installed | Exposure Status | Selected Target Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GHSA-mrq3-vjjr-p77c** | DoS via Unbounded Memory Allocation in `sendWebStream`. | LOW | `<=5.7.2` | `>=5.7.3` / `4.29.2` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-jx2c-rxcm-jvmq** | Content-Type header tab character allows body validation bypass. | HIGH | `<5.7.2` | `>=5.7.2` / `4.29.2` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-444r-cwp2-x5xf** | `request.protocol` and `request.host` spoofable via `X-Forwarded-Proto`/`Host` from untrusted connections when `trustProxy` uses restrictive trust function. | MODERATE | `<=5.8.2` | `5.8.3` / `4.29.3` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-w2qp-rph6-63g4** | Fastify vulnerable to schema validation bypass via root primitive coercion mismatch. | MODERATE | `<5.12.1` | `5.12.1` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-3m5p-2c4r-xxw2** | Fastify vulnerable to `X-Forwarded-*` spoofing under `trustProxy` hop-count. | MODERATE | `>=5.8.3 <5.12.1` | `5.12.1` | `4.29.1` | **Not affected at installed 4.29.1** (Target `5.12.5` is above patched version) | Upgrade to `fastify ^5.12.5`. |
| **GHSA-9q9j-q6p8-xq58** | Fastify vulnerable to request validation bypass via skipped boolean `false` schemas (falsy JSON Schema boolean `false` skipped for body, querystring, params, or headers). | HIGH | `<5.12.2` | `5.12.2` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-hwr6-493r-vm6h** | Fastify vulnerable to authentication bypass via malformed URLs reaching encapsulated not-found handlers (malformed URLs route to wrong encapsulated not-found handler). | HIGH | `<5.12.2` | `5.12.2` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-p68q-wchp-6fh7** | Fastify vulnerable to request body replacement via an async validation result collision (validated request part replaced when async validator result contains an attacker-controlled `value` property). | HIGH | `>=4.0.0 <5.12.2` | `5.12.2` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-667r-xxjv-c9mm** | Fastify vulnerable to request body replacement via an async validation result collision. | HIGH | `<5.12.2` | `5.12.2` | `4.29.1` | **Confirmed Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-4mh8-r7rc-xpvc** | Fastify vulnerable to Denial of Service via unhandled exception on HTTP/2 trailer responses (impact requires HTTP/2 enabled and route using `reply.trailer()`). | MODERATE | `<5.12.5` | `5.12.5` | `4.29.1` | **Potential Runtime** | Upgrade to `fastify ^5.12.5`. |
| **GHSA-c96f-x56v-gq3h** | `find-my-way` HTTP/2 DDoS vulnerability (transitive via Fastify 4.x). | HIGH | `<=9.6.0` | `9.7.0` | `8.2.2` | **Transitive Runtime** | Resolves via Fastify 5 (`find-my-way ^9.7.0`). |
| **GHSA-gpj5-g38j-94v9** | Drizzle ORM SQL injection via `sql.identifier` / `.as()`. | HIGH | `<0.45.2` | `0.45.2` | `0.36.4` | **Potential Runtime** (Zero source usage) | Upgrade to `drizzle-orm ^0.45.3`. |
| **GHSA-82fw-gwwq-j7x9** | `vitest` / `@vitest/mocker` path traversal in mock redirect handler. | MODERATE | `>=2.1.0 <4.1.11` | `4.1.11` | `2.1.9` | **Dev / Test Tooling** | Upgrade to `vitest ^4.1.11`. |
| **GHSA-67mh-4wv8-2f99** | `esbuild` local dev server request forgery (via `vite@5` & `drizzle-kit@0.28`). | MODERATE | `<=0.24.2` | `0.25.0` | `0.21.5` | **Dev / Build Tooling** | Upgrade `vite` to `^6.4.3` and `drizzle-kit` to `^0.31.11`. |

---

## 6. Fastify v5 Security Analysis & Plugin Alignment

### 6.1 Fastify v5 Upgrade Target

- **Selected Target:** `fastify ^5.12.5`
- **Rationale:** The selected target is the current stable Fastify 5 release in the planning baseline and is at or above the patched versions of the applicable Fastify advisories identified for this project (GHSA-mrq3-vjjr-p77c, GHSA-jx2c-rxcm-jvmq, GHSA-444r-cwp2-x5xf, GHSA-w2qp-rph6-63g4, GHSA-3m5p-2c4r-xxw2, GHSA-9q9j-q6p8-xq58, GHSA-hwr6-493r-vm6h, GHSA-p68q-wchp-6fh7, GHSA-667r-xxjv-c9mm, GHSA-4mh8-r7rc-xpvc).

### 6.2 Fastify Plugin Targets

- **`@fastify/cors`**: Upgrade from `9.0.1` to `^11.3.0` (Fastify 5 native plugin).
- **`@fastify/rate-limit`**: Upgrade from `9.1.0` to `^11.2.0` (Fastify 5 native plugin).
- **`fastify-type-provider-zod`**: Upgrade from `2.1.0` to `^4.0.0` (Fastify 5 compatible while preserving Zod 3).

---

## 7. Zod & Fastify Type Provider Strategy (Strategy A)

### 7.1 Empirical Package Peer Dependency Audit

Authoritative registry lookup via `npm view`:
- `fastify-type-provider-zod@4.0.0`: `{ zod: '^3.14.2', fastify: '^5.0.0' }`
- `fastify-type-provider-zod@5.0.0`: `{ zod: '>=3.25.56', fastify: '^5.0.0' }`
- `fastify-type-provider-zod@6.0.0`: `{ zod: '>=4.1.5', fastify: '^5.0.0' }` (Requires Zod 4)
- `fastify-type-provider-zod@7.0.0`: `{ zod: '>=4.1.5', fastify: '^5.5.0' }` (Requires Zod 4)

### 7.2 Selected Strategy: Strategy A (Retain Zod 3)

- **Selected Combination:** `fastify-type-provider-zod ^4.0.0` + `zod 3.25.76` + `fastify ^5.12.5`.
- **Rationale:** `fastify-type-provider-zod@^4.0.0` provides native Fastify 5 support while declaring peer dependency compatibility with Zod 3 (`^3.14.2`). This preserves domain schema stability and avoids a major Zod 4 refactoring across all application routes and Drizzle schemas.

---

## 8. Drizzle ORM Security Analysis

- **Installed Version:** `drizzle-orm 0.36.4` (Vulnerable to GHSA-gpj5-g38j-94v9).
- **Minimum Secure Version:** `0.45.2`
- **Selected Implementation Target:** `drizzle-orm ^0.45.3` & `drizzle-kit ^0.31.11`
- **Empirical Code Inspection:** Grep search confirms zero raw `sql.identifier`, `.as()`, or `sql.raw` calls with untrusted inputs in APEX OS repositories. All domain repositories use Drizzle relational query builders.

---

## 9. Vite & Vitest Security Analysis

- **Vitest Target Correction:**
  - **Advisory:** GHSA-82fw-gwwq-j7x9 affects Vitest `>=2.1.0 <4.1.11`. Vitest 3.x is **NOT** secure against this advisory.
  - **Minimum Secure Version:** `4.1.11`
  - **Selected Implementation Target:** `vitest ^4.1.11`
  - **Compatibility:** Fully compatible with `@testing-library/react` 16.x, `jsdom` 25.x, and React 19.
- **Vite Target Selection:**
  - **Minimum Secure Version:** `6.4.3` (remediates `esbuild` GHSA-67mh-4wv8-2f99).
  - **Selected Implementation Target:** `vite ^6.4.3` alongside `@vitejs/plugin-react ^4.3.4`.

---

## 10. Transitive Dependency Resolution Graph

```mermaid
graph TD
    Fastify5["fastify ^5.12.5"] --> FindMyWay["find-my-way ^9.7.0 (Fixes GHSA-c96f-x56v-gq3h)"]
    Fastify5 --> LightMyRequest["light-my-request ^6.0.0"]
    Vite6["vite ^6.4.3"] --> Esbuild25["esbuild ^0.25.0 (Fixes GHSA-67mh-4wv8-2f99)"]
    DrizzleKit31["drizzle-kit ^0.31.11"] --> Esbuild25
    Vitest4["vitest ^4.1.11"] --> VitestMocker["@vitest/mocker ^4.1.11 (Fixes GHSA-82fw-gwwq-j7x9)"]
    Drizzle045["drizzle-orm ^0.45.3"] --> DrizzleCore["drizzle-orm core (Fixes GHSA-gpj5-g38j-94v9)"]
```

Expected resolution: The selected direct upgrades are intended to replace affected transitive versions. Final confirmation is determined empirically via `npm ls` and `npm audit` after implementation.

---

## 11. Security Minimum vs. Selected Implementation Target Matrix

| Package | Installed | Advisory ID | Minimum Secure Version | Supported/Current | Selected Implementation Target | Primary Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fastify` | `4.29.1` | GHSA-mrq3-vjjr-p77c, etc. | `5.12.5` | `5.12.5` | `^5.12.5` | Fastify Security Remediation |
| `fastify-type-provider-zod` | `2.1.0` | Transitive | `4.0.0` | `7.0.0` | `^4.0.0` | Fastify 5 + Zod 3 Alignment |
| `@fastify/cors` | `9.0.1` | Transitive | `10.0.0` | `11.3.0` | `^11.3.0` | Fastify 5 Plugin Alignment |
| `@fastify/rate-limit` | `9.1.0` | Transitive | `10.0.0` | `11.2.0` | `^11.2.0` | Fastify 5 Plugin Alignment |
| `drizzle-orm` | `0.36.4` | GHSA-gpj5-g38j-94v9 | `0.45.2` | `0.45.3` | `^0.45.3` | Drizzle Security Remediation |
| `drizzle-kit` | `0.28.1` | GHSA-67mh-4wv8-2f99 | `0.30.0` | `0.31.11` | `^0.31.11` | Drizzle 0.45 + esbuild Security |
| `vite` | `5.4.21` | GHSA-67mh-4wv8-2f99 | `6.4.3` | `8.3.1` | `^6.4.3` | Vite 6 Security Minimum |
| `@vitejs/plugin-react` | `4.7.0` | Compatibility | `4.3.4` | `6.1.1` | `^4.3.4` | Vite 6 Plugin Alignment |
| `vitest` | `2.1.9` | GHSA-82fw-gwwq-j7x9 | `4.1.11` | `5.0.2` | `^4.1.11` | Vitest Security Remediation |
| `zod` | `3.25.76` | N/A | `3.25.76` | `3.25.76` | Retain `3.25.76` | Preserve Domain Schema Stability |
| `@types/ioredis` | `4.28.10` | N/A | N/A | N/A | **REMOVE** | Clean Legacy Typing Package Removal |

---

## 12. Breaking Change Matrix

| Component | Potential Breaking Change | Affected Source File | Refactoring & Remediation Action |
| :--- | :--- | :--- | :--- |
| **Fastify App Init** | Fastify 5 plugin generic signatures | `apps/api/src/app.ts` | Verify CORS, rate-limit, and Zod type provider plugin registration calls. |
| **Fastify CORS** | `@fastify/cors` v11 origin callback type | `apps/api/src/app.ts` | Ensure `origin` callback return type matches `(err, allow) => void` signature. |
| **Drizzle Raw Exec** | `db.execute(sql...)` result typing | `apps/api/src/__tests__/financial-precision.test.ts` | Retain explicit `result: any` typing cast. |
| **Vite 6 Config** | Dev server & build output defaults | `apps/web/vite.config.ts` | Confirm build outputs match `dist/` directory structure. |
| **Vitest 4 Runner** | Environment & runner setup | `apps/web/vite.config.ts` | Verify jsdom environment setup under Vitest 4. |

---

## 13. File-by-File Impact Plan

| File Path | Current Purpose | Proposed Phase 21 Change | Reason | Risk |
| :--- | :--- | :--- | :--- | :--- |
| `package.json` | Root workspace manifest | Set `"engines": { "node": ">=22.0.0" }` | Node 22 LTS Engine Policy | Low |
| `.github/workflows/ci.yml` | CI Action pipeline | Set `node-version: 22` | Align CI runtime with Node 22 LTS | Low |
| `apps/api/package.json` | API dependencies | Update `fastify`, `drizzle-orm`, `fastify-type-provider-zod`, plugins; remove `@types/ioredis` | Security remediation | Medium |
| `apps/web/package.json` | Web dependencies | Update `vite`, `vitest`, `@vitejs/plugin-react` | Security remediation | Medium |
| `apps/api/src/app.ts` | Fastify initialization | Update plugin registration signatures if needed | Fastify 5 compatibility | Low |

---

## 14. Testing & Regression Plan

Following dependency updates in implementation, the full quality suite will be executed:

1. **Full Suite Execution:** Run `npm run test` across `apps/api` and `apps/web` (37 test files, 298 tests).
2. **Static Analysis:** Run `npm run type-check` (`npx tsc -b`).
3. **Production Compilation:** Run `npm run build`.
4. **Subsystem Regression Coverage:**
   - **Auth Lifecycle:** Login, HMAC token parsing, rotation, Redis revocation store, production fail-fast checks (`auth-lifecycle.test.ts`, `security-remediation.test.ts`).
   - **Financial Arithmetic:** `Decimal.js` calculations, PostgreSQL `NUMERIC(18,4)` storage precision (`financial-precision.test.ts`).
   - **Concurrency:** Transaction atomicity, row-level locking (`concurrency-regression.test.ts`).
   - **Performance:** Readiness route latency, dashboard aggregation latency (`performance-benchmark.test.ts`).

---

## 15. Security Regression Plan

Automated test verification will explicitly cover:
- **SEC-01:** Rejection of caller-controlled identity headers without valid authentication token.
- **SEC-02:** Enforcement of security headers (`x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy`, `content-security-policy`).
- **SEC-03:** Production secret fail-fast verification for `JWT_SECRET` and missing `REDIS_URL`.
- **SEC-04:** Admin RBAC enforcement on privileged market master routes.
- **SEC-05:** Rejection of unauthenticated requests across all API domain routes.
- **SEC-06:** CORS origin restrictions.

---

## 16. Financial Regression Barrier

Financial behavior and engine precision are strictly protected:
- `Decimal.js` immutable arithmetic logic
- PostgreSQL `NUMERIC(18,4)` storage scale
- Portfolio cost basis and P&L calculations
- Digital Khata ledger transactions
- IPO price band calculations
- Market quote cache freshness semantics

No dependency migration is permitted to alter financial outputs.

---

## 17. Database Boundary

- **New Tables:** 0
- **New Migrations:** 0
- **Schema Changes:** 0
- **Engine Support:** PGlite (development/testing) + PostgreSQL node-postgres adapter (production) remain intact.

---

## 18. Audit Gate Definition & Release Policy

Following implementation, the security release gate requires:

```bash
npm audit --audit-level=high
```

Must return **0 high and 0 critical vulnerabilities** (Exit Code 0).

> [!NOTE]  
> The selected targets are intended to remediate the currently identified advisories. Final security closure is determined empirically after dependency resolution, clean installation, `npm audit`, type-check, tests, build, and transitive dependency verification.

- **PASS:** 0 High / 0 Critical vulnerabilities. System status transitions to `PHASE 21 — IMPLEMENTATION COMPLETE — PRODUCTION RELEASE ELIGIBLE`.
- **BLOCKED:** >0 High / Critical vulnerabilities remain. System status remains `PRODUCTION RELEASE BLOCKED`.

---

## 19. Rollback Plan

If any breaking incompatibility occurs during implementation:
1. Revert repository state to baseline commit:
   `git reset --hard 125c8dc90aaf2c30c3187dfad490563becda62a4`
2. Restore clean lockfile:
   `npm ci`
3. Verify baseline integrity via `npm run test`, `npm run type-check`, `npm run build`.
4. Zero database rollback is needed because no database schema changes or migrations are introduced in Phase 21.

---

## 20. Risk Register

| Risk | Severity | Probability | Compensating Control |
| :--- | :--- | :--- | :--- |
| Fastify 5 plugin generic signature mismatch | Medium | Low | `fastify-type-provider-zod@^4.0.0` provides Fastify 5 + Zod 3 compatible types. |
| Drizzle 0.45.x query builder compilation error | Low | Low | Grep inspection confirms zero raw `sql.identifier` / `.as()` usage in domain repositories. `npm run type-check` will catch any type mismatch before commit. |
| Vite 6 web bundling regression | Low | Low | Verified via `npm run build` production compilation gate. |

---

## 21. Implementation Sequence (Post-Authorization)

```
Step 1: Check out baseline commit 125c8dc90aaf2c30c3187dfad490563becda62a4 and verify clean working tree.
Step 2: Update engines field in package.json to ">=22.0.0" and node-version in .github/workflows/ci.yml to Node 22 LTS.
Step 3: Update apps/api/package.json with fastify ^5.12.5, fastify-type-provider-zod ^4.0.0, @fastify/cors ^11.3.0, @fastify/rate-limit ^11.2.0, drizzle-orm ^0.45.3, drizzle-kit ^0.31.11; remove @types/ioredis.
Step 4: Update apps/web/package.json with vite ^6.4.3, @vitejs/plugin-react ^4.3.4, vitest ^4.1.11.
Step 5: Execute npm install to generate updated package-lock.json (v3).
Step 6: Apply any minor Fastify 5 API compatibility adjustments in apps/api/src/app.ts if required.
Step 7: Run npm run type-check to confirm zero TypeScript compilation errors.
Step 8: Run npm run test across all workspace test files (verify 37 test files / 298 tests pass).
Step 9: Run npm run build to verify production bundle compilation.
Step 10: Run npm audit --audit-level=high to verify 0 high and 0 critical vulnerabilities.
Step 11: Run npm ls fastify drizzle-orm vite vitest find-my-way esbuild to verify clean transitive resolution.
Step 12: Execute clean checkout & npm ci verification.
Step 13: Run full security, financial, and concurrency regression tests.
Step 14: Stage package.json, package-lock.json, .github/workflows/ci.yml, apps/api/package.json, apps/web/package.json, apps/api/src/app.ts, and planning docs.
Step 15: Commit with message "fix: remediate dependency vulnerabilities and modernize runtime".
Step 16: Push commit to origin main.
Step 17: Verify LOCAL HEAD == REMOTE MAIN and working tree is clean.
Step 18: Produce final Phase 21 execution report.
```

---

## 22. Verification Sequence

1. `npm run test` (37 test files, 298 tests passed)
2. `npm run type-check` (Clean exit code 0)
3. `npm run build` (Clean exit code 0)
4. `npm audit --audit-level=high` (0 high, 0 critical)

---

## 23. Phase 21 Final Approval Gate

| Gate | Status |
| :--- | :--- |
| Current audit verified | **PASS** |
| Current dependency versions verified via `npm view` | **PASS** |
| Current advisories verified (GHSA-9q9j-q6p8-xq58, GHSA-hwr6-493r-vm6h, GHSA-3m5p-2c4r-xxw2, etc.) | **PASS** |
| Fastify target verified (`^5.12.5`) | **PASS** |
| Fastify plugin compatibility verified (`@fastify/cors ^11.3.0`, `@fastify/rate-limit ^11.2.0`) | **PASS** |
| Vitest security target corrected (`^4.1.11` minimum fixed `4.1.11`) | **PASS** |
| Vite security target justified (`^6.4.3` minimum fixed `6.4.3`) | **PASS** |
| Zod / Type Provider compatibility resolved (`fastify-type-provider-zod ^4.0.0` + Zod 3) | **PASS** |
| Drizzle target verified (`^0.45.3`) | **PASS** |
| Transitive dependencies analyzed | **PASS** |
| Node 22 vs 24 decision justified (Node 22 LTS CI / `>=22.0.0` engine) | **PASS** |
| Breaking change analysis evidence-based | **PASS** |
| Tests defined | **PASS** |
| Security regression defined | **PASS** |
| Financial regression protection defined | **PASS** |
| Rollback defined (`125c8dc90aaf2c30c3187dfad490563becda62a4`) | **PASS** |
| Audit gate defined (0 High / 0 Critical) | **PASS** |
| Source-code changes | **NONE** |
| Package changes | **NONE** |
| Lockfile changes | **NONE** |
| Database changes | **NONE** |
| **Implementation Readiness** | **READY FOR IMPLEMENTATION AUTHORIZATION** |

---

**PHASE 21 PLAN STATUS:**

**READY FOR IMPLEMENTATION AUTHORIZATION**

**Implementation:**  
NOT AUTHORIZED

**Source Code Changes:**  
NONE

**Dependency Changes:**  
NONE

**Lockfile Changes:**  
NONE

**Database Changes:**  
NONE

**CI Changes:**  
NONE
