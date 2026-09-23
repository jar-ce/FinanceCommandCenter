import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DrizzleAlertRepository } from '../infrastructure/repositories/DrizzleAlertRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { AlertService } from '../domain/services/AlertService.js';
import { AlertEvaluationService } from '../domain/services/AlertEvaluationService.js';
import { PnlService } from '../domain/services/PnlService.js';

import { requireAuthentication, resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

const alertRepo = new DrizzleAlertRepository();
const marketRepo = new DrizzleMarketRepository();
const portfolioRepo = new DrizzlePortfolioRepository();
const ipoRepo = new DrizzleIPORepository();
const auditLogRepo = new DrizzleAuditLogRepository();
const pnlService = new PnlService(portfolioRepo, marketRepo);

const alertService = new AlertService(alertRepo, marketRepo, portfolioRepo, ipoRepo, auditLogRepo);
const evaluationService = new AlertEvaluationService(alertRepo, marketRepo, ipoRepo, pnlService, auditLogRepo);

const createAlertSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  alertType: z.enum([
    'PRICE_ABOVE',
    'PRICE_BELOW',
    'PRICE_CHANGE_PERCENT_ABOVE',
    'PRICE_CHANGE_PERCENT_BELOW',
    'VOLUME_ABOVE',
    'PORTFOLIO_TOTAL_PNL_ABOVE',
    'PORTFOLIO_TOTAL_PNL_BELOW',
    'PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE',
    'PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW',
    'IPO_OPENING',
    'IPO_CLOSING_SOON'
  ]),
  targetType: z.enum(['MARKET_INSTRUMENT', 'PORTFOLIO', 'IPO']),
  targetId: z.string().uuid(),
  conditionOperator: z.enum(['GTE', 'LTE', 'EQ', 'STATE_CHANGE']).optional(),
  thresholdValue: z.string().optional(),
  thresholdPercent: z.string().optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional()
});

const updateAlertSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  thresholdValue: z.string().optional(),
  thresholdPercent: z.string().optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional()
});

export const alertRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', requireAuthentication);

  // List user alert rules
  app.get('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { status } = request.query as { status?: string };
    const rules = await alertService.getUserAlertRules(userId, status as any);
    return reply.send({ success: true, data: rules, timestamp: new Date().toISOString() });
  });

  // Evaluate all active rules for current user
  app.post('/evaluate-all', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const results = await evaluationService.evaluateAllUserRules(userId);
    return reply.send({ success: true, data: results, timestamp: new Date().toISOString() });
  });

  // Create alert rule
  app.post('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const parseResult = createAlertSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid alert rule payload', details: parseResult.error.format() },
        timestamp: new Date().toISOString()
      });
    }

    try {
      const rule = await alertService.createAlertRule(userId, parseResult.data);
      return reply.status(201).send({ success: true, data: rule, timestamp: new Date().toISOString() });
    } catch (err: any) {
      if (err.message === 'TARGET_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'TARGET_NOT_FOUND', message: 'Target entity not found or unauthorized' },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'THRESHOLD_REQUIRED_FOR_NUMERIC_ALERT') {
        return reply.status(400).send({
          success: false,
          error: { code: 'THRESHOLD_REQUIRED', message: 'Threshold value or percentage is required for numeric alert types' },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // Get single alert rule
  app.get('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    const rule = await alertService.getAlertRuleById(id, userId);
    if (!rule) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ALERT_RULE_NOT_FOUND', message: 'Alert rule not found' },
        timestamp: new Date().toISOString()
      });
    }

    return reply.send({ success: true, data: rule, timestamp: new Date().toISOString() });
  });

  // Update alert rule
  app.patch('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    const parseResult = updateAlertSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload', details: parseResult.error.format() },
        timestamp: new Date().toISOString()
      });
    }

    try {
      const updated = await alertService.updateAlertRule(id, userId, parseResult.data);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err: any) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ALERT_RULE_NOT_FOUND', message: 'Alert rule not found' },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Pause alert rule
  app.post('/:id/pause', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const updated = await alertService.pauseAlertRule(id, userId);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ALERT_RULE_NOT_FOUND', message: 'Alert rule not found' },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Resume alert rule
  app.post('/:id/resume', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const updated = await alertService.resumeAlertRule(id, userId);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ALERT_RULE_NOT_FOUND', message: 'Alert rule not found' },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Archive alert rule
  app.post('/:id/archive', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const updated = await alertService.archiveAlertRule(id, userId);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ALERT_RULE_NOT_FOUND', message: 'Alert rule not found' },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Evaluate single rule
  app.post('/:id/evaluate', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    const result = await evaluationService.evaluateRule(id, userId);
    return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
  });
};
