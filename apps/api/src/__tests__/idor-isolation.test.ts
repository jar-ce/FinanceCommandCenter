import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import {
  users,
  khataAccounts,
  khataTransactions,
  portfolios,
  watchlists,
  alertRules,
  alertEvents,
  notifications,
  marketInstruments
} from '../db/schema/index.js';

describe('Phase 18 — Systematic IDOR & Cross-User Isolation Suite', () => {
  let app: ReturnType<typeof buildApp>;

  const userA = '00000000-0000-4000-a000-000000000001';
  const userB = '00000000-0000-4000-a000-000000000002';
  const adminUser = '00000000-0000-4000-a000-000000000099';

  // Specific User B Resource IDs
  const userBKhataAccId = '22222222-2222-4222-a222-222222222221';
  const userBKhataTxId = '22222222-2222-4222-a222-222222222222';
  const userBPortfolioId = '22222222-2222-4222-a222-222222222223';
  const userBWatchlistId = '22222222-2222-4222-a222-222222222224';
  const userBAlertId = '22222222-2222-4222-a222-222222222225';
  const userBNotificationId = '22222222-2222-4222-a222-222222222226';
  const testInstrumentId = '11111111-1111-4111-a111-111111111111';

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed Users
    await db.insert(users).values([
      { id: userA, email: 'idor-usera@apexos.dev', name: 'IDOR User A' },
      { id: userB, email: 'idor-userb@apexos.dev', name: 'IDOR User B' },
      { id: adminUser, email: 'idor-admin@apexos.dev', name: 'IDOR Admin' }
    ]).onConflictDoNothing();

    // 2. Seed Instrument
    await db.insert(marketInstruments).values({
      id: testInstrumentId,
      symbol: 'IDOR_STOCK',
      displayName: 'IDOR Test Stock',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    // 3. Seed User B Resources
    await db.insert(khataAccounts).values({
      id: userBKhataAccId,
      userId: userB,
      displayName: 'User B Private Khata',
      accountType: 'CUSTOMER',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    await db.insert(khataTransactions).values({
      id: userBKhataTxId,
      accountId: userBKhataAccId,
      userId: userB,
      type: 'MONEY_IN',
      amount: '5000.0000',
      runningBalance: '5000.0000',
      transactionDate: new Date(),
      description: 'Private User B Deposit'
    }).onConflictDoNothing();

    await db.insert(portfolios).values({
      id: userBPortfolioId,
      userId: userB,
      name: 'User B Private Portfolio',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    await db.insert(watchlists).values({
      id: userBWatchlistId,
      userId: userB,
      name: 'User B Private Watchlist',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    await db.insert(alertRules).values({
      id: userBAlertId,
      userId: userB,
      name: 'User B Private Alert',
      alertType: 'PRICE_ABOVE',
      targetType: 'MARKET_INSTRUMENT',
      targetId: testInstrumentId,
      conditionOperator: 'GREATER_THAN',
      thresholdValue: '1500.0000',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    const alertEventId = '22222222-2222-4222-a222-222222222299';
    await db.insert(alertEvents).values({
      id: alertEventId,
      alertRuleId: userBAlertId,
      userId: userB,
      triggerValue: '1600.0000',
      thresholdValue: '1500.0000',
      deduplicationKey: 'dedup-userb-alert'
    }).onConflictDoNothing();

    await db.insert(notifications).values({
      id: userBNotificationId,
      userId: userB,
      alertEventId: alertEventId,
      alertRuleId: userBAlertId,
      notificationType: 'PRICE_ALERT',
      title: 'User B Secret Notification',
      message: 'Private message for User B',
      status: 'UNREAD'
    }).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  const authHeadersA = () => createAuthHeaders(userA, 'user');
  const authHeadersB = () => createAuthHeaders(userB, 'user');

  // --------------------------------------------------
  // 1. Digital Khata IDOR Isolation
  // --------------------------------------------------
  describe('Khata Module Cross-User Isolation', () => {
    it('prevents User A from reading User B Khata account by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/khata/accounts/${userBKhataAccId}`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from listing User B Khata ledger transactions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/khata/accounts/${userBKhataAccId}/transactions`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from posting transactions to User B Khata account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/khata/accounts/${userBKhataAccId}/transactions`,
        headers: authHeadersA(),
        payload: {
          type: 'MONEY_OUT',
          amount: '100.0000',
          transactionDate: new Date().toISOString(),
          description: 'Malicious Outflow'
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from reversing User B Khata transaction', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/khata/accounts/${userBKhataAccId}/transactions/${userBKhataTxId}`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from archiving User B Khata account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/khata/accounts/${userBKhataAccId}/archive`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('allows User B to access their own Khata account details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/khata/accounts/${userBKhataAccId}`,
        headers: authHeadersB()
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.userId).toBe(userB);
    });
  });

  // --------------------------------------------------
  // 2. Portfolio & Holdings IDOR Isolation
  // --------------------------------------------------
  describe('Portfolio Module Cross-User Isolation', () => {
    it('prevents User A from viewing User B portfolio overview', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${userBPortfolioId}`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from viewing User B holdings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${userBPortfolioId}/holdings`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from viewing User B P&L summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${userBPortfolioId}/pnl`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from posting trade transaction into User B portfolio', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${userBPortfolioId}/transactions`,
        headers: authHeadersA(),
        payload: {
          instrumentId: testInstrumentId,
          transactionType: 'BUY',
          transactionDate: new Date().toISOString(),
          quantity: '5.0000',
          price: '500.0000'
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from archiving User B portfolio', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${userBPortfolioId}/archive`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // --------------------------------------------------
  // 3. Watchlist Module IDOR Isolation
  // --------------------------------------------------
  describe('Watchlist Module Cross-User Isolation', () => {
    it('prevents User A from viewing User B watchlist details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/watchlists/${userBWatchlistId}`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from adding items to User B watchlist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${userBWatchlistId}/items`,
        headers: authHeadersA(),
        payload: { instrumentId: testInstrumentId }
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from archiving User B watchlist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${userBWatchlistId}/archive`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // --------------------------------------------------
  // 4. Alerts & Notifications IDOR Isolation
  // --------------------------------------------------
  describe('Alerts & Notifications Cross-User Isolation', () => {
    it('prevents User A from fetching User B alert rule by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${userBAlertId}`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from pausing/resuming User B alert rule', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${userBAlertId}/pause`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from reading User B notification by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/notifications/${userBNotificationId}`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User A from marking User B notification as read', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/notifications/${userBNotificationId}/read`,
        headers: authHeadersA()
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // --------------------------------------------------
  // 5. Dashboard Telemetry & Reports Isolation
  // --------------------------------------------------
  describe('Dashboard & Reports User Isolation', () => {
    it('ensures User A GET /api/v1/dashboard/summary isolates telemetry strictly to User A', async () => {
      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/summary',
        headers: authHeadersA()
      });
      expect(resA.statusCode).toBe(200);

      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/summary',
        headers: authHeadersB()
      });
      expect(resB.statusCode).toBe(200);

      const countB = resB.json().data.portfolioOverview?.data?.portfolioCount ?? 0;
      const countA = resA.json().data.portfolioOverview?.data?.portfolioCount ?? 0;
      expect(countB).toBe(1);
      expect(countA).toBe(0);
    });

    it('prevents User A from requesting portfolio performance report for User B portfolio ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/portfolio-performance?portfolioId=${userBPortfolioId}`,
        headers: authHeadersA()
      });
      // Should throw or return empty / error because User A does not own User B portfolio
      expect([404, 403, 200]).includes(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.json().data.portfolioCount || 0).toBe(0);
      }
    });
  });
});
