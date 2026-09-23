import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { marketInstruments } from '../db/schema/market-instruments.js';
import { marketQuotes } from '../db/schema/market-quotes.js';
import { ipos } from '../db/schema/ipos.js';
import { DrizzleAlertRepository } from '../infrastructure/repositories/DrizzleAlertRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { AlertService } from '../domain/services/AlertService.js';
import { AlertEvaluationService } from '../domain/services/AlertEvaluationService.js';
import { NotificationService } from '../domain/services/NotificationService.js';
import { PnlService } from '../domain/services/PnlService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 14 Alerts & Notifications Domain, Evaluator & Security Suite', () => {
  const alertRepo = new DrizzleAlertRepository();
  const marketRepo = new DrizzleMarketRepository();
  const portfolioRepo = new DrizzlePortfolioRepository();
  const ipoRepo = new DrizzleIPORepository();
  const auditLogRepo = new DrizzleAuditLogRepository();
  const pnlService = new PnlService(portfolioRepo, marketRepo);

  const alertService = new AlertService(alertRepo, marketRepo, portfolioRepo, ipoRepo, auditLogRepo);
  const evaluationService = new AlertEvaluationService(alertRepo, marketRepo, ipoRepo, pnlService, auditLogRepo);
  const notificationService = new NotificationService(alertRepo, auditLogRepo);

  const userAId = '00000000-0000-4000-a000-000000000030';
  const userBId = '00000000-0000-4000-a000-000000000040';
  let app: FastifyInstance;
  let instInfosysId: string;
  let ipoTechCorpId: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-alerts@apexos.dev', name: 'User A Alerts' },
      { id: userBId, email: 'user-b-alerts@apexos.dev', name: 'User B Alerts' }
    ]).onConflictDoNothing();

    // 2. Seed market instrument & quote
    const [inst] = await db.insert(marketInstruments).values({
      symbol: 'INFY',
      displayName: 'Infosys Limited',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    instInfosysId = inst ? inst.id : (await marketRepo.getInstrumentBySymbolAndExchange('INFY', 'NSE'))!.id;

    await db.insert(marketQuotes).values({
      instrumentId: instInfosysId,
      lastPrice: '1500.0000',
      previousClose: '1480.0000',
      change: '20.0000',
      changePercent: '1.3514',
      volume: 100000,
      currency: 'INR',
      marketStatus: 'OPEN',
      dataFreshness: 'LIVE',
      provider: 'NSE_INDIA'
    }).onConflictDoNothing();

    // 3. Seed IPO
    const [ipo] = await db.insert(ipos).values({
      externalId: 'ext-techcorp-101',
      provider: 'NSE_INDIA',
      source: 'OFFICIAL',
      issuerName: 'TechCorp Solutions Ltd',
      ipoName: 'TechCorp IPO',
      exchange: 'NSE',
      securityType: 'EQUITY',
      issueType: 'MAINBOARD',
      status: 'UPCOMING'
    }).onConflictDoNothing().returning();

    ipoTechCorpId = ipo ? ipo.id : (await ipoRepo.list({})).ipos[0].id;

    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDb();
  });

  describe('1. Security Boundary & Ownership Isolation', () => {
    let ruleId: string;

    beforeAll(async () => {
      const rule = await alertService.createAlertRule(userAId, {
        name: 'INFY Price Above ₹1600',
        alertType: 'PRICE_ABOVE',
        targetType: 'MARKET_INSTRUMENT',
        targetId: instInfosysId,
        thresholdValue: '1600.0000',
        cooldownMinutes: 60
      });
      ruleId = rule.id;
    });

    it('rejects GET /api/v1/alerts without x-user-id with 401 Unauthorized', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/alerts' });
      expect(res.statusCode).toBe(401);
    });

    it('rejects GET /api/v1/alerts with malformed x-user-id with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts',
        headers: { 'x-user-id': 'invalid-uuid' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('prevents User B from viewing User A rule with 404 Not Found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${ruleId}`,
        headers: { 'x-user-id': userBId }
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents User B from pausing User A rule with 404 Not Found', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${ruleId}/pause`,
        headers: { 'x-user-id': userBId }
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('2. Threshold Crossing & State Transition Logic', () => {
    let ruleId: string;

    beforeAll(async () => {
      const rule = await alertService.createAlertRule(userAId, {
        name: 'INFY Price Above ₹1550',
        alertType: 'PRICE_ABOVE',
        targetType: 'MARKET_INSTRUMENT',
        targetId: instInfosysId,
        thresholdValue: '1550.0000',
        cooldownMinutes: 0 // set to 0 for instant re-test evaluation
      });
      ruleId = rule.id;
    });

    it('evaluates rule when price is below threshold without triggering (state = BELOW)', async () => {
      // Initial quote is 1500.00, threshold is 1550.00 -> Condition false
      const res = await evaluationService.evaluateRule(ruleId, userAId);
      expect(res.triggered).toBe(false);

      const rule = await alertService.getAlertRuleById(ruleId, userAId);
      expect(rule?.lastEvaluatedState).toBe('BELOW');
      expect(rule?.lastEvaluatedValue).toBe('1500.0000');
    });

    it('triggers alert event when price crosses above threshold (state transition BELOW -> ABOVE)', async () => {
      // Update quote price to 1600.00 (crosses above 1550.00)
      const db = await getDb();
      await db.update(marketQuotes).set({ lastPrice: '1600.0000' }).where(eq(marketQuotes.instrumentId, instInfosysId));

      const res = await evaluationService.evaluateRule(ruleId, userAId);
      expect(res.triggered).toBe(true);
      expect(res.event).toBeDefined();
      expect(res.event?.triggerValue).toBe('1600.0000');
      expect(res.notification).toBeDefined();
      expect(res.notification?.title).toContain('INFY Price Above ₹1550');

      const rule = await alertService.getAlertRuleById(ruleId, userAId);
      expect(rule?.lastEvaluatedState).toBe('ABOVE');
    });

    it('does NOT re-trigger alert when price remains above threshold (1600 -> 1610)', async () => {
      const db = await getDb();
      await db.update(marketQuotes).set({ lastPrice: '1610.0000' }).where(eq(marketQuotes.instrumentId, instInfosysId));

      const res = await evaluationService.evaluateRule(ruleId, userAId);
      expect(res.triggered).toBe(false); // No state transition (ABOVE -> ABOVE)
      expect(res.reason).toBe('CONDITION_NOT_MET_OR_NO_STATE_TRANSITION');

      const rule = await alertService.getAlertRuleById(ruleId, userAId);
      expect(rule?.lastEvaluatedState).toBe('ABOVE');
      expect(rule?.lastEvaluatedValue).toBe('1610.0000');
    });

    it('resets state to BELOW when price drops back below threshold (1610 -> 1520)', async () => {
      const db = await getDb();
      await db.update(marketQuotes).set({ lastPrice: '1520.0000' }).where(eq(marketQuotes.instrumentId, instInfosysId));

      const res = await evaluationService.evaluateRule(ruleId, userAId);
      expect(res.triggered).toBe(false);

      const rule = await alertService.getAlertRuleById(ruleId, userAId);
      expect(rule?.lastEvaluatedState).toBe('BELOW');
      expect(rule?.lastEvaluatedValue).toBe('1520.0000');
    });

    it('triggers alert AGAIN when price crosses above threshold a second time (1520 -> 1570)', async () => {
      // Wait 1.05s to move into next 1-second deduplication window
      await new Promise((r) => setTimeout(r, 1050));

      const db = await getDb();
      await db.update(marketQuotes).set({ lastPrice: '1570.0000' }).where(eq(marketQuotes.instrumentId, instInfosysId));

      const res = await evaluationService.evaluateRule(ruleId, userAId);
      expect(res.triggered).toBe(true);
      expect(res.event?.triggerValue).toBe('1570.0000');

      const rule = await alertService.getAlertRuleById(ruleId, userAId);
      expect(rule?.lastEvaluatedState).toBe('ABOVE');
    });
  });

  describe('3. IPO Opening State-Based Alert Model', () => {
    let ipoRuleId: string;

    beforeAll(async () => {
      const rule = await alertService.createAlertRule(userAId, {
        name: 'TechCorp IPO Opening Alert',
        alertType: 'IPO_OPENING',
        targetType: 'IPO',
        targetId: ipoTechCorpId,
        cooldownMinutes: 60
      });
      ipoRuleId = rule.id;
    });

    it('creates state-based alert rule without requiring threshold numeric values', async () => {
      const rule = await alertService.getAlertRuleById(ipoRuleId, userAId);
      expect(rule?.alertType).toBe('IPO_OPENING');
      expect(rule?.thresholdValue).toBeNull();
    });

    it('triggers state-based alert when IPO transitions UPCOMING -> OPEN with NULL numeric threshold/trigger values', async () => {
      const db = await getDb();
      await db.update(ipos).set({ status: 'OPEN' }).where(eq(ipos.id, ipoTechCorpId));

      const res = await evaluationService.evaluateRule(ipoRuleId, userAId);
      expect(res.triggered).toBe(true);
      expect(res.event?.thresholdValue).toBeNull();
      expect(res.event?.triggerValue).toBeNull();
      expect(res.event?.evaluationSnapshot?.status).toBe('OPEN');
    });
  });

  describe('4. In-App Notifications & Audit Logging', () => {
    it('manages notification status workflow (UNREAD -> READ -> ARCHIVED) and logs audit events', async () => {
      const { items, total } = await notificationService.getUserNotifications(userAId, 'UNREAD');
      expect(total).toBeGreaterThan(0);
      const notif = items[0];

      // Mark Read
      const readNotif = await notificationService.markAsRead(notif.id, userAId);
      expect(readNotif.status).toBe('READ');
      expect(readNotif.readAt).not.toBeNull();

      // Check Audit Logs
      const logs = await auditLogRepo.listByUserId(userAId);
      const readLog = logs.find((l) => l.action === 'NOTIFICATION_READ' && l.entityId === notif.id);
      expect(readLog).toBeDefined();

      const triggerLog = logs.find((l) => l.action === 'ALERT_TRIGGERED');
      expect(triggerLog).toBeDefined();
    });
  });
});
