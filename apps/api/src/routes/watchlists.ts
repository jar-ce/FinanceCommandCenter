import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzleWatchlistRepository } from '../infrastructure/repositories/DrizzleWatchlistRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { WatchlistService } from '../domain/services/WatchlistService.js';

import { requireAuthentication, resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

const createWatchlistSchema = z.object({
  name: z.string().min(1, 'Watchlist name is required.').max(255),
  description: z.string().max(1000).optional()
});

const updateWatchlistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional()
});

const addWatchlistItemSchema = z.object({
  instrumentId: z.string().uuid('Invalid canonical instrument ID format.')
});

const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().uuid())
});

export async function watchlistRoutes(fastify: FastifyInstance) {
  const watchlistRepo = new DrizzleWatchlistRepository();
  const marketRepo = new DrizzleMarketRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const watchlistService = new WatchlistService(watchlistRepo, marketRepo, auditRepo);

  // Identity guard hook
  fastify.addHook('preHandler', requireAuthentication);

  // GET /api/v1/watchlists - List current user's watchlists
  fastify.get('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const includeArchived = (request.query as any)?.includeArchived === 'true';
    const lists = await watchlistService.getUserWatchlists(userId, includeArchived);

    return reply.send({
      success: true,
      data: lists,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/watchlists - Create a new watchlist
  fastify.get('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const details = await watchlistService.getWatchlistDetails(id, userId);
      return reply.send({
        success: true,
        data: details,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  fastify.post('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const body = createWatchlistSchema.parse(request.body);

    const created = await watchlistService.createWatchlist(userId, body.name, body.description);

    return reply.status(201).send({
      success: true,
      data: created,
      timestamp: new Date().toISOString()
    });
  });

  // PATCH /api/v1/watchlists/:id - Rename / update watchlist
  fastify.patch('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };
    const body = updateWatchlistSchema.parse(request.body);

    try {
      const updated = await watchlistService.updateWatchlist(id, userId, body);
      return reply.send({
        success: true,
        data: updated,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // POST /api/v1/watchlists/:id/archive - Archive watchlist
  fastify.post('/:id/archive', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const archived = await watchlistService.archiveWatchlist(id, userId);
      return reply.send({
        success: true,
        data: archived,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // POST /api/v1/watchlists/:id/restore - Restore archived watchlist
  fastify.post('/:id/restore', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const restored = await watchlistService.restoreWatchlist(id, userId);
      return reply.send({
        success: true,
        data: restored,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // POST /api/v1/watchlists/:id/items - Add instrument to watchlist
  fastify.post('/:id/items', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };
    const body = addWatchlistItemSchema.parse(request.body);

    try {
      const addedItem = await watchlistService.addItem(id, body.instrumentId, userId);
      return reply.status(201).send({
        success: true,
        data: addedItem,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
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
      if (err.message === 'DUPLICATE_WATCHLIST_ITEM') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DUPLICATE_ITEM',
            message: 'Instrument is already present in this watchlist.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'ARCHIVED_WATCHLIST_MUTATION_MUTED') {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'ARCHIVED_WATCHLIST',
            message: 'Cannot modify items in an archived watchlist. Restore it first.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // DELETE /api/v1/watchlists/:id/items/:instrumentId - Remove instrument from watchlist
  fastify.delete('/:id/items/:instrumentId', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id, instrumentId } = request.params as { id: string; instrumentId: string };

    try {
      await watchlistService.removeItem(id, instrumentId, userId);
      return reply.send({
        success: true,
        data: { message: 'Instrument removed from watchlist successfully.' },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'WATCHLIST_ITEM_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Instrument membership not found in this watchlist.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'ARCHIVED_WATCHLIST_MUTATION_MUTED') {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'ARCHIVED_WATCHLIST',
            message: 'Cannot modify items in an archived watchlist. Restore it first.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // PATCH /api/v1/watchlists/:id/reorder - Reorder watchlist items
  fastify.patch('/:id/reorder', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };
    const body = reorderItemsSchema.parse(request.body);

    try {
      await watchlistService.reorderItems(id, body.itemIds, userId);
      return reply.send({
        success: true,
        data: { message: 'Watchlist items reordered successfully.' },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err.message === 'WATCHLIST_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Watchlist not found or access denied.'
          },
          timestamp: new Date().toISOString()
        });
      }
      if (err.message === 'ARCHIVED_WATCHLIST_MUTATION_MUTED') {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'ARCHIVED_WATCHLIST',
            message: 'Cannot modify items in an archived watchlist.'
          },
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
  });
}
