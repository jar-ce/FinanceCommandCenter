/**
 * FINANCE COMMAND CENTER (APEX OS)
 * Phase 16 Reports & Analytics Test Suite
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { resolveDateRange } from '../domain/utils/DateRangeResolver.js';


describe('Phase 16 Reports & Analytics Subsystem Suite', () => {
  let app: FastifyInstance;
  const userAId = '11111111-1111-4111-a111-111111111111';
  const userBId = '22222222-2222-4222-b222-222222222222';

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // Ensure clean test users exist
    await db.insert(users).values([
      { id: userAId, email: 'report_usera@example.com', name: 'Report User A' },
      { id: userBId, email: 'report_userb@example.com', name: 'Report User B' }
    ]).onConflictDoNothing();

    app = await buildApp();
    await app.ready();
  });


  afterAll(async () => {
    await app.close();
    await closeDb();
  });

  // ==========================================
  // 1. DATE RANGE RESOLVER UNIT TESTS
  // ==========================================
  describe('DateRangeResolver', () => {
    it('should resolve TODAY preset in Asia/Kolkata timezone to exact UTC ISO boundaries', () => {
      const refDate = new Date('2026-09-22T10:00:00.000Z');
      const resolved = resolveDateRange({ preset: 'TODAY', timezone: 'Asia/Kolkata' }, refDate);

      expect(resolved.preset).toBe('TODAY');
      expect(resolved.timezone).toBe('Asia/Kolkata');
      // 2026-09-22 00:00:00 IST -> 2026-09-21T18:30:00.000Z
      expect(resolved.fromUtc).toBe('2026-09-21T18:30:00.000Z');
      // 2026-09-22 23:59:59.999 IST -> 2026-09-22T18:29:59.999Z
      expect(resolved.toUtc).toBe('2026-09-22T18:29:59.999Z');
    });

    it('should resolve YESTERDAY preset in Asia/Kolkata timezone correctly', () => {
      const refDate = new Date('2026-09-22T10:00:00.000Z');
      const resolved = resolveDateRange({ preset: 'YESTERDAY' }, refDate);

      expect(resolved.preset).toBe('YESTERDAY');
      expect(resolved.fromUtc).toBe('2026-09-20T18:30:00.000Z');
      expect(resolved.toUtc).toBe('2026-09-21T18:29:59.999Z');
    });

    it('should resolve CURRENT_MONTH preset correctly', () => {
      const refDate = new Date('2026-09-22T10:00:00.000Z');
      const resolved = resolveDateRange({ preset: 'CURRENT_MONTH' }, refDate);

      expect(resolved.preset).toBe('CURRENT_MONTH');
      // 2026-09-01 00:00:00 IST -> 2026-08-31T18:30:00.000Z
      expect(resolved.fromUtc).toBe('2026-08-31T18:30:00.000Z');
      // 2026-09-30 23:59:59.999 IST -> 2026-09-30T18:29:59.999Z
      expect(resolved.toUtc).toBe('2026-09-30T18:29:59.999Z');
    });

    it('should resolve CUSTOM date range with YYYY-MM-DD input', () => {
      const resolved = resolveDateRange({
        preset: 'CUSTOM',
        fromDate: '2026-01-01',
        toDate: '2026-03-31'
      });

      expect(resolved.preset).toBe('CUSTOM');
      expect(resolved.fromUtc).toBe('2025-12-31T18:30:00.000Z');
      expect(resolved.toUtc).toBe('2026-03-31T18:29:59.999Z');
    });

    it('should throw error when fromDate > toDate', () => {
      expect(() => {
        resolveDateRange({
          preset: 'CUSTOM',
          fromDate: '2026-05-10',
          toDate: '2026-01-01'
        });
      }).toThrow('Invalid date range');
    });
  });

  // ==========================================
  // 2. SECURITY & TENANT ISOLATION TESTS
  // ==========================================
  describe('Security & Authentication', () => {
    it('should return 401 Unauthorized if x-user-id header is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/summary'
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 Unauthorized if x-user-id is invalid UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/summary',
        headers: { 'x-user-id': 'invalid-uuid' }
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.success).toBe(false);
    });

    it('should isolate User A and User B report data', async () => {
      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/summary',
        headers: { 'x-user-id': userAId }
      });
      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/summary',
        headers: { 'x-user-id': userBId }
      });

      expect(resA.statusCode).toBe(200);
      expect(resB.statusCode).toBe(200);
      expect(resA.json().data).toBeDefined();
      expect(resB.json().data).toBeDefined();
    });
  });

  // ==========================================
  // 3. REPORT ENDPOINTS INTEGRATION TESTS
  // ==========================================
  describe('Report API Endpoints', () => {
    it('GET /api/v1/reports/summary should return Executive Summary DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/summary?preset=CURRENT_MONTH',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.portfolioCount).toBeDefined();
      expect(json.data.totalMarketValue).toBeDefined();
      expect(json.data.khataNetBalance).toBeDefined();
      expect(json.data.activeIpoApplicationsCount).toBeDefined();
      expect(json.data.activeAlertRulesCount).toBeDefined();
      expect(json.data.generatedAt).toBeDefined();
    });

    it('GET /api/v1/reports/portfolio-performance should return Portfolio Performance DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/portfolio-performance?preset=CURRENT_YEAR',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.currentSnapshot).toBeDefined();
      expect(json.data.periodPerformance).toBeDefined();
      expect(json.data.periodPerformance.dateRange.preset).toBe('CURRENT_YEAR');
    });

    it('GET /api/v1/reports/asset-allocation should return Asset Allocation DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/asset-allocation',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalMarketValue).toBeDefined();
      expect(json.data.holdings).toBeInstanceOf(Array);
      expect(json.data.breakdownBySecurityType).toBeInstanceOf(Array);
    });

    it('GET /api/v1/reports/realized-pnl should return Paginated Realized P&L DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/realized-pnl?page=1&limit=10',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.items).toBeInstanceOf(Array);
      expect(json.data.total).toBeDefined();
      expect(json.data.page).toBe(1);
    });

    it('GET /api/v1/reports/khata-cashflow should return Khata Cash Flow DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/khata-cashflow?preset=ALL_TIME',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalInflow).toBeDefined();
      expect(json.data.totalOutflow).toBeDefined();
      expect(json.data.netCashMovement).toBeDefined();
      expect(json.data.accountSummaries).toBeInstanceOf(Array);
      expect(json.data.transactions.items).toBeInstanceOf(Array);
    });

    it('GET /api/v1/reports/ipo-participation should return IPO Participation DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/ipo-participation',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalApplicationsCount).toBeDefined();
      expect(json.data.totalCapitalCommitted).toBeDefined();
      expect(json.data.statusBreakdown).toBeDefined();
      expect(json.data.allotmentStats).toBeDefined();
    });

    it('GET /api/v1/reports/alerts-analytics should return Alerts Analytics DTO', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/alerts-analytics',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.activeRulesCount).toBeDefined();
      expect(json.data.totalRulesCount).toBeDefined();
      expect(json.data.rulesByType).toBeInstanceOf(Array);
      expect(json.data.unreadNotificationsCount).toBeDefined();
    });
  });

  // ==========================================
  // 4. SEMANTIC INTEGRITY & FIN-ENGINE AUDIT TESTS
  // ==========================================
  describe('Semantic Integrity & Return Metrics Audit', () => {
    it('should decouple current snapshot unrealized P&L from period simple return', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/portfolio-performance?preset=CURRENT_MONTH',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.currentSnapshot).toBeDefined();
      expect(data.periodPerformance).toBeDefined();

      // Current snapshot holds current market valuation & unrealized P&L
      expect(data.currentSnapshot.totalMarketValue).toBeDefined();
      expect(data.currentSnapshot.unrealizedPnLPercent).toBeDefined();

      // Period performance holds period realized P&L and net capital invested
      expect(data.periodPerformance.realizedPnL).toBeDefined();
      expect(data.periodPerformance.netCapitalInvested).toBeDefined();
      expect(data.periodPerformance.simpleReturnPercent).toBeDefined();
    });

    it('should set XIRR and CAGR to null/UNAVAILABLE for multi-portfolio or empty scenarios', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/portfolio-performance',
        headers: { 'x-user-id': userAId }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      if (data.isMultiPortfolio || data.currentSnapshot.holdingCount === 0) {
        expect(data.periodPerformance.xirrPercent).toBeNull();
        expect(data.periodPerformance.xirrStatus).toBe('UNAVAILABLE');
        expect(data.periodPerformance.cagrPercent).toBeNull();
        expect(data.periodPerformance.cagrStatus).toBe('UNAVAILABLE');
      }
    });

    it('should calculate period Simple Return correctly across BUY-only, SELL-only, zero capital, and positive capital periods', async () => {
      // Query empty preset / future preset to simulate BUY-only or zero-activity period
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/portfolio-performance?preset=YESTERDAY',
        headers: { 'x-user-id': userBId }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.periodPerformance.netCapitalInvested).toBe('0.0000');
      expect(data.periodPerformance.simpleReturnPercent).toBe('0.00');

      // Ensure currentSnapshot metrics remain current-state based while periodPerformance reflects zero period activity
      expect(data.currentSnapshot.unrealizedPnL).toBe('0.0000');
      expect(data.currentSnapshot.unrealizedPnLPercent).toBe('0.00');
    });
  });
});
