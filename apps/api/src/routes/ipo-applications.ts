import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import {
  IPOApplicationService,
  createIPOApplicationSchema,
  updateIPOApplicationSchema,
  transitionStatusSchema
} from '../domain/services/IPOApplicationService.js';

import { requireAuthentication } from '../infrastructure/auth/authMiddleware.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  ipoId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional()
});

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

export async function ipoApplicationsRoutes(fastify: FastifyInstance) {
  const appRepo = new DrizzleIPOApplicationRepository();
  const ipoRepo = new DrizzleIPORepository();
  const accountRepo = new DrizzleKhataAccountRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const appService = new IPOApplicationService(appRepo, ipoRepo, accountRepo, auditRepo);

  // Fail-closed Principal Identity preHandler Hook
  fastify.addHook('preHandler', requireAuthentication);

  // GET /api/v1/ipo/applications - List user's IPO applications
  fastify.get('/', async (request, reply) => {
    const userId = (request as any).userId;
    const query = listQuerySchema.parse(request.query || {});
    const result = await appService.listApplications({
      userId,
      search: query.search,
      status: query.status,
      ipoId: query.ipoId,
      accountId: query.accountId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page: query.page,
      limit: query.limit
    });

    return reply.send({
      success: true,
      data: result.applications,
      summary: result.summary,
      meta: result.meta
    });
  });

  // POST /api/v1/ipo/applications - Create IPO application
  fastify.post('/', async (request, reply) => {
    const userId = (request as any).userId;
    const body = createIPOApplicationSchema.parse(request.body);

    try {
      const created = await appService.createApplication(userId, body);
      return reply.status(201).send({
        success: true,
        data: created
      });
    } catch (err: any) {
      if (err.message.startsWith('IPO_NOT_FOUND')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Referenced IPO master record not found.' }
        });
      }
      if (err.message.startsWith('ACCOUNT_NOT_FOUND')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Application account not found or access denied.' }
        });
      }
      if (err.message.startsWith('ACCOUNT_ARCHIVED')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'ACCOUNT_ARCHIVED', message: 'Cannot use an archived account for an IPO application.' }
        });
      }
      if (err.message.startsWith('INVALID_AMOUNT') || err.message.startsWith('MISSING_AMOUNT')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.message }
        });
      }
      throw err;
    }
  });

  // GET /api/v1/ipo/applications/:id - Get detailed IPO application
  fastify.get('/:id', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = uuidParamSchema.parse(request.params);
    const application = await appService.getApplication(id, userId);

    if (!application) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IPO application not found.' }
      });
    }

    return reply.send({
      success: true,
      data: application
    });
  });

  // PATCH /api/v1/ipo/applications/:id - Update editable fields (notes, paymentReference)
  fastify.patch('/:id', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = uuidParamSchema.parse(request.params);
    const body = updateIPOApplicationSchema.parse(request.body);

    try {
      const updated = await appService.updateApplication(id, userId, body);
      return reply.send({
        success: true,
        data: updated
      });
    } catch (err: any) {
      if (err.message === 'APPLICATION_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'IPO application not found.' }
        });
      }
      throw err;
    }
  });

  // POST /api/v1/ipo/applications/:id/status - Transition application status
  fastify.post('/:id/status', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = uuidParamSchema.parse(request.params);
    const body = transitionStatusSchema.parse(request.body);

    try {
      const updated = await appService.transitionStatus(id, userId, body.status);
      return reply.send({
        success: true,
        data: updated
      });
    } catch (err: any) {
      if (err.message === 'APPLICATION_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'IPO application not found.' }
        });
      }
      if (err.message.startsWith('INVALID_STATUS_TRANSITION')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: err.message }
        });
      }
      throw err;
    }
  });

  // POST /api/v1/ipo/applications/:id/cancel - Dedicated application cancellation endpoint
  fastify.post('/:id/cancel', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = uuidParamSchema.parse(request.params);

    try {
      const updated = await appService.transitionStatus(id, userId, 'CANCELLED');
      return reply.send({
        success: true,
        data: updated
      });
    } catch (err: any) {
      if (err.message === 'APPLICATION_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'IPO application not found.' }
        });
      }
      if (err.message.startsWith('INVALID_STATUS_TRANSITION')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: err.message }
        });
      }
      throw err;
    }
  });
}
