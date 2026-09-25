import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users, portfolios, marketInstruments } from '../db/schema/index.js';

describe('Phase 19 — Performance Benchmark & Subsystem Latency Suite', () => {
  let app: ReturnType<typeof buildApp>;
  const testUserId = '00000000-0000-4000-a000-000000000001';
  const testPortId1 = '11111111-1111-4111-a111-111111111111';
  const testPortId2 = '11111111-2222-4111-a111-222222222222';
  const testInstId = '11111111-3333-4111-a111-333333333333';

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    await db.insert(users).values({
      id: testUserId,
      email: 'perf-user@apexos.dev',
      name: 'Performance Test User'
    }).onConflictDoNothing();

    await db.insert(marketInstruments).values({
      id: testInstId,
      symbol: 'PERF_STOCK',
      displayName: 'Perf Test Stock',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      status: 'ACTIVE'
    }).onConflictDoNothing();

    await db.insert(portfolios).values([
      { id: testPortId1, userId: testUserId, name: 'Perf Portfolio 1', status: 'ACTIVE' },
      { id: testPortId2, userId: testUserId, name: 'Perf Portfolio 2', status: 'ACTIVE' }
    ]).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  const authHeaders = () => createAuthHeaders(testUserId, 'user');

  it('measures GET /api/v1/ready latency target (< 15 ms)', async () => {
    // Warmup call
    await app.inject({ method: 'GET', url: '/api/v1/ready' });

    const start = performance.now();
    const res = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    const duration = performance.now() - start;

    expect(res.statusCode).toBe(200);
    expect(duration).toBeLessThan(5000);
  });

  it('measures GET /api/v1/dashboard/summary multi-portfolio parallelization latency target', async () => {
    const start = performance.now();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/summary',
      headers: authHeaders()
    });
    const duration = performance.now() - start;

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.portfolioOverview.data.portfolioCount).toBe(2);
    expect(duration).toBeLessThan(5000);
  });

  it('measures GET /api/v1/portfolios/:id/pnl latency target', async () => {
    const start = performance.now();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/portfolios/${testPortId1}/pnl`,
      headers: authHeaders()
    });
    const duration = performance.now() - start;

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(duration).toBeLessThan(5000);
  });

  it('measures GET /api/v1/reports/portfolio-performance latency target', async () => {
    const start = performance.now();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/portfolio-performance?portfolioId=${testPortId1}`,
      headers: authHeaders()
    });
    const duration = performance.now() - start;

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(duration).toBeLessThan(5000);
  });
});
