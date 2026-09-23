import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { marketInstruments } from '../db/schema/market-instruments.js';
import { marketQuotes } from '../db/schema/market-quotes.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { PortfolioService } from '../domain/services/PortfolioService.js';
import { PnlService } from '../domain/services/PnlService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 13 P&L & Portfolio Analytics Domain, Math & HTTP Security Suite', () => {
  const portfolioRepo = new DrizzlePortfolioRepository();
  const marketRepo = new DrizzleMarketRepository();
  const portfolioService = new PortfolioService(portfolioRepo, marketRepo);
  const pnlService = new PnlService(portfolioRepo, marketRepo);

  const userAId = '00000000-0000-4000-a000-000000000010';
  const userBId = '00000000-0000-4000-a000-000000000020';
  let app: FastifyInstance;
  let instRelianceId: string;
  let instTcsId: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed test users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-pnl@apexos.dev', name: 'User A PnL' },
      { id: userBId, email: 'user-b-pnl@apexos.dev', name: 'User B PnL' }
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
      symbol: 'TCS',
      displayName: 'Tata Consultancy Services',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    instRelianceId = inst1 ? inst1.id : (await marketRepo.getInstrumentBySymbolAndExchange('RELIANCE', 'NSE'))!.id;
    instTcsId = inst2 ? inst2.id : (await marketRepo.getInstrumentBySymbolAndExchange('TCS', 'NSE'))!.id;

    // 3. Seed live quotes
    await db.insert(marketQuotes).values([
      {
        instrumentId: instRelianceId,
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
        instrumentId: instTcsId,
        lastPrice: '3800.0000',
        previousClose: '3750.0000',
        change: '50.0000',
        changePercent: '1.3333',
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

  describe('1. HTTP Identity Boundary & Ownership Security', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Security Test Portfolio');
      portfolioId = p.id;
    });

    it('rejects GET /api/v1/portfolios/:id/pnl without x-user-id with 401', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/portfolios/${portfolioId}/pnl` });
      expect(res.statusCode).toBe(401);
    });

    it('rejects GET /api/v1/portfolios/:id/pnl with malformed x-user-id header with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/pnl`,
        headers: { 'x-user-id': 'invalid-uuid' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('prevents User B from viewing User A P&L summary with 404 Not Found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/pnl`,
        headers: { 'x-user-id': userBId }
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User B from viewing User A holding P&L with 404 Not Found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/pnl/holdings`,
        headers: { 'x-user-id': userBId }
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User B from viewing User A realized P&L ledger with 404 Not Found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/pnl/realized`,
        headers: { 'x-user-id': userBId }
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('2. Canonical Realized P&L Math Engine (Item 41 Rule Test)', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Single Buy Sell PnL Test');
      portfolioId = p.id;
    });

    it('reproduces exact single BUY/SELL realized P&L numbers', async () => {
      // BUY 10 @ 100, charges=5, taxes=5
      // Gross = 1000, Total cost basis = 1010, Average cost = 101
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'BUY',
        transactionDate: new Date('2026-01-10T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '100.0000',
        charges: '5.0000',
        taxes: '5.0000'
      });

      // SELL 4 @ 120, charges=3, taxes=2
      // Gross = 480, Net proceeds = 475
      // Cost removed = 4 * 101 = 404
      // Realized P&L = 475 - 404 = 71
      // Remaining quantity = 6, Remaining cost basis = 606, Average cost = 101
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'SELL',
        transactionDate: new Date('2026-01-15T10:00:00Z').toISOString(),
        quantity: '4.0000',
        price: '120.0000',
        charges: '3.0000',
        taxes: '2.0000'
      });

      const realized = await pnlService.getRealizedPnL(portfolioId, userAId);
      expect(realized.length).toBe(1);
      const r = realized[0];
      expect(r.soldQuantity).toBe('4.0000');
      expect(r.price).toBe('120.0000');
      expect(r.grossProceeds).toBe('480.0000');
      expect(r.charges).toBe('3.0000');
      expect(r.taxes).toBe('2.0000');
      expect(r.netProceeds).toBe('475.0000');
      expect(r.averageCostBeforeSell).toBe('101.0000');
      expect(r.costRemoved).toBe('404.0000');
      expect(r.realizedPnL).toBe('71.0000');

      // Verify holdings state
      const holdings = await pnlService.getHoldingPnL(portfolioId, userAId);
      expect(holdings.length).toBe(1);
      const h = holdings[0];
      expect(h.quantity).toBe('6.0000');
      expect(h.averageCost).toBe('101.0000');
      expect(h.totalAcquisitionCost).toBe('606.0000');
      expect(h.realizedPnL).toBe('71.0000');
    });
  });

  describe('3. Multiple-BUY Weighted-Average Cost Basis Realized P&L (Item 42 Rule Test)', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Multiple Buy PnL Test');
      portfolioId = p.id;
    });

    it('calculates realized P&L based on cumulative weighted-average cost basis', async () => {
      // BUY 10 @ 100
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instTcsId,
        transactionType: 'BUY',
        transactionDate: new Date('2026-02-01T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '100.0000'
      });

      // BUY 10 @ 120
      // Cumulative Cost = 2200, Quantity = 20, Average Cost = 110
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instTcsId,
        transactionType: 'BUY',
        transactionDate: new Date('2026-02-05T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '120.0000'
      });

      // SELL 5 @ 150
      // Gross = 750, Net proceeds = 750
      // Cost removed = 5 * 110 = 550
      // Realized P&L = 750 - 550 = 200
      // Remaining cost = 1650, Remaining qty = 15, Average cost = 110
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instTcsId,
        transactionType: 'SELL',
        transactionDate: new Date('2026-02-10T10:00:00Z').toISOString(),
        quantity: '5.0000',
        price: '150.0000'
      });

      const realized = await pnlService.getRealizedPnL(portfolioId, userAId);
      expect(realized.length).toBe(1);
      const r = realized[0];
      expect(r.averageCostBeforeSell).toBe('110.0000');
      expect(r.costRemoved).toBe('550.0000');
      expect(r.netProceeds).toBe('750.0000');
      expect(r.realizedPnL).toBe('200.0000');

      const holdings = await pnlService.getHoldingPnL(portfolioId, userAId);
      expect(holdings[0].quantity).toBe('15.0000');
      expect(holdings[0].totalAcquisitionCost).toBe('1650.0000');
      expect(holdings[0].averageCost).toBe('110.0000');
    });
  });

  describe('4. Backdated Transaction Ledger Analytics Re-calculation (Item 43 Rule Test)', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Backdated PnL Test');
      portfolioId = p.id;
    });

    it('correctly processes backdated transactions in chronological ledger order', async () => {
      // 1. Insert BUY on Jan 10
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'BUY',
        transactionDate: new Date('2026-01-10T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '100.0000'
      });

      // 2. Insert SELL on Jan 20
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'SELL',
        transactionDate: new Date('2026-01-20T10:00:00Z').toISOString(),
        quantity: '5.0000',
        price: '150.0000'
      });

      // Initial realized P&L for SELL on Jan 20:
      // Avg cost before sell = 100. Cost removed = 500. Net proceeds = 750. Realized P&L = 250.
      let realized = await pnlService.getRealizedPnL(portfolioId, userAId);
      expect(realized[0].realizedPnL).toBe('250.0000');

      // 3. Now insert a BACKDATED BUY on Jan 15 @ 200!
      // Chronological ledger becomes:
      // - Jan 10: BUY 10 @ 100 -> qty=10, cost=1000, avgCost=100
      // - Jan 15: BUY 10 @ 200 -> qty=20, cost=3000, avgCost=150
      // - Jan 20: SELL 5 @ 150 -> avgCost=150! costRemoved = 5 * 150 = 750. Net proceeds = 750. Realized P&L = 0!
      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'BUY',
        transactionDate: new Date('2026-01-15T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '200.0000'
      });

      realized = await pnlService.getRealizedPnL(portfolioId, userAId);
      expect(realized.length).toBe(1);
      expect(realized[0].averageCostBeforeSell).toBe('150.0000');
      expect(realized[0].costRemoved).toBe('750.0000');
      expect(realized[0].realizedPnL).toBe('0.0000');
    });
  });

  describe('5. Date Range Filtering & Valuation Coverage', () => {
    let portfolioId: string;

    beforeAll(async () => {
      const p = await portfolioService.createPortfolio(userAId, 'Date Filter PnL Test');
      portfolioId = p.id;

      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'BUY',
        transactionDate: new Date('2026-01-01T10:00:00Z').toISOString(),
        quantity: '10.0000',
        price: '100.0000'
      });

      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'SELL',
        transactionDate: new Date('2026-01-10T10:00:00Z').toISOString(),
        quantity: '2.0000',
        price: '120.0000'
      });

      await portfolioService.addTransaction(portfolioId, userAId, {
        instrumentId: instRelianceId,
        transactionType: 'SELL',
        transactionDate: new Date('2026-02-10T10:00:00Z').toISOString(),
        quantity: '2.0000',
        price: '140.0000'
      });
    });

    it('filters realized P&L records by date range while maintaining full ledger cost-basis accuracy', async () => {
      const resFiltered = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/pnl/realized?fromDate=2026-02-01T00:00:00Z&toDate=2026-02-28T23:59:59Z`,
        headers: { 'x-user-id': userAId }
      });
      expect(resFiltered.statusCode).toBe(200);
      const payload = JSON.parse(resFiltered.payload);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].transactionDate).toContain('2026-02-10');
      expect(payload.data[0].averageCostBeforeSell).toBe('100.0000');
      expect(payload.data[0].realizedPnL).toBe('80.0000'); // (2 * 140) - (2 * 100) = 280 - 200 = 80
    });

    it('returns P&L summary overview with live valuation coverage', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portfolios/${portfolioId}/pnl`,
        headers: { 'x-user-id': userAId }
      });
      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      expect(payload.data.portfolioId).toBe(portfolioId);
      expect(payload.data.valuationCoverage.totalHoldingsCount).toBe(1);
      expect(payload.data.valuationCoverage.valuedHoldingsCount).toBe(1);
      expect(payload.data.valuationCoverage.coveragePercentage).toBe('100.0000');
      expect(payload.data.valuationCoverage.overallFreshness).toBe('LIVE');
    });
  });
});
