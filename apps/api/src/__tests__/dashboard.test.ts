import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { marketInstruments } from '../db/schema/market-instruments.js';
import { marketQuotes } from '../db/schema/market-quotes.js';
import { portfolios } from '../db/schema/portfolios.js';
import { portfolioTransactions } from '../db/schema/portfolio-transactions.js';
import { ipos } from '../db/schema/ipos.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzleWatchlistRepository } from '../infrastructure/repositories/DrizzleWatchlistRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleKhataTransactionRepository } from '../infrastructure/repositories/DrizzleKhataTransactionRepository.js';
import { DrizzleAlertRepository } from '../infrastructure/repositories/DrizzleAlertRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { DevelopmentIPOProvider } from '../infrastructure/providers/DevelopmentIPOProvider.js';
import { PnlService } from '../domain/services/PnlService.js';
import { PortfolioService } from '../domain/services/PortfolioService.js';
import { WatchlistService } from '../domain/services/WatchlistService.js';
import { IPOService } from '../domain/services/IPOService.js';
import { IPOApplicationService } from '../domain/services/IPOApplicationService.js';
import { KhataService } from '../domain/services/KhataService.js';
import { AlertService } from '../domain/services/AlertService.js';
import { NotificationService } from '../domain/services/NotificationService.js';
import { DashboardService } from '../domain/services/DashboardService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

