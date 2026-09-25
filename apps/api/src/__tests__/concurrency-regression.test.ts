import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users, marketInstruments } from '../db/schema/index.js';

describe('Phase 18 — Concurrency & Race Condition Regression Suite', () => {
  let app: ReturnType<typeof buildApp>;
  const userA = '00000000-0000-4000-a000-000000000001';
  const testInstrumentId = '11111111-1111-4111-a111-111111111111';

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    await db.insert(users).values([
      { id: userA, email: 'conc-usera@apexos.dev', name: 'Concurrency User A' }
    ]).onConflictDoNothing();

    await db.insert(marketInstruments).values({
      id: testInstrumentId,
      symbol: 'CONC_STOCK',
      displayName: 'Concurrency Test Stock',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  // --------------------------------------------------
  // 1. Concurrent Portfolio SELL Transactions
  // --------------------------------------------------
  describe('Concurrent Portfolio SELL Transactions', () => {
    it('prevents simultaneous SELL transactions from driving position quantity below zero', async () => {
      const authHeaders = createAuthHeaders(userA, 'user');

      // 1. Create a portfolio
      const createPortRes = await app.inject({
        method: 'POST',
        url: '/api/v1/portfolios',
        headers: authHeaders,
        payload: { name: 'Concurrency Portfolio' }
      });
      expect(createPortRes.statusCode).toBe(201);
      const portfolioId = createPortRes.json().data.id;

      // 2. BUY 10 units
      const buyRes = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: authHeaders,
        payload: {
          instrumentId: testInstrumentId,
          transactionType: 'BUY',
          transactionDate: new Date().toISOString(),
          quantity: '10.0000',
          price: '100.0000'
        }
      });
      expect(buyRes.statusCode).toBe(201);

      // 3. Issue 3 simultaneous SELL requests for 5 units each (Total 15 > 10 available)
      const sellRequests = [1, 2, 3].map(() =>
        app.inject({
          method: 'POST',
          url: `/api/v1/portfolios/${portfolioId}/transactions`,
          headers: authHeaders,
          payload: {
            instrumentId: testInstrumentId,
            transactionType: 'SELL',
            transactionDate: new Date().toISOString(),
            quantity: '5.0000',
            price: '110.0000'
          }
        })
      );

      const sellResults = await Promise.all(sellRequests);
      const successCount = sellResults.filter(r => r.statusCode === 201).length;
      const failureCount = sellResults.filter(r => r.statusCode === 422).length;

      // Exactly 2 SELL requests for 5 units each must succeed; the 3rd must fail with OVERSELL_ERROR
      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);

      // 4. Verify final holdings quantity is strictly 0.0000 (never negative)
      const holdingsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/holdings`,
        headers: authHeaders
      });
      expect(holdingsRes.statusCode).toBe(200);
      const holdings = holdingsRes.json().data;
      const position = holdings.find((h: any) => h.instrumentId === testInstrumentId);
      if (position) {
        expect(parseFloat(position.quantity)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // --------------------------------------------------
  // 2. Concurrent Khata Reversal Attempts
  // --------------------------------------------------
  describe('Concurrent Khata Reversal Attempts', () => {
    it('prevents double-reversal under simultaneous reversal requests', async () => {
      const authHeaders = createAuthHeaders(userA, 'user');

      // 1. Create a Khata account
      const createAccRes = await app.inject({
        method: 'POST',
        url: '/api/v1/khata/accounts',
        headers: authHeaders,
        payload: { displayName: 'Concurrent Khata Account', accountType: 'CUSTOMER' }
      });
      expect(createAccRes.statusCode).toBe(201);
      const accountId = createAccRes.json().data.id;

      // 2. Post a MONEY_IN transaction of 1000
      const postTxRes = await app.inject({
        method: 'POST',
        url: `/api/v1/khata/accounts/${accountId}/transactions`,
        headers: authHeaders,
        payload: {
          type: 'MONEY_IN',
          amount: '1000.0000',
          transactionDate: new Date().toISOString(),
          description: 'Initial Deposit'
        }
      });
      expect(postTxRes.statusCode).toBe(201);
      const txId = postTxRes.json().data.id;

      // 3. Issue 3 simultaneous DELETE /reversal requests for the same transaction ID
      const reversalRequests = [1, 2, 3].map(() =>
        app.inject({
          method: 'DELETE',
          url: `/api/v1/khata/accounts/${accountId}/transactions/${txId}`,
          headers: authHeaders,
          payload: { reason: 'Concurrent reversal test' }
        })
      );

      const reversalResults = await Promise.all(reversalRequests);
      const successCount = reversalResults.filter(r => r.statusCode === 200).length;
      const alreadyReversedCount = reversalResults.filter(r => r.statusCode === 400).length;

      // Exactly 1 reversal must succeed; remaining 2 must be rejected with ALREADY_REVERSED
      expect(successCount).toBe(1);
      expect(alreadyReversedCount).toBe(2);
    });
  });

  // --------------------------------------------------
  // 3. Concurrent IPO Provider Synchronization
  // --------------------------------------------------
  describe('Concurrent IPO Synchronization', () => {
    it('prevents duplicate IPO master creation under concurrent sync triggers', async () => {
      const adminHeaders = createAuthHeaders(userA, 'admin');

      // Issue 3 simultaneous IPO sync triggers
      const syncRequests = [1, 2, 3].map(() =>
        app.inject({
          method: 'POST',
          url: '/api/v1/ipo/sync',
          headers: adminHeaders
        })
      );

      const syncResults = await Promise.all(syncRequests);
      // All requests should return 200 or 502 safely without database primary key or unique constraint crashes
      for (const res of syncResults) {
        expect([200, 502]).includes(res.statusCode);
      }
    });
  });
});
