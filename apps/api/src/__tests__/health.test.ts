import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { closeDb } from '../db/index.js';

describe('Fastify Infrastructure Health & Readiness Routes', () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
    await closeDb();
  });

  it('GET /api/v1/health returns 200 process liveness', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/ready returns 200 when database connection is healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ready'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ready');
    expect(body.data.database).toBe('connected');
  });
});