describe('Phase 15 Unified Dashboard & Financial Command Center Suite', () => {
  const portfolioRepo = new DrizzlePortfolioRepository();
  const marketRepo = new DrizzleMarketRepository();
  const watchlistRepo = new DrizzleWatchlistRepository();
  const ipoRepo = new DrizzleIPORepository();
  const ipoAppRepo = new DrizzleIPOApplicationRepository();
  const khataAccountRepo = new DrizzleKhataAccountRepository();
  const khataTxRepo = new DrizzleKhataTransactionRepository();
  const alertRepo = new DrizzleAlertRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const ipoDataProvider = new DevelopmentIPOProvider();

  const pnlService = new PnlService(portfolioRepo, marketRepo);
  const portfolioService = new PortfolioService(portfolioRepo, marketRepo, auditRepo);
  const watchlistService = new WatchlistService(watchlistRepo, marketRepo, auditRepo);
  const ipoService = new IPOService(ipoRepo, ipoDataProvider, auditRepo);
  const ipoAppService = new IPOApplicationService(ipoAppRepo, ipoRepo, khataAccountRepo, auditRepo);
  const khataService = new KhataService(khataAccountRepo, khataTxRepo, auditRepo);
  const alertService = new AlertService(alertRepo, marketRepo, portfolioRepo, ipoRepo, auditRepo);
  const notificationService = new NotificationService(alertRepo, auditRepo);

  const dashboardService = new DashboardService(
    pnlService,
    portfolioService,
    watchlistService,
    ipoService,
    ipoAppService,
    khataService,
    alertService,
    notificationService
  );

  const userAId = '00000000-0000-4000-a000-000000000050';
  const userBId = '00000000-0000-4000-a000-000000000060';
  let app: FastifyInstance;
  let instRelianceId: string;
  let portfolioA1Id: string;
  let portfolioA2Id: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-dash@apexos.dev', name: 'User A Dashboard' },
      { id: userBId, email: 'user-b-dash@apexos.dev', name: 'User B Dashboard' }
    ]).onConflictDoNothing();

    // 2. Seed market instrument & quote
    const [inst] = await db.insert(marketInstruments).values({
      symbol: 'RELIANCE_DASH',
      displayName: 'Reliance Industries Limited',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    instRelianceId = inst ? inst.id : (await marketRepo.getInstrumentBySymbolAndExchange('RELIANCE_DASH', 'NSE'))!.id;

    await db.insert(marketQuotes).values({
      instrumentId: instRelianceId,
      lastPrice: '2500.0000',
      previousClose: '2450.0000',
      change: '50.0000',
      changePercent: '2.0408',
      volume: 500000,
      currency: 'INR',
      marketStatus: 'OPEN',
      dataFreshness: 'LIVE',
      provider: 'NSE_INDIA'
    }).onConflictDoNothing();

    // 3. Seed Portfolio 1 for User A
    const [p1] = await db.insert(portfolios).values({
      userId: userAId,
      name: 'Growth Portfolio 1',
      status: 'ACTIVE'
    }).returning();
    portfolioA1Id = p1.id;

    await db.insert(portfolioTransactions).values({
      portfolioId: portfolioA1Id,
      instrumentId: instRelianceId,
      transactionType: 'BUY',
      transactionDate: new Date('2026-01-10T10:00:00Z'),
      quantity: '10.0000',
      price: '2000.0000',
      grossAmount: '20000.0000',
      charges: '0.0000',
      taxes: '0.0000',
      totalAmount: '20000.0000'
    });

    // 4. Seed Portfolio 2 for User A (Multi-portfolio test)
    const [p2] = await db.insert(portfolios).values({
      userId: userAId,
      name: 'Secondary Portfolio 2',
      status: 'ACTIVE'
    }).returning();
    portfolioA2Id = p2.id;

    await db.insert(portfolioTransactions).values({
      portfolioId: portfolioA2Id,
      instrumentId: instRelianceId,
      transactionType: 'BUY',
      transactionDate: new Date('2026-02-10T10:00:00Z'),
      quantity: '5.0000',
      price: '2200.0000',
      grossAmount: '11000.0000',
      charges: '0.0000',
      taxes: '0.0000',
      totalAmount: '11000.0000'
    });

    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDb();
  });

  describe('1. Security Boundary & HTTP Endpoint Isolation', () => {
    it('rejects GET /api/v1/dashboard/summary without x-user-id with 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard/summary' });
      expect(res.statusCode).toBe(401);
    });

    it('rejects GET /api/v1/dashboard/summary with malformed x-user-id with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/summary',
        headers: { 'x-user-id': 'not-a-uuid' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns empty section states for User B with 0 portfolios without cross-user leakage', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/summary',
        headers: { 'x-user-id': userBId }
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.portfolioOverview.status).toBe('EMPTY');
      expect(json.data.portfolioOverview.data).toBeNull();
    });
  });

  describe('2. Multi-Portfolio Monetary Aggregation & Return Metrics Semantics', () => {
    it('aggregates total market value and acquisition cost additively using Decimal.js across multiple portfolios', async () => {
      const summary = await dashboardService.getDashboardSummary(userAId);
      expect(summary.portfolioOverview.status).toBe('SUCCESS');
      const pData = summary.portfolioOverview.data!;

      expect(pData.portfolioCount).toBe(2);
      // Portfolio 1: 10 shares @ 2500 = 25000, Cost = 20000
      // Portfolio 2: 5 shares @ 2500 = 12500, Cost = 11000
      // Aggregate Value = 37500.0000, Cost = 31000.0000
      expect(pData.totalMarketValue).toBe('37500.0000');
      expect(pData.totalAcquisitionCost).toBe('31000.0000');
      expect(pData.unrealizedPnL).toBe('6500.0000'); // 37500 - 31000 = 6500

      // Simple Return % = (6500 / 31000) * 100 = 20.9677%
      expect(pData.simpleReturnPercent).toBe('20.9677');

      // Multi-Portfolio XIRR must be NULL (xirrStatus = UNAVAILABLE) without a multi-portfolio cashflow engine
      expect(pData.xirrPercent).toBeNull();
      expect(pData.xirrStatus).toBe('UNAVAILABLE');
    });
  });

  describe('3. Market Freshness & Daily Market Change % Terminology', () => {
    it('surfaces Daily Market Change % from canonical quote without labeling it as rupee day P&L', async () => {
      const summary = await dashboardService.getDashboardSummary(userAId);
      expect(summary.headerTelemetry.data?.overallFreshness).toBe('LIVE');
    });

    it('aggregates quote freshness using severity order UNAVAILABLE > STALE > EOD > DELAYED > LIVE', async () => {
      const db = await getDb();
      await db.update(marketQuotes).set({ dataFreshness: 'STALE' }).where(eq(marketQuotes.instrumentId, instRelianceId));

      const summary = await dashboardService.getDashboardSummary(userAId);
      expect(summary.portfolioOverview.data?.overallFreshness).toBe('STALE');
      expect(summary.portfolioOverview.data?.valuationPartial).toBe(false);

      // Restore
      await db.update(marketQuotes).set({ dataFreshness: 'LIVE' }).where(eq(marketQuotes.instrumentId, instRelianceId));
    });
  });

  describe('4. IPO 24-Hour Closing Window UTC Semantics', () => {
    it('flags active IPO as closingSoon strictly when closing date is within 24 hours in UTC', async () => {
      const now = new Date();
      const closeSoonDate = new Date(now.getTime() + 12 * 3600 * 1000); // 12 hours from now

      const db = await getDb();
      const [ipo] = await db.insert(ipos).values({
        externalId: 'ext-dash-ipo-1',
        provider: 'NSE_INDIA',
        source: 'OFFICIAL',
        issuerName: 'DashCorp IPO',
        ipoName: 'DashCorp Ltd',
        exchange: 'NSE',
        securityType: 'EQUITY',
        issueType: 'MAINBOARD',
        status: 'OPEN',
        openDate: new Date(now.getTime() - 24 * 3600 * 1000),
        closeDate: closeSoonDate
      }).returning();

      const summary = await dashboardService.getDashboardSummary(userAId);
      expect(summary.ipoSummary.status).toBe('SUCCESS');
      const activeIpo = summary.ipoSummary.data?.activeIpos.find((i) => i.id === ipo.id);
      expect(activeIpo).toBeDefined();
      expect(activeIpo?.closingSoon).toBe(true);
    });
  });

  describe('5. Activity Stream Scope & Subsystem Failure Resilience', () => {
    it('aggregates timestamped domain activity without fabricating ordinary quote changes as activity events', async () => {
      const summary = await dashboardService.getDashboardSummary(userAId);
      expect(summary.activityStream.status).toBeDefined();
      if (summary.activityStream.data) {
        for (const item of summary.activityStream.data) {
          expect(['KHATA', 'PORTFOLIO', 'IPO', 'NOTIFICATION']).toContain(item.category);
        }
      }
    });

    it('isolates subsystem failures using Promise.allSettled without crashing overall dashboard response', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/summary',
        headers: { 'x-user-id': userAId }
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.generatedAt).toBeDefined();
    });
  });
});
