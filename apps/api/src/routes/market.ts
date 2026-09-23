import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DevelopmentMarketDataProvider } from '../infrastructure/providers/DevelopmentMarketDataProvider.js';
import { MarketDataService } from '../domain/services/MarketDataService.js';
import { resolveAuthenticatedPrincipal } from '../infrastructure/auth/authMiddleware.js';

const searchInstrumentsQuerySchema = z.object({
  query: z.string().optional(),
  exchange: z.enum(['NSE', 'BSE', 'NASDAQ', 'NYSE', 'MUTUAL_FUND_IN', 'OTHER']).optional(),
  securityType: z.enum(['EQUITY', 'ETF', 'MUTUAL_FUND', 'INDEX', 'BOND', 'DERIVATIVE', 'OTHER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELISTED']).optional(),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).optional()
});

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

const historyQuerySchema = z.object({
  interval: z.string().default('1d'),
  range: z.string().optional()
});

const registerInstrumentSchema = z.object({
  symbol: z.string().min(1),
  displayName: z.string().min(1),
  exchange: z.enum(['NSE', 'BSE', 'NASDAQ', 'NYSE', 'MUTUAL_FUND_IN', 'OTHER']).default('NSE'),
  market: z.string().default('IN'),
  securityType: z.enum(['EQUITY', 'ETF', 'MUTUAL_FUND', 'INDEX', 'BOND', 'DERIVATIVE', 'OTHER']).default('EQUITY'),
  currency: z.string().default('INR'),
  provider: z.string().default('DEVELOPMENT_STUB'),
  providerInstrumentId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELISTED']).default('ACTIVE')
});

export async function marketRoutes(fastify: FastifyInstance) {
  const repo = new DrizzleMarketRepository();
  const provider = new DevelopmentMarketDataProvider();
  const marketService = new MarketDataService(repo, provider);

  // GET /api/v1/market/instruments - Search or list securities master
  fastify.get('/instruments', async (request, reply) => {
    const query = searchInstrumentsQuerySchema.parse(request.query || {});
    const result = await marketService.searchInstruments({
      query: query.query,
      exchange: query.exchange as any,
      securityType: query.securityType as any,
      status: query.status as any,
      page: query.page,
      limit: query.limit
    });

    return reply.send({
      success: true,
      data: result.instruments,
      meta: {
        totalCount: result.totalCount,
        page: query.page || 1,
        limit: query.limit || 50
      }
    });
  });

  // GET /api/v1/market/instruments/:id - Get single instrument details by UUID
  fastify.get('/instruments/:id', async (request, reply) => {
    const { id } = uuidParamSchema.parse(request.params);
    const instrument = await marketService.getInstrumentById(id);

    if (!instrument) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Market instrument not found.' }
      });
    }

    return reply.send({
      success: true,
      data: instrument
    });
  });

  // GET /api/v1/market/instruments/:id/quote - Get canonical quote observation
  fastify.get('/instruments/:id/quote', async (request, reply) => {
    const { id } = uuidParamSchema.parse(request.params);
    const quote = await marketService.getQuote(id);

    if (!quote) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Market instrument not found.' }
      });
    }

    return reply.send({
      success: true,
      data: quote
    });
  });

  // GET /api/v1/market/instruments/:id/history - Get historical OHLC candles
  fastify.get('/instruments/:id/history', async (request, reply) => {
    const { id } = uuidParamSchema.parse(request.params);
    const query = historyQuerySchema.parse(request.query || {});
    const candles = await marketService.getHistoricalCandles(id, query.interval, query.range);

    return reply.send({
      success: true,
      data: candles
    });
  });

  // GET /api/v1/market/status - Get market system / provider status
  fastify.get('/status', async (request, reply) => {
    const exchange = (request.query as any)?.exchange || 'NSE';
    const status = await marketService.getMarketStatus(exchange);

    return reply.send({
      success: true,
      data: status
    });
  });

  // POST /api/v1/market/instruments - Protected mutation endpoint for instrument registration (Admin/System Only - SEC-04)
  fastify.post('/instruments', async (request, reply) => {
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
          message: 'Admin or system privileges required for security master mutation.'
        }
      });
    }

    const body = registerInstrumentSchema.parse(request.body);
    const registered = await marketService.registerInstrument(body as any);

    return reply.status(201).send({
      success: true,
      data: registered
    });
  });
}
