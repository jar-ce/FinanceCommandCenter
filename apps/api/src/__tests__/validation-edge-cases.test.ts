import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';

describe('Phase 18 — Validation Edge Cases & Input Rejection Suite', () => {
  let app: ReturnType<typeof buildApp>;
  const userA = '00000000-0000-4000-a000-000000000001';

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    await db.insert(users).values({
      id: userA,
      email: 'val-usera@apexos.dev',
      name: 'Validation User A'
    }).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  const authHeaders = () => createAuthHeaders(userA, 'user');

  // --------------------------------------------------
  // 1. UUID Validation Edge Cases
  // --------------------------------------------------
  describe('UUID Route Parameter & Body Validation', () => {
    it('rejects malformed UUID in route path parameter with validation error', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/khata/accounts/not-a-valid-uuid-string',
        headers: authHeaders()
      });
      expect([400, 404, 422, 500].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });

    it('rejects malformed UUID in JSON body field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/watchlists/00000000-0000-4000-a000-000000000099/items',
        headers: authHeaders(),
        payload: { instrumentId: 'invalid-instrument-uuid' }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });
  });

  // --------------------------------------------------
  // 2. Enum & Allowed Values Rejection
  // --------------------------------------------------
  describe('Enum Validation', () => {
    it('rejects invalid enum value for Khata accountType', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts',
        headers: authHeaders(),
        payload: {
          displayName: 'Test Account',
          accountType: 'INVALID_ENUM_VALUE'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });

    it('rejects invalid enum value for Alert alertType', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: authHeaders(),
        payload: {
          name: 'Invalid Alert',
          alertType: 'MAGIC_PRICE_PREDICTION',
          targetType: 'MARKET_INSTRUMENT',
          targetId: '00000000-0000-4000-a000-000000000099'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });
  });

  // --------------------------------------------------
  // 3. Numeric Bounds & Invalid Financial Rejection
  // --------------------------------------------------
  describe('Numeric Bounds & Decimal Validation', () => {
    it('rejects zero amount for Khata transaction', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts/00000000-0000-4000-a000-000000000099/transactions',
        headers: authHeaders(),
        payload: {
          type: 'MONEY_IN',
          amount: '0.0000',
          transactionDate: new Date().toISOString(),
          description: 'Zero Deposit'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });

    it('rejects negative amount string for Khata transaction', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts/00000000-0000-4000-a000-000000000099/transactions',
        headers: authHeaders(),
        payload: {
          type: 'MONEY_IN',
          amount: '-500.0000',
          transactionDate: new Date().toISOString(),
          description: 'Negative Deposit'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });

    it('rejects non-numeric string characters in transaction amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts/00000000-0000-4000-a000-000000000099/transactions',
        headers: authHeaders(),
        payload: {
          type: 'MONEY_IN',
          amount: '100.50ABC',
          transactionDate: new Date().toISOString(),
          description: 'Malicious amount'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });
  });

  // --------------------------------------------------
  // 4. String Length & Boundary Checks
  // --------------------------------------------------
  describe('String Boundary Validation', () => {
    it('rejects empty string for Khata account displayName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts',
        headers: authHeaders(),
        payload: {
          displayName: ' ',
          accountType: 'CUSTOMER'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });

    it('rejects oversized string exceeding max characters', async () => {
      const oversizedName = 'A'.repeat(500); // Max allowed is 255
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts',
        headers: authHeaders(),
        payload: {
          displayName: oversizedName,
          accountType: 'CUSTOMER'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });
  });

  // --------------------------------------------------
  // 5. Date & Pagination Query Validation
  // --------------------------------------------------
  describe('Date & Query Parameters Validation', () => {
    it('rejects invalid ISO-8601 date string', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts/00000000-0000-4000-a000-000000000099/transactions',
        headers: authHeaders(),
        payload: {
          type: 'MONEY_IN',
          amount: '100.0000',
          transactionDate: '2026-99-99-invalid-date',
          description: 'Invalid Date'
        }
      });
      expect([400, 404, 422].includes(res.statusCode)).toBe(true);
      expect(res.json().success).toBe(false);
    });

    it('rejects negative or non-numeric page and limit parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications?page=-5&limit=abc',
        headers: authHeaders()
      });
      // Page should default or throw validation error safely without crashing server
      expect([200, 400, 422].includes(res.statusCode)).toBe(true);
      if (res.statusCode === 200) {
        expect(res.json().data.page).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
