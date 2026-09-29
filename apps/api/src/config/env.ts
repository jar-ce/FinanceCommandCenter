import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file if available
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/finance_command_center'),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('dev-jwt-secret-min-16-characters-long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

export type EnvConfig = z.infer<typeof envSchema>;

export const DEFAULT_DEV_SECRETS = [
  'dev-jwt-secret-min-16-characters-long',
  'super-secret-jwt-key-change-in-production'
];

export function validateEnvConfig(rawEnv: Record<string, any> = process.env): EnvConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    console.error('❌ CRITICAL: Environment variable validation failed!');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }

  const parsed = result.data;
  if (parsed.NODE_ENV === 'production') {
    if (DEFAULT_DEV_SECRETS.includes(parsed.JWT_SECRET)) {
      throw new Error('FATAL: Default development JWT_SECRET is rejected in production. Provide an explicit secret.');
    }
    if (!parsed.REDIS_URL || parsed.REDIS_URL.trim() === '') {
      throw new Error('FATAL: REDIS_URL environment variable is required for shared token revocation storage in production.');
    }
  }

  return parsed;
}

export const env = validateEnvConfig();

