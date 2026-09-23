import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DevelopmentIPOProvider } from '../infrastructure/providers/DevelopmentIPOProvider.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { IPOService } from '../domain/services/IPOService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';
import { IIPODataProvider } from '../domain/providers/IIPODataProvider.js';
import { IPOProviderDTO } from '../domain/providers/IPOProviderDTO.js';

class TestFixtureIPOProvider implements IIPODataProvider {
  readonly providerId = 'TEST_FIXTURE';
  readonly providerName = 'Test Data Fixture Provider';

  constructor(private fixtures: IPOProviderDTO[], private shouldFail = false) {}

  setFixtures(fixtures: IPOProviderDTO[]) {
    this.fixtures = fixtures;
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  async fetchIPOs(): Promise<IPOProviderDTO[]> {
    if (this.shouldFail) {
      throw new Error('PROVIDER_NETWORK_TIMEOUT: Remote exchange server timeout');
    }
    return this.fixtures;
  }

  async fetchIPOByExternalId(externalId: string): Promise<IPOProviderDTO | null> {
    if (this.shouldFail) {
      throw new Error('PROVIDER_NETWORK_TIMEOUT');
    }
    return this.fixtures.find(f => f.externalId === externalId) || null;
  }
}

describe('Phase 6 IPO Center Domain, Repository, Service & HTTP API Suite', () => {
  const ipoRepo = new DrizzleIPORepository();
  const defaultProvider = new DevelopmentIPOProvider();
  const auditRepo = new DrizzleAuditLogRepository();
  const ipoService = new IPOService(ipoRepo, defaultProvider, auditRepo);
  const testUserId = '00000000-0000-4000-a000-000000000001';
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();
    await db.insert(users).values({
      id: testUserId,
      email: 'ipo-test-user@apexos.dev',
      name: 'IPO Test User'
    }).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('DevelopmentIPOProvider returns empty array when no external URL is configured (zero fake data policy)', async () => {
    const ipos = await defaultProvider.fetchIPOs();
    expect(Array.isArray(ipos)).toBe(true);
    expect(ipos.length).toBe(0);
  });

  it('proves deterministic sync identity: 1st sync -> 1 record, 2nd sync -> still 1 record, changed data -> same canonical record updated', async () => {
    const externalId = 'SYNC_DETERMINISTIC_001';
    const initialDto: IPOProviderDTO = {
      externalId,
      provider: 'TEST_FIXTURE',
      source: 'NSE Direct Feed',
      issuerName: 'Initial Apex Corp',
      ipoName: 'Apex Corp IPO',
      symbol: 'APEXCORP',
      exchange: 'NSE',
      issueType: 'MAINBOARD',
      status: 'UPCOMING',
      priceBandLow: '100.0000',
      priceBandHigh: '120.0000',
      lotSize: 100
    };

    const provider = new TestFixtureIPOProvider([initialDto]);

    // 1st sync -> exactly 1 record created
    const sync1 = await ipoService.syncIPOs(provider, testUserId);
    expect(sync1.success).toBe(true);
    expect(sync1.syncedCount).toBe(1);

    const afterSync1 = await ipoRepo.getByExternalId('TEST_FIXTURE', externalId);
    expect(afterSync1).not.toBeNull();
    expect(afterSync1?.issuerName).toBe('Initial Apex Corp');
    expect(afterSync1?.priceBandHigh).toBe('120.0000');
    const firstCanonicalId = afterSync1?.id;

    // 2nd sync with same data -> still 1 record in database (no duplicates)
    const sync2 = await ipoService.syncIPOs(provider, testUserId);
    expect(sync2.success).toBe(true);
    expect(sync2.syncedCount).toBe(1);

    const afterSync2 = await ipoRepo.getByExternalId('TEST_FIXTURE', externalId);
    expect(afterSync2?.id).toBe(firstCanonicalId);

    // 3rd sync with updated provider data -> same canonical record updated in place
    provider.setFixtures([{
      ...initialDto,
      issuerName: 'Updated Apex Corporation Ltd',
      priceBandHigh: '125.0000'
    }]);

    const sync3 = await ipoService.syncIPOs(provider, testUserId);
    expect(sync3.success).toBe(true);
    expect(sync3.syncedCount).toBe(1);

    const afterSync3 = await ipoRepo.getByExternalId('TEST_FIXTURE', externalId);
    expect(afterSync3?.id).toBe(firstCanonicalId);
    expect(afterSync3?.issuerName).toBe('Updated Apex Corporation Ltd');
    expect(afterSync3?.priceBandHigh).toBe('125.0000');
  });

  it('calculates maxLotCost using Decimal.js precision arithmetic (priceBandHigh * lotSize)', async () => {
    const created = await ipoRepo.upsert({
      externalId: 'TEST_DECIMAL_202',
      provider: 'TEST_FIXTURE',
      source: 'Test Feed',
      issuerName: 'Precision Tech Ltd',
      ipoName: 'Precision Tech IPO',
      priceBandHigh: '142.5000',
      lotSize: 100
    });

    const enriched = await ipoService.getIPO(created.id);
    expect(enriched).not.toBeNull();
    // 142.5000 * 100 = 14250.0000
    expect(enriched?.maxLotCost).toBe('14250.0000');
  });

  it('handles State C (Provider Failure) without deleting or corrupting existing canonical database records', async () => {
    // Seed existing valid record
    const existing = await ipoRepo.upsert({
      externalId: 'STAYS_SAFE_001',
      provider: 'TEST_FAIL_PROVIDER',
      source: 'Official Feed',
      issuerName: 'Safe Corp Ltd',
      ipoName: 'Safe Corp IPO',
      status: 'OPEN'
    });

    const failingProvider = new TestFixtureIPOProvider([], true);
    const syncResult = await ipoService.syncIPOs(failingProvider, testUserId);

    expect(syncResult.success).toBe(false);
    expect(syncResult.error).toContain('PROVIDER_NETWORK_TIMEOUT');

    // Existing database record MUST remain completely intact
    const verifiedRecord = await ipoRepo.getById(existing.id);
    expect(verifiedRecord).not.toBeNull();
    expect(verifiedRecord?.issuerName).toBe('Safe Corp Ltd');
  });

  it('handles State D (Malformed Provider Records) by logging observable malformedCount without corrupting valid records', async () => {
    const mixedFixture = new TestFixtureIPOProvider([
      {
        externalId: 'VALID_001',
        provider: 'TEST_MALFORMED_FIXTURE',
        source: 'Feed',
        issuerName: 'Valid Corp Ltd',
        ipoName: 'Valid IPO',
        status: 'OPEN'
      },
      // Invalid record: missing externalId & invalid status
      {
        externalId: '',
        provider: 'TEST_MALFORMED_FIXTURE',
        source: 'Feed',
        issuerName: 'Bad Record',
        ipoName: 'Bad IPO',
        status: 'INVALID_STATUS' as any
      }
    ]);

    const syncResult = await ipoService.syncIPOs(mixedFixture, testUserId);
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.malformedCount).toBe(1);

    const validRecord = await ipoRepo.getByExternalId('TEST_MALFORMED_FIXTURE', 'VALID_001');
    expect(validRecord).not.toBeNull();
    expect(validRecord?.issuerName).toBe('Valid Corp Ltd');
  });

  it('preserves calendar dates and ISO serialization around midnight UTC boundaries', async () => {
    const isoDateStr = '2026-09-20T00:00:00.000Z';
    const created = await ipoRepo.upsert({
      externalId: 'DATE_TEST_001',
      provider: 'TEST_FIXTURE',
      source: 'Calendar Feed',
      issuerName: 'Midnight Boundaries Ltd',
      ipoName: 'Midnight IPO',
      openDate: new Date(isoDateStr),
      closeDate: new Date('2026-09-23T23:59:59.000Z'),
      status: 'UPCOMING'
    });

    const fetched = await ipoRepo.getById(created.id);
    expect(fetched?.openDate?.toISOString()).toBe(isoDateStr);
  });

  it('HTTP API GET /api/v1/ipo returns 200 OK with dataset, pipeline summary, and pagination metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ipo'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pipeline).toBeDefined();
    expect(body.meta.page).toBe(1);
  });

  it('HTTP API GET /api/v1/ipo/:id returns 200 OK for valid ID and 404 Not Found for non-existent UUID', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/ipo'
    });
    const firstIpo = JSON.parse(listRes.body).data[0];

    // Valid ID lookup
    const validRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ipo/${firstIpo.id}`
    });
    expect(validRes.statusCode).toBe(200);
    const validBody = JSON.parse(validRes.body);
    expect(validBody.data.id).toBe(firstIpo.id);

    // Non-existent UUID lookup
    const nonExistentId = '00000000-0000-4000-a000-999999999999';
    const notFoundRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ipo/${nonExistentId}`
    });
    expect(notFoundRes.statusCode).toBe(404);
    const notFoundBody = JSON.parse(notFoundRes.body);
    expect(notFoundBody.success).toBe(false);
    expect(notFoundBody.error.code).toBe('NOT_FOUND');
  });

  it('HTTP API POST /api/v1/ipo/sync enforces security boundary: rejects missing header with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ipo/sync'
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('HTTP API POST /api/v1/ipo/sync enforces security boundary: rejects malformed x-user-id header with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ipo/sync',
      headers: { 'x-user-id': 'invalid-not-a-uuid' }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('HTTP API POST /api/v1/ipo/sync accepts valid x-user-id header and returns 200 OK sync summary', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ipo/sync',
      headers: createAuthHeaders(testUserId, 'admin')
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.providerId).toBe('DEVELOPMENT_STUB');
  });
});
