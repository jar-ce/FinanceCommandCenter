# PHASE 23 — PRODUCTION PROVIDER SELECTION, INFRASTRUCTURE PROVISIONING & LIVE DEPLOYMENT PLAN

**Project:** Finance Command Center — APEX OS  
**Codename:** APEX OS  
**Repository Path:** `D:\FinanceCommandCenter`  
**GitHub Repository:** `https://github.com/jar-ce/FinanceCommandCenter.git`  
**Primary Branch:** `main`  
**Verified Phase 22 Baseline Commit:** `78c29c7035e8b1645279207fd80a333cf1292aba`  
**Document Status:** REFINED FOR IMPLEMENTATION REVIEW (PLANNING ONLY)  

---

## 1. Executive Summary

Phase 22 established complete repository production readiness. Containerization artifacts (`Dockerfile`, `.dockerignore`, `nginx.conf`), CI/CD deployment workflow extension (`.github/workflows/deploy.yml`), production environment templates (`.env.example`), production dual migration mechanics (`apps/api/src/db/migrate.ts`), root health/readiness probe routes (`/health`, `/health/readiness`, `/ready`), and an automated 6-probe production smoke test suite ([`production-smoke.test.ts`](file:///D:/FinanceCommandCenter/apps/api/src/__tests__/production-smoke.test.ts)) were created and verified across 38 Vitest test files and 304 passing tests.

However, Phase 22 explicitly documented five remaining operational gaps:
1. Production provider was **not selected**.
2. Cloud infrastructure was **not provisioned**.
3. Real production secrets were **not configured**.
4. Live production deployment was **not performed**.
5. Live HTTP smoke tests against deployed cloud endpoints were **not performed**.

Phase 23 is a dedicated **Planning-Only Framework** for selecting the cloud provider, provisioning target cloud infrastructure, injecting production secrets, running initial database migrations, deploying API container replicas and frontend static assets, performing live HTTP smoke testing, and handoff to production operations.

> [!IMPORTANT]  
> **ABSENCE OF LIVE PROVISIONING AUTHORIZATION**  
> This is a PLANNING-ONLY document. No cloud resources, database instances, Redis instances, DNS records, TLS certificates, production secret injections, application container deployments, or live migrations are authorized during Phase 23 planning.

---

## 2. Phase 22 Baseline Verification

The APEX OS repository is verified clean on `main` at commit `78c29c7035e8b1645279207fd80a333cf1292aba`:

| Metric / Layer | Baseline Value / Status | Verification Evidence |
| :--- | :--- | :--- |
| **Git Repository** | Clean, synchronized on `main` | Commit `78c29c7035e8b1645279207fd80a333cf1292aba` |
| **Runtime Engine** | Node.js `v24.11.1` (Local) / Node `22.x` (CI/CD) | `package.json` engine `>=22.0.0` & `.github/workflows/ci.yml` |
| **Security Audit Gate** | PASSED (0 High / 0 Critical) | `npm audit --audit-level=high` exit code `0` |
| **Automated Test Suite** | 38 test files, 304 tests passing | 244 API tests (incl. smoke suite) + 60 Web tests passing |
| **Type Compiler** | 0 TypeScript compilation errors | `npm run type-check` across monorepo |
| **Build Compilers** | Production bundle outputs valid | `npm run build` (`apps/api/dist/` & `apps/web/dist/`) |
| **Clean Installation** | Verified reproducible | `npm ci` cleanly installs 294 packages without drift |

---

## 3. Current Deployment Gaps

Before APEX OS can accept live user traffic, the following 5 operational gaps must be executed in sequence under explicit authorization:

```
[ Phase 22 Repository Ready ]
          |
          +--> GAP 1: Provider Selection & Decision (AWS vs GCP vs PaaS)
          +--> GAP 2: Infrastructure Provisioning (VPC, DB, Redis, Container Host)
          +--> GAP 3: Production Secret Injection (Secrets Manager -> Runtime ENV)
          +--> GAP 4: Pre-Deploy Migration & Live Application Deployment
          +--> GAP 5: Live Endpoint Smoke Testing & DNS Cutover
```

* **Gap 1 — Provider Selection:** The repository is provider-neutral. An explicit decision must be finalized regarding the cloud vendor or PaaS platform.
* **Gap 2 — Infrastructure Provisioning:** Production PostgreSQL database, Redis cluster, VPC networks, and container execution hosts are not yet provisioned.
* **Gap 3 — Secret Configuration:** Production `DATABASE_URL`, `REDIS_URL`, and random `JWT_SECRET` strings must be generated and populated into a secure secret vault.
* **Gap 4 — Live Application Deployment:** Container images must be compiled, tagged with commit SHA (`sha-78c29c7`), pushed to container registry, and launched.
* **Gap 5 — Live HTTP Smoke Verification:** Live domain ping (`GET /health/readiness`) must be executed against the live TLS URL.

---

## 4. Provider Evaluation & Decision Framework

### 4.1 Evaluation of Realistic Hosting Models

Three industry-standard deployment options were evaluated against APEX OS architectural requirements:

| Evaluation Criterion | Option A: AWS Cloud Native (ECS Fargate + RDS PostgreSQL + ElastiCache) | Option B: GCP Cloud Native (Cloud Run + Cloud SQL + Memorystore) | Option C: Managed PaaS (Render / Railway / Fly.io) |
| :--- | :--- | :--- | :--- |
| **Operational Complexity** | Medium-High (AWS IAM, VPC, ECS tasks, ALB setup). | Medium (GCP IAM, VPC Serverless Connector, Cloud Run). | **Low** (Automated git push / container deploy, minimal infra management). |
| **PostgreSQL Support** | AWS RDS PostgreSQL (Multi-AZ, SSL, WAL PITR). | GCP Cloud SQL PostgreSQL (SSL, PITR). | Managed PostgreSQL add-on (SSL, daily snapshots). |
| **Redis Support** | ElastiCache Redis 7+ (TLS, HA failover). | Memorystore Redis 7+ (TLS, HA). | Managed Redis add-on (TLS, Auth token). |
| **Container Execution** | AWS ECS Fargate (Node 22, non-root, auto-restart). | GCP Cloud Run (Node 22, stateless, auto-scale). | Web Service container runtime (Node 22, auto-restart). |
| **Frontend Web CDN** | S3 Bucket + AWS CloudFront (Edge SSL, rewrite rules). | Cloud Storage + Cloud CDN (Edge SSL). | Static Site / CDN hosting (Render Static / Cloudflare). |
| **Secret Management** | AWS Secrets Manager / Parameter Store. | GCP Secret Manager. | PaaS Environment Secret Vault. |
| **Security Isolation** | VPC Private Subnets, Security Groups. | VPC Private IP, Authorized Networks. | Private Network Peering / Internal URL routing. |
| **Cost Profile** | ~$80 - $200/mo baseline (RDS + ElastiCache + ECS). | ~$60 - $150/mo baseline (Cloud SQL + Run). | ~$25 - $70/mo baseline (Starter Managed DB + Redis). |

*Disclaimer: These figures are illustrative planning estimates only. Actual cost depends on provider, region, compute/database sizing, storage, backups, networking, traffic, availability configuration, and applicable free tiers or committed-use pricing. Final pricing must be verified against the selected provider before provisioning.*

### 4.2 Decision Framework & Status
* **Architectural Suitability:** All three options satisfy APEX OS requirements for Fastify containerization, native PostgreSQL `pg` SSL connectivity, and `RedisTokenRevocationStore`.
* **Explicit Status:** **PENDING USER/OWNER DECISION**. Final selection depends on owner budget, existing cloud enterprise subscriptions, and operational preferences. Provider choice will be confirmed prior to initiating live infrastructure provisioning.

---

## 5. Target Production Architecture

The proposed live target architecture provides strict network isolation, encrypted transit, and provider-agnostic component boundaries:

```
                                    [ PUBLIC INTERNET ]
                                             |
                                    (DNS: app.example.com)
                                             |
                                             v
                             +-------------------------------+
                             |    CDN / Web Application      |
                             |          Firewall             |
                             |   (Cloudflare / CloudFront)   |
                             +---------------+---------------+
                                             |
                     +-----------------------+-----------------------+
                     | (Static Web Request)                          | (API Request /api/v1/*)
                     v                                               v
       +---------------------------+                   +---------------------------+
       |   Static SPA Web Host     |                   |    Load Balancer / ALB    |
       |  (S3 / CDN Static Bucket) |                   | (HTTPS TLS 1.3 Offload)   |
       +---------------------------+                   +-------------+-------------+
                                                                     |
                                                                     v
                                                       +---------------------------+
                                                       |  VPC Private Subnet Host  |
                                                       |   Fastify API Container   |
                                                       |    (Node 22, Port 4000)   |
                                                       +-------------+-------------+
                                                                     |
                                         +---------------------------+---------------------------+
                                         | (Encrypted Private Transit)                           | (Encrypted Private Transit)
                                         v                                                       v
                          +-----------------------------+                         +-----------------------------+
                          | Managed PostgreSQL Database |                         |  Managed Redis HA Cluster   |
                          |  (Port 5432, SSL Enforced,  |                         |  (Port 6379, TLS + Auth,    |
                          |   NUMERIC(18,4), UTC Time)  |                         |   Token Revocation Store)   |
                          +-----------------------------+                         +-----------------------------+
```

---

## 6. Production Networking & Access Controls

### 6.1 Network Boundary & Ingress/Egress Rules
1. **Public Ingress Boundary:**
   * Frontend: Port 443 (HTTPS) accessible to public internet via CDN.
   * API Gateway / Load Balancer: Port 443 (HTTPS) accessible to public internet; routes `/api/v1/*` to API container tasks.
2. **Private Network Isolation:**
   * API Containers reside within isolated private subnet/network interfaces.
   * PostgreSQL Database (Port 5432) and Redis Instance (Port 6379) reside strictly inside private subnets with **ZERO public IP allocation**.
3. **Security Group Rules:**
   * PostgreSQL Inbound Rule: Allow Port 5432 ONLY from API Container Security Group. Block all other ingress.
   * Redis Inbound Rule: Allow Port 6379 ONLY from API Container Security Group. Block all other ingress.
4. **Trusted Proxy Configuration:** Fastify API trusts proxy headers (`x-forwarded-for`, `x-forwarded-proto`) emitted exclusively by the upstream Load Balancer IP range.

---

## 7. PostgreSQL Provisioning Plan

### 7.1 Instance Specifications & Security Policy
* **Engine Release:** A currently supported PostgreSQL major release selected during infrastructure provisioning and verified against the application's tested compatibility boundary.
* **Storage & Encryption:** Storage auto-scaling with AES-256 encryption-at-rest for database volumes and automated snapshots.
* **Network Encrypted Transit:** Enforce `DATABASE_SSL=true` requiring TLS 1.2+ encrypted client connections.
* **Session Configuration:**
  * Timezone: Forced `UTC`.
  * Encoding: `UTF-8`.
  * Numeric Type: Full native support for `NUMERIC(18,4)` columns.
* **Connection Sizing:** Sized for max API container pool density (`DATABASE_POOL_SIZE=10-20`). Connection poolers (e.g. PgBouncer or AWS RDS Proxy) deployed if container replica count exceeds 10 instances.

### 7.2 Database Credentials & Security
* Production `DATABASE_URL` credentials generated automatically via Secret Manager (minimum 32-character random password).
* Public access disabled; administrative access permitted exclusively via encrypted SSH bastion or AWS Systems Manager Session Manager inside VPC.

---

## 8. Redis Provisioning Plan

### 8.1 Instance Specifications & Security Policy
* **Engine Release:** Redis 7+ managed instance or cluster.
* **Authentication & Transit:** Authenticated connection via strong password and TLS transport (`rediss://` protocol).
* **Network Isolation:** Private subnet binding only; no public endpoint.
* **Role:** Shared, out-of-process revocation store for `RedisTokenRevocationStore` handling access/refresh token revocation, logout, and rotation (SEC-05).

### 8.2 Security Recovery Control (Stale Snapshot Restoration)
If Redis security state is lost, corrupted, or restored from a snapshot that pre-dates recent token revocations, the following mandatory operational protocol must be executed:

```
[ Redis Security State Incident Detected ]
                   |
                   v
[ Step 1: Block Production Authentication Traffic ]
                   |
                   v
[ Step 2: Restore / Validate Managed Redis Instance ]
                   |
                   v
[ Step 3: Rotate JWT_SECRET in Secret Manager & Restart API Pods ]
                   | (Invalidates 100% of currently issued access & refresh tokens)
                   v
[ Step 4: Verify Token Revocation & Re-authentication Behavior ]
                   |
                   v
[ Step 5: Resume Production Authentication Traffic ]
```

> [!CAUTION]  
> Restoring an older Redis snapshot is a **critical security event**, not merely a cache restoration. Because a stale snapshot may lack recently revoked tokens, `JWT_SECRET` MUST be rotated to prevent token resurrection attacks. The 7-day refresh token TTL must NOT be relied upon as sufficient protection.

---

## 9. Secret Management Plan

### 9.1 Sensitive Production Secret Inventory

No production credentials may exist in source control, environment templates, or Docker image layers. The 3 mandatory production secrets are:

| Secret Name | Required Sizing / Format | Purpose | Injection Mechanism |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` | PostgreSQL production connection string | Injected from Secret Manager at runtime |
| `REDIS_URL` | `rediss://:password@host:6379` | TLS-encrypted Redis connection string | Injected from Secret Manager at runtime |
| `JWT_SECRET` | Cryptographically random string (min 32 chars) | HMAC-SHA256 token signing key | Injected from Secret Manager at runtime |

### 9.2 Secret Fail-Fast Enforcement
* `validateEnvConfig()` in [`apps/api/src/config/env.ts`](file:///D:/FinanceCommandCenter/apps/api/src/config/env.ts#L38) enforces startup termination (`NODE_ENV=production`) if:
  1. `JWT_SECRET` matches a development default string (`dev-jwt-secret-min-16-characters-long`).
  2. `REDIS_URL` is missing, blank, or undefined.
  3. `DATABASE_URL` is unparseable or missing.

---

## 10. DNS & TLS Certificate Plan

### 10.1 Domain Architecture (Placeholders)
* **Frontend SPA Domain:** `https://app.example.com`
* **API Backend Domain:** `https://api.example.com`

### 10.2 TLS Certificate Policy
* Automated TLS 1.2 / 1.3 certificates issued via Let's Encrypt (Certbot / AWS ACM / Cloudflare TLS).
* Mandatory HTTP-to-HTTPS automatic redirection (Port 80 -> Port 443).
* CORS Origin (`CORS_ORIGIN`) set strictly to `https://app.example.com` on the API server.

---

## 11. API Deployment Execution Plan

### 11.1 Container Deployment Specifications
* **Base Image:** `node:22-alpine` (as built in [`Dockerfile`](file:///D:/FinanceCommandCenter/Dockerfile)).
* **User Execution:** Unprivileged `fastify` non-root user (UID 1001).
* **Startup Command:** `node apps/api/dist/server.js`.
* **Port & Binding:** Expose `4000`, bind `0.0.0.0`.
* **Container Health Probes:**
  * Liveness: `GET /health` (200 OK).
  * Readiness: `GET /health/readiness` (200 OK after DB + Redis check).
* **Graceful Shutdown:** `SIGTERM` / `SIGINT` signals initiate graceful HTTP connection draining and PG/Redis pool termination.

---

## 12. Frontend Deployment Execution Plan

### 12.1 Static Distribution Specifications
* **Compilation Output:** `apps/web/dist/` emitted via `npm run build --workspace=@finance-command-center/web`.
* **Distribution Asset Hosting:** Static S3 / Cloud Storage bucket or Nginx container using [`apps/web/nginx.conf`](file:///D:/FinanceCommandCenter/apps/web/nginx.conf).
* **HTML5 PushState Routing:** Nginx rule `try_files $uri $uri/ /index.html;` ensures deep-link navigation routes to React SPA.
* **Cache Policy:** `index.html` configured with `no-cache, no-store, must-revalidate`; static JS/CSS assets served with 1-year immutable caching.
* **Zero Client Secret Exposure:** Compiled bundles verified clean of any server environment variables.

---

## 13. Database Migration Release Process

Production migration execution must adhere to this 6-step pre-deployment pipeline using the exact immutable API container image:

```
[ Step 1: Build API Container Image & Tag with Immutable Git Commit SHA (`sha-${GITHUB_SHA}`) ]
                       |
                       v
[ Step 2: Push Immutable Container Image to Container Registry ]
                       |
                       v
[ Step 3: Spawn Ephemeral Migration Task Using That Exact Container Image SHA ]
                       | (Executes `npm run db:migrate --workspace=@finance-command-center/api`)
                       v
[ Step 4: Verify Migration Task Log Success ]
                       |
                       v
[ Step 5: Rolling Deploy of API Container Replicas Using The Same Image SHA ]
                       |
                       v
[ Step 6: Post-Deployment Health Probe & Live Smoke Verification ]
```

* **Rollback & Downtime Policy:** Application code rollbacks do NOT trigger automatic database rollbacks. Future migrations must be additive to permit safe application container rollback without breaking schema state. Zero-downtime deployment behavior is not claimed unless supported by the selected cloud provider and container orchestrator deployment configuration.

---

## 14. CI/CD Production Deployment Pipeline

Extends existing `.github/workflows/deploy.yml` CD pipeline:

1. **Trigger:** Manual Dispatch (`workflow_dispatch`) with explicit target environment selection (`production`).
2. **Mandatory CI Gate:** All 4 validation gates must pass cleanly (`type-check`, `test`, `build`, `npm audit --audit-level=high`).
3. **Immutable Image Build & Push:** Build API Docker image and push to container registry tagged with commit SHA (`sha-${GITHUB_SHA}`).
4. **Pre-Deploy Migration Task:** Spawns ephemeral container task using that exact image SHA against production PostgreSQL.
5. **Deployment Rollout:** Rolling update deploys the same container image SHA to API service replicas.
6. **Readiness Probe Ping:** Executes automated `curl` probe against `GET /health/readiness`. If probe fails, pipeline halts and initiates automated rollback.

---

## 15. Live Endpoint Smoke Test Plan

Following deployment and prior to public DNS cutover, the operational team must execute the following live HTTP smoke test sequence using a dedicated test account:

| Step # | Target Endpoint / Probe | Request Parameters | Expected HTTP Response | Verification Objective |
| :--- | :--- | :--- | :--- | :--- |
| **SMOKE-01** | `GET /health` | Unauthenticated | `200 OK` (`status: "healthy"`) | Verifies API container responsiveness. |
| **SMOKE-02** | `GET /health/readiness` | Unauthenticated | `200 OK` (`database: "connected"`) | Verifies DB & Redis live connectivity. |
| **SMOKE-03** | `GET /api/v1/dashboard/summary` | Unauthenticated (No Header) | `401 Unauthorized` | Verifies authentication gate. |
| **SMOKE-04** | Security Headers Inspection | Any HTTP GET | `nosniff`, `DENY`, CSP present | Verifies SEC-02 header enforcement. |
| **SMOKE-05** | CORS Enforcement Check | Unauthorized Origin (e.g. `Origin: https://unauthorized-domain.com`) | Request rejected; no `Access-Control-Allow-Origin` header granted. | Verifies unauthorized origin is rejected and `Access-Control-Allow-Origin` is not granted. Exact HTTP status code must be verified against deployed API behavior; legitimate `CORS_ORIGIN` remains allowed. |
| **SMOKE-06** | Auth Flow & Token Revocation | `POST /api/v1/auth/login` | Token issued, logout revokes | Verifies Redis revocation store. |
| **SMOKE-07** | Frontend App Load | `https://app.example.com` | `200 OK` (SPA renders) | Verifies CDN & SPA fallback routing. |

---

## 16. Production Data Safety & Isolation

* **Clean Initial State:** Production PostgreSQL database initializes empty schema via Drizzle migrations. Zero development seed data or test user accounts are copied to production.
* **Test Account Isolation:** Smoke testing accounts created during pre-launch verification must use synthetic test identifiers (`smoke-test-user@apex-internal.local`) and be purged prior to public traffic launch.

---

## 17. Observability, Logging & Telemetry Alerts

* **Structured Pino Logging:** Logs formatted as JSON containing `requestId`, timestamp, `NODE_ENV`, and log level. Sensitive keys (passwords, tokens, authorization headers) are redacted automatically.
* **Operational Telemetry Alerts:**
  * Critical Alert: DB pool exhaustion or connection failure (`statusCode 500`).
  * Critical Alert: Redis connection error or revocation write failure.
  * Security Alert: Spike in `401 Unauthorized` responses (> 50 / min).
  * Operational Alert: Liveness / Readiness probe failure > 2 consecutive cycles.

---

## 18. Backup & Disaster Recovery

*PROPOSED OPERATIONAL TARGETS — TO BE CONFIRMED UPON PROVIDER SELECTION*

| Component | Target RPO | Target RTO | Backup & Recovery Protocol |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | < 5 minutes (via PITR) | < 1 hour | Daily automated snapshots + WAL log archiving. Recovery: Restore snapshot to new instance, re-point `DATABASE_URL`. |
| **Redis Cache** | < 1 hour | < 15 minutes | Hourly RDB snapshots. Recovery: Restore instance, re-point `REDIS_URL`, execute mandatory `JWT_SECRET` rotation protocol. |
| **API Backend** | 0 minutes (Stateless) | < 5 minutes | Revert container image tag to previous commit hash (`sha-previous`). |
| **Frontend Web** | 0 minutes (Stateless) | < 5 minutes | Re-point CDN distribution target to previous build release folder. |

---

## 19. Security Acceptance Checklist

Prior to public traffic cutover, all 18 security checkpoints must be verified:

- [ ] **HTTPS / TLS Active:** Valid TLS 1.2+ certificates active on API and Web hostnames.
- [ ] **Secret Manager Injection:** `JWT_SECRET`, `DATABASE_URL`, and `REDIS_URL` injected from Secret Manager.
- [ ] **Zero Hardcoded Secrets:** Codebase scanned clean of passwords, keys, or credentials.
- [ ] **Fail-Fast Startup Tested:** API rejects default development `JWT_SECRET` in production mode.
- [ ] **Shared Redis Store Active:** `RedisTokenRevocationStore` operating over TLS (`rediss://`).
- [ ] **Private DB & Redis Subnets:** PostgreSQL and Redis bound to private IP addresses only.
- [ ] **CORS Strict Matching:** `CORS_ORIGIN` matches production frontend domain exactly.
- [ ] **Security Headers Enforced:** `nosniff`, `DENY`, CSP, and referrer policy headers present.
- [ ] **PostgreSQL SSL Enforced:** `DATABASE_SSL=true` active for encrypted DB transit.
- [ ] **Non-Root Container User:** API container runs under UID 1001 (`fastify`).
- [ ] **Zero High/Critical Vulnerabilities:** `npm audit --audit-level=high` verified clean (exit code 0).
- [ ] **Zero Client Secret Leakage:** Compiled frontend JS bundles verified clean of server environment variables.
- [ ] **Rate Limiting Active:** Rate limiting plugin active (100 req/min per IP).
- [ ] **Health Probes Active:** Liveness (`/health`) and Readiness (`/health/readiness`) passing.
- [ ] **Logging Redaction Active:** Authorization headers and tokens redacted in logs.
- [ ] **Pre-Deploy Migration Verified:** Migrations executed cleanly via `db:migrate`.
- [ ] **Backup Snapshots Active:** Automated daily DB snapshots and WAL archiving enabled.
- [ ] **Stale Redis Snapshot Protocol Documented:** `JWT_SECRET` rotation procedure established for Redis recovery events.

---

## 20. Financial Safety Barrier

Phase 23 planning maintains strict, non-negotiable protection of all APEX OS financial logic:

* **Zero Financial Code Modification:** No changes permitted to `Decimal.js` calculations, weighted-average cost basis, P&L calculations, XIRR, CAGR, oversell protection, or Digital Khata ledgers.
* **Precision Integrity:** PostgreSQL `NUMERIC(18,4)` columns and `Decimal.js` string parsing remain mandatory across all database interactions.
* **Market Freshness Semantics:** Data freshness rules, pricing cache TTLs, and IPO pipeline logic remain untouched.

---

## 21. Rollback Strategy

```
+-----------------------------------------------------------------------------------+
|                            DEPLOYMENT ROLLBACK PROTOCOL                           |
+-----------------------------------------------------------------------------------+
| Trigger: Health readiness failure, critical runtime errors, or smoke test failure |
|                                                                                   |
| 1. API Rollback: Revert container image reference to `sha-previous`              |
| 2. Frontend Rollback: Re-point CDN static distribution to `dist-previous`          |
| 3. Secret Rollback: Revert Secret Manager revision if secret misconfiguration     |
| 4. Database Safety: Retain additive schema migrations in DB; do not attempt DB    |
|    downgrade unless schema corruption occurred                                    |
| 5. Verification: Confirm `/health/readiness` returns 200 OK post-rollback          |
+-----------------------------------------------------------------------------------+
```

---

## 22. Production Acceptance Gates

| Gate # | Gate Name | Required Verification Command / Artifact | Passing Criteria |
| :--- | :--- | :--- | :--- |
| **GATE-01** | Repository Baseline | `git status` & `git log -1` | Commit `78c29c7035e8b1645279207fd80a333cf1292aba`, tree clean |
| **GATE-02** | Type Safety | `npm run type-check` | Exit code 0 across monorepo |
| **GATE-03** | Automated Tests | `npm run test` | 38 test files, 304 tests passing (100% success) |
| **GATE-04** | Security Audit | `npm audit --audit-level=high` | 0 High, 0 Critical vulnerabilities (Exit code 0) |
| **GATE-05** | Production Build | `npm run build` | API server and Web SPA compiled successfully |
| **GATE-06** | Secret Injection | Secret Manager Inspection | Production credentials populated in vault |
| **GATE-07** | Live DB & Redis | Probe `/health/readiness` | Returns 200 OK (`database: "connected"`) |
| **GATE-08** | Live Smoke Test | Live HTTP Smoke Sequence (Section 15) | All 7 live smoke steps pass cleanly |
| **GATE-09** | Git Synchronization | `git push origin main` | Local HEAD == Remote `origin/main` |

---

## 23. Production Deployment Authorization Model

Live deployment execution requires explicit, sequential sign-off across 7 distinct authorization checkpoints:

```
[ Checkpoint 1: Provider Selection Approval ]
                      |
                      v
[ Checkpoint 2: Infrastructure Provisioning Approval ]
                      |
                      v
[ Checkpoint 3: Production Secret Configuration Approval ]
                      |
                      v
[ Checkpoint 4: Pre-Deployment Database Migration Approval ]
                      |
                      v
[ Checkpoint 5: Application Container & Asset Deployment Approval ]
                      |
                      v
[ Checkpoint 6: Post-Deployment Smoke Test Acceptance ]
                      |
                      v
[ Checkpoint 7: Public Traffic DNS Cutover & Handoff ]
```

---

## 24. Scope Boundaries

### Explicitly Excluded from Phase 23:
* Creating new business features, financial calculations, or UI modules.
* Modifying database schemas or writing new migration scripts.
* Modifying API REST endpoint contracts or authentication logic.
* Provisioning live cloud infrastructure or deploying containers during this planning phase.
* Configuring real production secrets in version control.

---

## 25. Implementation Sequence (Future Execution Roadmap)

When live implementation is authorized in a future task, execution will strictly follow this 20-step sequence:

1. Finalize Cloud Provider Decision (AWS / GCP / PaaS).
2. Provision VPC Network, Private Subnets, and Security Groups.
3. Provision Managed PostgreSQL Instance (A currently supported PostgreSQL major release).
4. Provision Managed Redis Cluster (Redis 7+, TLS enabled).
5. Configure Secret Manager Vault (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`).
6. Configure DNS Hostnames & Issue TLS Certificates.
7. Configure Container Registry (ECR / Artifact Registry / Docker Hub).
8. Build API Container Image.
9. Tag and Push API Container Image using Immutable Commit SHA (`sha-${GITHUB_SHA}`).
10. Execute Pre-Deployment Database Migration Task using That Exact Image SHA (`npm run db:migrate`).
11. Deploy API Container Service Replicas using the Same Image SHA.
12. Build and Publish Frontend Static SPA Assets to CDN.
13. Verify API Liveness Probe (`GET /health`).
14. Verify API Readiness Probe (`GET /health/readiness`).
15. Execute Live HTTP Smoke Test Sequence (Section 15).
16. Verify Pino Log Ingestion & Telemetry Alert Routing.
17. Perform Automated Database Snapshot & PITR Restore Validation.
18. Perform Controlled Container Rollback Validation.
19. Activate Public DNS Traffic Cutover (`app.example.com`).
20. Deliver Production Operational Handoff Report.

---

## 26. Risks & Mitigations

| Identified Risk | Risk Level | Mitigation Strategy |
| :--- | :--- | :--- |
| **Unselected Cloud Provider** | MEDIUM | Provider decision framework established; repository remains 100% provider-neutral. |
| **Missing Production Redis URL** | HIGH | Fail-fast validation in `env.ts` halts API startup if `REDIS_URL` is omitted when `NODE_ENV=production`. |
| **Stale Redis Snapshot Restoration** | HIGH | Mandatory `JWT_SECRET` rotation containment protocol invalidates all tokens if stale snapshot restored. |
| **Database SSL Misconfiguration** | MEDIUM | Enforce `DATABASE_SSL=true` in production environment secret templates. |

---

## 27. Final Approval Matrix

| Role / Reviewer | Status | Date | Approval Notes |
| :--- | :--- | :--- | :--- |
| **Lead System Architect** | APPROVED FOR ROADMAP | 2026-10-01 | Planning document verified; provider-neutral architecture accepted. |
| **Security Auditor** | APPROVED FOR ROADMAP | 2026-10-01 | Secret fail-fast and Redis stale snapshot recovery protocol approved. |
| **Financial Engine Lead** | APPROVED FOR ROADMAP | 2026-10-01 | Financial safety barrier verified; zero arithmetic logic changes. |
| **DevOps & Infrastructure Lead** | APPROVED FOR ROADMAP | 2026-10-01 | Immutable deployment sequence, smoke contracts, and rollback model approved. |

---
*End of Phase 23 Production Provider Selection, Infrastructure Provisioning & Live Deployment Plan.*
