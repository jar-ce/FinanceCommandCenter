import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRoutes } from './routes/index.js';
import { env } from './config/env.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false, // Managed by custom Pino logger module
    requestIdHeader: 'x-request-id'
  }).withTypeProvider<ZodTypeProvider>();

  // Configure Zod Validation & Serializer Compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register Infrastructure Plugins
  app.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      // In development/test or server-to-server requests without origin header
      if (!origin) return cb(null, true);
      
      const allowedOrigin = env.CORS_ORIGIN;
      if (origin === allowedOrigin || (env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:'))) {
        return cb(null, true);
      }
      return cb(new Error('CORS_NOT_ALLOWED'), false);
    },
    credentials: true
  });

  // Security Headers Hook (SEC-02)
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Content-Security-Policy', "default-src 'self'");
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Centralized Error Handler
  app.setErrorHandler(errorHandler);

  // Register API Routes under /api/v1
  app.register(apiRoutes, { prefix: '/api/v1' });

  return app as unknown as FastifyInstance;
}
