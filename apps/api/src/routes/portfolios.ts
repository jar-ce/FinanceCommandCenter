import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { PortfolioService } from '../domain/services/PortfolioService.js';

import { requireAuthentication, resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

const createPortfolioSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required.').max(255),
  description: z.string().max(1000).optional()
});

const updatePortfolioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional()
});

const createTransactionSchema = z.object({
  instrumentId: z.string().uuid('Invalid canonical instrument ID format.'),
  transactionType: z.enum(['BUY', 'SELL']),
  transactionDate: z.string().min(1, 'Transaction date is required.'),
  quantity: z.string().min(1, 'Quantity is required.'),
  price: z.string().min(1, 'Price is required.'),
  charges: z.string().optional(),
  taxes: z.string().optional(),
  externalReference: z.string().max(255).optional(),
  notes: z.string().max(1000).optional()
});

export async function portfolioRoutes(fastify: FastifyInstance) {
  const portfolioRepo = new DrizzlePortfolioRepository();
  const marketRepo = new DrizzleMarketRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const portfolioService = new PortfolioService(portfolioRepo, marketRepo, auditRepo);

  // Identity guard hook
  fastify.addHook('preHandler', requireAuthentication);

  // GET /api/v1/portfolios - List current user's portfolios
  fastify.get('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const includeArchived = (request.query as any)?.includeArchived === 'true';
    const lists = await portfolioService.getUserPortfolios(userId, includeArchived);

    return reply.send({
      success: true,
      data: lists,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/portfolios - Create a new portfolio
  fastify.post('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const body = createPortfolioSchema.parse(request.body);

    const created = await portfolioService.createPortfolio(userId, body.name, body.description);

    return reply.status(201).send({
      success: true,
      data: created,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/portfolios/:id - Get portfolio overview & holdings
  fastify.get('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const details = await portfolioService.getPortfolioDetails(id, userId);
      return reply.send({
        success: true,
        data: details,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // PATCH /api/v1/portfolios/:id - Rename / update portfolio
  fastify.patch('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };
    const body = updatePortfolioSchema.parse(request.body);

    try {
      const updated = await portfolioService.updatePortfolio(id, userId, body);
      return reply.send({
        success: true,
        data: updated,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // POST /api/v1/portfolios/:id/archive - Archive portfolio
  fastify.post('/:id/archive', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const archived = await portfolioService.archivePortfolio(id, userId);
      return reply.send({
        success: true,
        data: archived,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // POST /api/v1/portfolios/:id/restore - Restore archived portfolio
  fastify.post('/:id/restore', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const restored = await portfolioService.restorePortfolio(id, userId);
      return reply.send({
        success: true,
        data: restored,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // GET /api/v1/portfolios/:id/holdings - Get active holdings
  fastify.get('/:id/holdings', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const holdings = await portfolioService.getPortfolioHoldings(id, userId);
      return reply.send({
        success: true,
        data: holdings,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // GET /api/v1/portfolios/:id/transactions - List transaction history
  fastify.get('/:id/transactions', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const history = await portfolioService.getTransactionHistory(id, userId);
      return reply.send({
        success: true,
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // POST /api/v1/portfolios/:id/transactions - Record BUY/SELL transaction
  fastify.post('/:id/transactions', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };
    const body = createTransactionSchema.parse(request.body);

    try {
      const addedTx = await portfolioService.addTransaction(id, userId, body);
      return reply.status(201).send({
        success: true,
        data: addedTx,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'PORTFOLIO_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Portfolio not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'INSTRUMENT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'INSTRUMENT_NOT_FOUND',
            message: 'Target market instrument does not exist.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'OVERSELL_ERROR') {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'OVERSELL_ERROR',
            message: 'SELL quantity exceeds current available holding quantity.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'ARCHIVED_PORTFOLIO_MUTATION_MUTED') {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'ARCHIVED_PORTFOLIO',
            message: 'Cannot record transactions in an archived portfolio. Restore it first.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'FUTURE_TRANSACTION_DATE') {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'FUTURE_TRANSACTION_DATE',
            message: 'Transaction date cannot be in the future.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (
        err.message === 'INVALID_QUANTITY' ||
        err.message === 'INVALID_PRICE' ||
        err.message === 'INVALID_FEES' ||
        err.message === 'INVALID_TOTAL_AMOUNT' ||
        err.message === 'INVALID_TRANSACTION_DATE' ||
        err.message === 'INVALID_TRANSACTION_TYPE'
      ) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'INVALID_FINANCIAL_RECORD',
            message: `Invalid transaction parameters: ${err.message}`
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });
}
