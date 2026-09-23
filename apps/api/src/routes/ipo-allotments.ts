import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzleIPOAllotmentRepository } from '../infrastructure/repositories/DrizzleIPOAllotmentRepository.js';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { DevelopmentIPOAllotmentProvider } from '../infrastructure/providers/DevelopmentIPOAllotmentProvider.js';
import { IPOAllotmentService, manualVerifyAllotmentSchema } from '../domain/services/IPOAllotmentService.js';

import { requireAuthentication } from '../infrastructure/auth/authMiddleware.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['UNKNOWN', 'PENDING', 'ALLOTTED', 'PARTIALLY_ALLOTTED', 'NOT_ALLOTTED', 'REJECTED']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'STALE', 'UNAVAILABLE', 'MANUAL_REQUIRED']).optional(),
  ipoId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  page: z.string().regex(/^\d+$/).transform((val) => parseInt(val, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform((val) => parseInt(val, 10)).optional()
});

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

const appUuidParamSchema = z.object({
  applicationId: z.string().uuid()
});

export async function ipoAllotmentRoutes(fastify: FastifyInstance) {
  const allotmentRepo = new DrizzleIPOAllotmentRepository();
  const appRepo = new DrizzleIPOApplicationRepository();
  const ipoRepo = new DrizzleIPORepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const provider = new DevelopmentIPOAllotmentProvider();
  const allotmentService = new IPOAllotmentService(allotmentRepo, appRepo, ipoRepo, provider, auditRepo);

  // Fail-closed Principal Identity preHandler Hook
  fastify.addHook('preHandler', requireAuthentication);

  // GET /api/v1/ipo/allotments - List user's IPO allotment results
  fastify.get('/', async (request, reply) => {
    const userId = (request as any).userId;
    const query = listQuerySchema.parse(request.query || {});
    const result = await allotmentService.listAllotments({
      userId,
      search: query.search,
      status: query.status,
      verificationStatus: query.verificationStatus,
      ipoId: query.ipoId,
      applicationId: query.applicationId,
      page: query.page,
      limit: query.limit
    });

    return reply.send({
      success: true,
      data: result.allotments,
      summary: result.summary,
      meta: result.meta
    });
  });

  // GET /api/v1/ipo/allotments/:id - Get single detailed allotment record
  fastify.get('/:id', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = uuidParamSchema.parse(request.params);
    const allotment = await allotmentService.getAllotment(id, userId);

    if (!allotment) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IPO allotment record not found or access denied.' }
      });
    }

    return reply.send({
      success: true,
      data: allotment
    });
  });

  // POST /api/v1/ipo/applications/:applicationId/allotment/check - Check allotment status
  fastify.post('/check/:applicationId', async (request, reply) => {
    const userId = (request as any).userId;
    const { applicationId } = appUuidParamSchema.parse(request.params);

    try {
      const result = await allotmentService.checkAllotment(applicationId, userId);
      return reply.send({
        success: true,
        data: result
      });
    } catch (err: any) {
      if (err.message.startsWith('APPLICATION_NOT_FOUND')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'IPO application record not found or access denied.' }
        });
      }
      if (err.message.startsWith('INVALID_QUANTITY') || err.message.startsWith('INVALID_ALLOTMENT_STATUS')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.message }
        });
      }
      throw err;
    }
  });

  // POST /api/v1/ipo/applications/:applicationId/allotment/verify - Manual verification
  fastify.post('/verify/:applicationId', async (request, reply) => {
    const userId = (request as any).userId;
    const { applicationId } = appUuidParamSchema.parse(request.params);
    const body = manualVerifyAllotmentSchema.parse(request.body);

    try {
      const result = await allotmentService.recordManualVerification(applicationId, userId, body);
      return reply.send({
        success: true,
        data: result
      });
    } catch (err: any) {
      if (err.message.startsWith('APPLICATION_NOT_FOUND')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'IPO application record not found or access denied.' }
        });
      }
      if (err.message.startsWith('INVALID_QUANTITY') || err.message.startsWith('INVALID_ALLOTMENT_STATUS')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.message }
        });
      }
      throw err;
    }
  });
}
