import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authService } from '../domain/services/AuthService.js';
import { logger } from '../infrastructure/logging/logger.js';
import { resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

const loginBodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin', 'system']).default('user')
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(10)
});

const revokeBodySchema = z.object({
  token: z.string().min(10)
});

const onboardBodySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'system']).default('user')
});

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // POST /api/v1/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parseResult = loginBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login parameters',
          details: parseResult.error.issues
        },
        timestamp: new Date().toISOString()
      });
    }

    const { userId, role } = parseResult.data;
    logger.info({ userId, role }, 'Authentication token pair issued for user');

    const result = await authService.login(userId, role);
    return reply.status(200).send({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parseResult = refreshBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid refresh parameters',
          details: parseResult.error.issues
        },
        timestamp: new Date().toISOString()
      });
    }

    try {
      const result = await authService.refresh(parseResult.data.refreshToken);
      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      logger.warn({ message: err?.message }, 'Authentication token refresh failed');
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token refresh failed or token revoked'
        },
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/v1/auth/revoke
  fastify.post('/revoke', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parseResult = revokeBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid revoke parameters',
          details: parseResult.error.issues
        },
        timestamp: new Date().toISOString()
      });
    }

    await authService.revoke(parseResult.data.token);
    logger.info('Authentication token revoked successfully');

    return reply.status(200).send({
      success: true,
      data: { revoked: true },
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/auth/onboard
  fastify.post('/onboard', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    try {
      resolveDevelopmentIdentity(request);
      if ((request as any).userRole !== 'admin' && (request as any).userRole !== 'system') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Administrative authorization required for user onboarding'
          },
          timestamp: new Date().toISOString()
        });
      }

      const parseResult = onboardBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid onboarding parameters',
            details: parseResult.error.issues
          },
          timestamp: new Date().toISOString()
        });
      }

      const { userId, email, role } = parseResult.data;
      logger.info({ userId, email, role }, 'User onboarded successfully');

      return reply.status(201).send({
        success: true,
        data: {
          userId,
          email,
          role,
          status: 'ACTIVE'
        },
        timestamp: new Date().toISOString()
      });
    } catch {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for administrative onboarding'
        },
        timestamp: new Date().toISOString()
      });
    }
  });
};
