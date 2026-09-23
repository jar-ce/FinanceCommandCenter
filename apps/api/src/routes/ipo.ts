import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DevelopmentIPOProvider } from '../infrastructure/providers/DevelopmentIPOProvider.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { IPOService } from '../domain/services/IPOService.js';
import { resolveAuthenticatedPrincipal } from '../infrastructure/auth/authMiddleware.js';

const ipoQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['UPCOMING', 'OPEN', 'CLOSED', 'LISTED', 'CANCELLED', 'POSTPONED']).optional(),
  exchange: z.enum(['NSE', 'BSE', 'NSE_BSE', 'UNKNOWN']).optional(),
  issueType: z.enum(['MAINBOARD', 'SME', 'UNKNOWN']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional()
});

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

export async function ipoRoutes(fastify: FastifyInstance) {
  const ipoRepo = new DrizzleIPORepository();
  const provider = new DevelopmentIPOProvider();
  const auditRepo = new DrizzleAuditLogRepository();
  const ipoService = new IPOService(ipoRepo, provider, auditRepo);

  // GET /api/v1/ipo - List canonical IPO master records with filters & search
  fastify.get('/', async (request, reply) => {
    const query = ipoQuerySchema.parse(request.query || {});
    const result = await ipoService.listIPOs({
      search: query.search,
      status: query.status,
      exchange: query.exchange,
      issueType: query.issueType,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page: query.page,
      limit: query.limit
    });

    return reply.send({
      success: true,
      data: result.ipos,
      pipeline: result.pipeline,
      meta: result.meta
    });
  });

  // GET /api/v1/ipo/:id - Get detailed canonical IPO master record
  fastify.get('/:id', async (request, reply) => {
    const { id } = uuidParamSchema.parse(request.params);
    const ipo = await ipoService.getIPO(id);
    if (!ipo) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IPO master record not found.' }
      });
    }

    return reply.send({
      success: true,
      data: ipo
    });
  });

  // POST /api/v1/ipo/sync - Trigger IPO provider synchronization (Admin/System Only - SEC-07)
  fastify.post('/sync', async (request, reply) => {
    let principal;
    try {
      principal = resolveAuthenticatedPrincipal(request);
    } catch {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token missing, invalid, or forged. Provide valid Bearer token or signed credentials.'
        }
      });
    }

    if (principal.role !== 'admin' && principal.role !== 'system') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin or system privileges required for IPO master synchronization.'
        }
      });
    }

    const syncResult = await ipoService.syncIPOs(undefined, principal.userId);
    if (!syncResult.success) {
      return reply.status(502).send({
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: syncResult.error || 'IPO provider synchronization failed'
        },
        data: syncResult
      });
    }

    return reply.send({
      success: true,
      data: syncResult
    });
  });
}
