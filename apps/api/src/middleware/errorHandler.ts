import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../infrastructure/logging/logger.js';
import type { ApiErrorResponse } from '@finance-command-center/shared-types';

export function errorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply): void {
  const requestId = req.id || 'unknown';

  // Handle Zod Request Validation Errors
  if (error instanceof ZodError) {
    logger.warn({ requestId, issues: error.issues }, 'Request validation failed');
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.issues
      },
      timestamp: new Date().toISOString()
    };
    reply.status(400).send(response);
    return;
  }

  // Handle Custom HTTP Errors (e.g. 404, 400, 401, 403)
  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;

  if (statusCode >= 500) {
    logger.error({ requestId, err: error.message, stack: error.stack }, 'Internal server error');
  } else {
    logger.warn({ requestId, err: error.message }, 'Client error occurred');
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
      message: statusCode === 500 ? 'An unexpected server error occurred' : error.message
    },
    timestamp: new Date().toISOString()
  };

  reply.status(statusCode).send(response);
}
