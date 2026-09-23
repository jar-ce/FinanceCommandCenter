import pino from 'pino';
import { env } from '../../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'authorization',
      'cookie',
      'pan',
      'panNumber',
      'applicationNumber',
      'dbPassword'
    ],
    censor: '[REDACTED]'
  }
});
