import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import { sql } from 'drizzle-orm';
import type { ApiResponse } from '@finance-command-center/shared-types';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // GET /health - Liveness Probe
  fastify.get('/health', async (_req, reply) => {
    const response: ApiResponse<{ status: string; uptime: number }> = {
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    };
    return reply.status(200).send(response);
  });

  // GET /ready - Readiness Probe (verifies PostgreSQL database connection)
  fastify.get('/ready', async (_req, reply) => {
    try {
      const db = await getDb();
      await db.execute(sql`SELECT 1`);
      
      const response: ApiResponse<{ status: string; database: string }> = {
        success: true,
        data: {
          status: 'ready',
          database: 'connected'
        },
        timestamp: new Date().toISOString()
      };
      return reply.status(200).send(response);
    } catch (error) {
      fastify.log.error({ err: error }, 'Readiness check failed - Database unavailable');
      return reply.status(503).send({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database readiness check failed'
        },
        timestamp: new Date().toISOString()
      });
    }
  });
};
