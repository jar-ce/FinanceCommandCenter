import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { marketInstruments } from '../db/schema/market-instruments.js';
import { marketQuotes } from '../db/schema/market-quotes.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { PortfolioService } from '../domain/services/PortfolioService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 12 Portfolio & Holdings Domain, Accounting & Concurrency Suite', () => {
  const portfolioRepo = new DrizzlePortfolioRepository();
  const marketRepo = new DrizzleMarketRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const portfolioService = new PortfolioService(portfolioRepo, marketRepo, auditRepo);

  const userAId = '00000000-0000-4000-a000-000000000010';
  const userBId = '00000000-0000-4000-a000-000000000020';
  let app: FastifyInstance;
  let testInstrument1Id: string;
  let testInstrument2Id: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed test users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-portfolio@apexos.dev', name: 'User A Portfolio' },
      { id: userBId, email: 'user-b-portfolio@apexos.dev', name: 'User B Portfolio' }
    ]).onConflictDoNothing();

    // 2. Seed canonical market instruments
    const [inst1] = await db.insert(marketInstruments).values({
      symbol: 'RELIANCE',
      displayName: 'Reliance Industries Limited',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    const [inst2] = await db.insert(marketInstruments).values({
      symbol: 'INFY',
      displayName: 'Infosys Limited',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    testInstrument1Id = inst1 ? inst1.id : (await marketRepo.getInstrumentBySymbolAndExchange('RELIANCE', 'NSE'))!.id;
    testInstrument2Id = inst2 ? inst2.id : (await marketRepo.getInstrumentBySymbolAndExchange('INFY', 'NSE'))!.id;

    // 3. Seed initial quote observations
    await db.insert(marketQuotes).values([
      {
        instrumentId: testInstrument1Id,
        lastPrice: '2500.0000',
        previousClose: '2480.0000',
        change: '20.0000',
        changePercent: '0.8065',
        currency: 'INR',
        marketStatus: 'OPEN',
        dataFreshness: 'LIVE',
        provider: 'NSE_INDIA'
      },
      {
        instrumentId: testInstrument2Id,
        lastPrice: '1400.0000',
        previousClose: '1420.0000',
        change: '-20.0000',
        changePercent: '-1.4085',
        currency: 'INR',
        marketStatus: 'OPEN',
        dataFreshness: 'LIVE',
        provider: 'NSE_INDIA'
      }
    ]).onConflictDoNothing();

    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDb();
  });

  describe('1. HTTP Identity Boundary & Authentication (Strict x-user-id Requirement)', () => {
    it('Test A: rejects GET /api/v1/portfolios with 401 when x-user-id header is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/portfolios'
      });
      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('UNAUTHORIZED');
    });

    it('Test B: rejects request with 401 when x-user-id header is empty or malformed', async () => {
      const resEmpty = await app.inject({
        method: 'GET',
        url: '/api/v1/portfolios',
        headers: { 'x-user-id': '   ' }
      });
      expect(resEmpty.statusCode).toBe(401);

      const resMalformed = await app.inject({
        method: 'GET',
        url: '/api/v1/portfolios',
        headers: { 'x-user-id': 'invalid-uuid-format' }
      });
      expect(resMalformed.statusCode).toBe(401);
    });

    it('Test C: rejects GET /api/v1/portfolios/:id with 401 without x-user-id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/portfolios/00000000-0000-4000-a000-000000000001'
      });
      expect(response.statusCode).toBe(401);
    });

    it('Test D: rejects POST /api/v1/portfolios with 401 without x-user-id header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/portfolios',
        payload: { name: 'Unauthorized Portfolio' }
      });
      expect(response.statusCode).toBe(401);
    });

    it('Test E: rejects POST /api/v1/portfolios/:id/transactions with 401 without x-user-id header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/portfolios/00000000-0000-4000-a000-000000000001/transactions',
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'BUY',
          transactionDate: new Date().toISOString(),
          quantity: '10',
          price: '100'
        }
      });
      expect(response.statusCode).toBe(401);
    });

    it('Test F: rejects PATCH/archive/restore/holdings/txs endpoints with 401 without x-user-id header', async () => {
      const dummyId = '00000000-0000-4000-a000-000000000001';

      const resPatch = await app.inject({ method: 'PATCH', url: `/api/v1/portfolios/${dummyId}`, payload: { name: 'X' } });
      expect(resPatch.statusCode).toBe(401);

      const resArchive = await app.inject({ method: 'POST', url: `/api/v1/portfolios/${dummyId}/archive` });
      expect(resArchive.statusCode).toBe(401);

      const resRestore = await app.inject({ method: 'POST', url: `/api/v1/portfolios/${dummyId}/restore` });
      expect(resRestore.statusCode).toBe(401);

      const resHoldings = await app.inject({ method: 'GET', url: `/api/v1/portfolios/${dummyId}/holdings` });
      expect(resHoldings.statusCode).toBe(401);

      const resTxs = await app.inject({ method: 'GET', url: `/api/v1/portfolios/${dummyId}/transactions` });
      expect(resTxs.statusCode).toBe(401);
    });
  });

  describe('2. Portfolio CRUD & Ownership Isolation', () => {
    let userAPortfolioId: string;

    it('creates a new portfolio for User A', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/portfolios',
        headers: { 'x-user-id': userAId },
        payload: {
          name: 'Core Growth Portfolio',
          description: 'Long term equity strategy'
        }
      });
      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.name).toBe('Core Growth Portfolio');
      expect(payload.data.userId).toBe(userAId);
      expect(payload.data.status).toBe('ACTIVE');
      userAPortfolioId = payload.data.id;
    });

    it('prevents User B from viewing User A portfolio (404 Not Found)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${userAPortfolioId}`,
        headers: { 'x-user-id': userBId }
      });
      expect(response.statusCode).toBe(404);
    });

    it('allows User A to view their own portfolio', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${userAPortfolioId}`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.id).toBe(userAPortfolioId);
      expect(payload.data.holdings).toEqual([]);
    });

    it('allows User A to rename their portfolio', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/portfolios/${userAPortfolioId}`,
        headers: { 'x-user-id': userAId },
        payload: { name: 'Strategic Equities' }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.name).toBe('Strategic Equities');
    });

    it('prevents User B from renaming User A portfolio (404 Not Found)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/portfolios/${userAPortfolioId}`,
        headers: { 'x-user-id': userBId },
        payload: { name: 'Hacked Name' }
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('3. Transaction Ledger & Weighted-Average Accounting Engine (Decimal.js)', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Accounting Test Portfolio');
      portfolioId = p.id;
    });

    it('records initial BUY transaction and computes acquisition cost + charges/taxes', async () => {
      // BUY 10 RELIANCE @ 2000.00, charges=20.00, taxes=5.00
      // gross = 20000.00, total = 20025.00
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'BUY',
          transactionDate: new Date('2026-01-10T10:00:00Z').toISOString(),
          quantity: '10.0000',
          price: '2000.0000',
          charges: '20.0000',
          taxes: '5.0000',
          externalReference: 'BUY-001'
        }
      });
      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.data.grossAmount).toBe('20000.0000');
      expect(payload.data.totalAmount).toBe('20025.0000');

      // Verify holdings derivation
      const holdingsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/holdings`,
        headers: { 'x-user-id': userAId }
      });
      const holdingsPayload = JSON.parse(holdingsRes.payload);
      expect(holdingsPayload.data.length).toBe(1);
      const h = holdingsPayload.data[0];
      expect(h.quantity).toBe('10.0000');
      expect(h.totalAcquisitionCost).toBe('20025.0000'); // 20000 + 20 + 5
      expect(h.averageCost).toBe('2002.5000'); // 20025 / 10
      expect(h.currentPrice).toBe('2500.0000');
      expect(h.marketValue).toBe('25000.0000'); // 10 * 2500
      expect(h.unrealizedGainLoss).toBe('4975.0000'); // 25000 - 20025
    });

    it('records second BUY transaction and updates weighted-average cost basis', async () => {
      // BUY 10 RELIANCE @ 3000.00, charges=10.00, taxes=5.00
      // gross = 30000.00, total = 30015.00
      // Cumulative qty = 20.0000
      // Cumulative cost basis = 20025.00 + 30015.00 = 50040.00
      // Weighted average cost = 50040 / 20 = 2502.00
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'BUY',
          transactionDate: new Date('2026-01-15T10:00:00Z').toISOString(),
          quantity: '10.0000',
          price: '3000.0000',
          charges: '10.0000',
          taxes: '5.0000'
        }
      });
      expect(response.statusCode).toBe(201);

      const holdingsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/holdings`,
        headers: { 'x-user-id': userAId }
      });
      const holdingsPayload = JSON.parse(holdingsRes.payload);
      const h = holdingsPayload.data[0];
      expect(h.quantity).toBe('20.0000');
      expect(h.totalAcquisitionCost).toBe('50040.0000');
      expect(h.averageCost).toBe('2502.0000');
    });

    it('records partial SELL transaction and reduces remaining cost basis proportionally', async () => {
      // SELL 5 RELIANCE @ 2600.00, charges=10.00, taxes=2.00
      // gross = 13000.00, total proceeds = 13000 - 12 = 12988.00
      // Sold quantity = 5
      // Current avg cost = 2502.00
      // Cost removed = 2502.00 * 5 = 12510.00
      // Remaining cost basis = 50040.00 - 12510.00 = 37530.00
      // Remaining qty = 15.0000
      // Average cost remains 2502.00 (37530 / 15)
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'SELL',
          transactionDate: new Date('2026-02-01T10:00:00Z').toISOString(),
          quantity: '5.0000',
          price: '2600.0000',
          charges: '10.0000',
          taxes: '2.0000'
        }
      });
      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.data.grossAmount).toBe('13000.0000');
      expect(payload.data.totalAmount).toBe('12988.0000'); // net proceeds

      const holdingsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/holdings`,
        headers: { 'x-user-id': userAId }
      });
      const holdingsPayload = JSON.parse(holdingsRes.payload);
      const h = holdingsPayload.data[0];
      expect(h.quantity).toBe('15.0000');
      expect(h.totalAcquisitionCost).toBe('37530.0000');
      expect(h.averageCost).toBe('2502.0000');
    });

    it('rejects SELL transaction that exceeds available holdings (422 Oversell Error)', async () => {
      // Current available qty = 15. Attempt to SELL 16.
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'SELL',
          transactionDate: new Date('2026-02-05T10:00:00Z').toISOString(),
          quantity: '16.0000',
          price: '2700.0000'
        }
      });
      expect(response.statusCode).toBe(422);
      const payload = JSON.parse(response.payload);
      expect(payload.error.code).toBe('OVERSELL_ERROR');
    });

    it('rejects future-dated transactions with 422 Unprocessable Entity', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'BUY',
          transactionDate: futureDate,
          quantity: '5.0000',
          price: '2500.0000'
        }
      });
      expect(response.statusCode).toBe(422);
      const payload = JSON.parse(response.payload);
      expect(payload.error.code).toBe('FUTURE_TRANSACTION_DATE');
    });

    it('completes full SELL and removes instrument from active holdings while preserving history', async () => {
      // SELL remaining 15.0000 shares
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'SELL',
          transactionDate: new Date('2026-02-10T10:00:00Z').toISOString(),
          quantity: '15.0000',
          price: '2700.0000'
        }
      });
      expect(response.statusCode).toBe(201);

      // Active holdings should now be empty
      const holdingsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/holdings`,
        headers: { 'x-user-id': userAId }
      });
      const holdingsPayload = JSON.parse(holdingsRes.payload);
      expect(holdingsPayload.data).toEqual([]);

      // Transaction history remains intact with 4 transactions
      const txRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId }
      });
      const txPayload = JSON.parse(txRes.payload);
      expect(txPayload.data.length).toBe(4);
    });

    it('rejects SELL transaction where charges and taxes exceed gross amount resulting in negative total (422 Unprocessable Entity)', async () => {
      // Seed a BUY first so holdings exist
      await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'BUY',
          transactionDate: new Date('2026-02-11T10:00:00Z').toISOString(),
          quantity: '10.0000',
          price: '10.0000'
        }
      });

      // Attempt SELL: gross = 10 * 10 = 100.00, charges = 70.00, taxes = 40.00 => total = -10.00
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'SELL',
          transactionDate: new Date('2026-02-12T10:00:00Z').toISOString(),
          quantity: '10.0000',
          price: '10.0000',
          charges: '70.0000',
          taxes: '40.0000'
        }
      });
      expect(response.statusCode).toBe(422);
      const payload = JSON.parse(response.payload);
      expect(payload.error.code).toBe('INVALID_FINANCIAL_RECORD');
      expect(payload.error.message).toContain('INVALID_TOTAL_AMOUNT');
    });
  });

  describe('4. Concurrency & Race Condition Safety (Simultaneous SELL Protection)', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Concurrency Test Portfolio');
      portfolioId = p.id;
      // Seed initial BUY of 10 shares
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: testInstrument2Id,
        transactionType: 'BUY',
        transactionDate: new Date('2026-01-01T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '1000.0000'
      });
    });

    it('prevents concurrent SELL requests from overselling available holding', async () => {
      // Current holdings = 10. Send two concurrent SELL requests for 7 shares each.
      // Total requested = 14 > 10. Exactly ONE must succeed (201) and ONE must fail (422).
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/portfolios/${portfolioId}/transactions`,
          headers: { 'x-user-id': userAId },
          payload: {
            instrumentId: testInstrument2Id,
            transactionType: 'SELL',
            transactionDate: new Date('2026-01-02T10:00:00Z').toISOString(),
            quantity: '7.0000',
            price: '1100.0000'
          }
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/portfolios/${portfolioId}/transactions`,
          headers: { 'x-user-id': userAId },
          payload: {
            instrumentId: testInstrument2Id,
            transactionType: 'SELL',
            transactionDate: new Date('2026-01-02T10:01:00Z').toISOString(),
            quantity: '7.0000',
            price: '1100.0000'
          }
        })
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      expect(statusCodes).toEqual([201, 422]);

      // Verify remaining quantity is exactly 3.0000 (10 - 7) and never negative
      const holdings = await portfolioService.getPortfolioHoldings(portfolioId, userAId);
      expect(holdings.length).toBe(1);
      expect(holdings[0].quantity).toBe('3.0000');
    });
  });

  describe('5. Non-Destructive Archiving & Restore Workflow', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Archiving Test Portfolio');
      portfolioId = p.id;
    });

    it('archives portfolio successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/archive`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.status).toBe('ARCHIVED');
    });

    it('rejects adding transaction to archived portfolio (422 Unprocessable)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/transactions`,
        headers: { 'x-user-id': userAId },
        payload: {
          instrumentId: testInstrument1Id,
          transactionType: 'BUY',
          transactionDate: new Date().toISOString(),
          quantity: '5.0000',
          price: '100.0000'
        }
      });
      expect(response.statusCode).toBe(422);
      const payload = JSON.parse(response.payload);
      expect(payload.error.code).toBe('ARCHIVED_PORTFOLIO');
    });

    it('restores archived portfolio to ACTIVE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/portfolios/${portfolioId}/restore`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.status).toBe('ACTIVE');
    });
  });
});
