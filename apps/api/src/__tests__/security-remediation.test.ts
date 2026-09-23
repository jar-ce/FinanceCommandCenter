import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';
import { validateEnvConfig } from '../config/env.js';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';

describe('Phase 17 — Security Review & Remediation Suite', () => {
  let app: ReturnType<typeof buildApp>;
  const userA = '00000000-0000-4000-a000-000000000001';
  const userB = '00000000-0000-4000-a000-000000000002';

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();
    await db.insert(users).values([
      { id: userA, email: 'sec-usera@apexos.dev', name: 'SEC User A' },
      { id: userB, email: 'sec-userb@apexos.dev', name: 'SEC User B' }
    ]).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  // --------------------------------------------------
  // SEC-01: Authenticated Principal Boundary Tests
  // --------------------------------------------------
  describe('SEC-01: Authenticated Principal Boundary', () => {
    it('rejects unauthenticated request missing credentials with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/khata/accounts'
      });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects forged/un-signed identity header with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/khata/accounts',
        headers: {
          'x-user-id': userA, // Raw un-signed header
          'x-test-strict-auth': 'true'
        }
      });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('accepts valid signed principal token in Authorization Bearer header', async () => {
      const authHeaders = createAuthHeaders(userA, 'user');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/khata/accounts',
        headers: authHeaders
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });
  });

  // --------------------------------------------------
  // SEC-02: HTTP Response Security Headers Tests
  // --------------------------------------------------
  describe('SEC-02: Security Headers', () => {
    it('returns required security headers on API responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health'
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBe("default-src 'self'");
    });
  });

  // --------------------------------------------------
  // SEC-03: Production Secret Enforcement Tests
  // --------------------------------------------------
  describe('SEC-03: Production Secret Enforcement', () => {
    it('throws fatal error when default dev secret is used in NODE_ENV=production', () => {
      expect(() => {
        validateEnvConfig({
          NODE_ENV: 'production',
          JWT_SECRET: 'dev-jwt-secret-min-16-characters-long'
        });
      }).toThrow('FATAL: Default development JWT_SECRET is rejected in production');
    });

    it('accepts explicit secure secret in NODE_ENV=production', () => {
      const validConfig = validateEnvConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'super-secure-production-secret-key-998877665544332211'
      });
      expect(validConfig.NODE_ENV).toBe('production');
    });
  });

  // --------------------------------------------------
  // SEC-04: Admin RBAC on Security Master Creation
  // --------------------------------------------------
  describe('SEC-04: Admin RBAC on Security Master Creation', () => {
    it('returns 401 on unauthenticated request to register instrument', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/market/instruments',
        payload: { symbol: 'SEC04TEST', displayName: 'SEC04 Test Stock' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 Forbidden when regular user attempts to register instrument', async () => {
      const authHeaders = createAuthHeaders(userA, 'user');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/market/instruments',
        headers: authHeaders,
        payload: { symbol: 'SEC04TEST', displayName: 'SEC04 Test Stock' }
      });
      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('allows admin principal to register new market instrument', async () => {
      const adminHeaders = createAuthHeaders(userA, 'admin');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/market/instruments',
        headers: adminHeaders,
        payload: {
          symbol: `TEST-${Date.now()}`,
          displayName: 'Admin Test Security',
          exchange: 'NSE',
          securityType: 'EQUITY'
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });
  });

  // --------------------------------------------------
  // SEC-06: CORS Policy Hardening Tests
  // --------------------------------------------------
  describe('SEC-06: CORS Policy Hardening', () => {
    it('allows allowed origin in development', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'http://localhost:3000' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('rejects unauthorized origin when CORS check fails', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { origin: 'http://malicious-site.com' }
      });
      expect(res.statusCode).toBe(500); // Fastify CORS plugin rejection
    });
  });

  // --------------------------------------------------
  // SEC-07: Admin/System RBAC on IPO Master Sync
  // --------------------------------------------------
  describe('SEC-07: Admin RBAC on IPO Master Sync', () => {
    it('returns 401 on unauthenticated request to trigger IPO sync', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ipo/sync'
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 Forbidden when regular user attempts to trigger IPO sync', async () => {
      const authHeaders = createAuthHeaders(userA, 'user');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ipo/sync',
        headers: authHeaders
      });
      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('allows admin or system principal to trigger IPO sync', async () => {
      const adminHeaders = createAuthHeaders(userA, 'admin');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ipo/sync',
        headers: adminHeaders
      });
      // Synchronizes with mock provider in development environment
      expect([200, 502]).includes(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.json().success).toBe(true);
      }
    });
  });
});
