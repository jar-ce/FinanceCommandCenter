import { FastifyInstance } from 'fastify';
import { DrizzlePortfolioRepository } from '../infrastructure/repositories/DrizzlePortfolioRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { PnlService } from '../domain/services/PnlService.js';

import { requireAuthentication, resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

export async function pnlRoutes(fastify: FastifyInstance) {
  const portfolioRepo = new DrizzlePortfolioRepository();
  const marketRepo = new DrizzleMarketRepository();
  const pnlService = new PnlService(portfolioRepo, marketRepo);

  // Identity guard hook
  fastify.addHook('preHandler', requireAuthentication);

  // GET /api/v1/portfolios/:id/pnl - Portfolio P&L Summary Overview
  fastify.get('/:id/pnl', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const summary = await pnlService.getPnLSummary(id, userId);
      return reply.send({
        success: true,
        data: summary,
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

  // GET /api/v1/portfolios/:id/pnl/holdings - Holding-level P&L details
  fastify.get('/:id/pnl/holdings', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const holdings = await pnlService.getHoldingPnL(id, userId);
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

  // GET /api/v1/portfolios/:id/pnl/realized - Realized P&L Transaction Ledger (with date filters)
  fastify.get('/:id/pnl/realized', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };
    const query = request.query as { fromDate?: string; toDate?: string };

    try {
      const realized = await pnlService.getRealizedPnL(id, userId, query.fromDate, query.toDate);
      return reply.send({
        success: true,
        data: realized,
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

  // GET /api/v1/portfolios/:id/pnl/performance - Return metrics summary
  fastify.get('/:id/pnl/performance', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const summary = await pnlService.getPnLSummary(id, userId);
      return reply.send({
        success: true,
        data: {
          portfolioId: summary.portfolioId,
          returnMetrics: summary.returnMetrics,
          valuationCoverage: summary.valuationCoverage,
          asOf: summary.asOf
        },
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
}
