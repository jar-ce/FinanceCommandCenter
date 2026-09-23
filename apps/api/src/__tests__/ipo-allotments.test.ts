import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { ipos } from '../db/schema/ipos.js';
import { khataAccounts } from '../db/schema/khata-accounts.js';
import { ipoApplications } from '../db/schema/ipo-applications.js';
import { DrizzleIPOAllotmentRepository } from '../infrastructure/repositories/DrizzleIPOAllotmentRepository.js';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { DevelopmentIPOAllotmentProvider } from '../infrastructure/providers/DevelopmentIPOAllotmentProvider.js';
import { IPOAllotmentService } from '../domain/services/IPOAllotmentService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 8 IPO Allotment Checker Domain, Service & HTTP Suite', () => {
  const allotmentRepo = new DrizzleIPOAllotmentRepository();
  const appRepo = new DrizzleIPOApplicationRepository();
  const ipoRepo = new DrizzleIPORepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const provider = new DevelopmentIPOAllotmentProvider();
  const allotmentService = new IPOAllotmentService(allotmentRepo, appRepo, ipoRepo, provider, auditRepo);

  const userAId = '00000000-0000-4000-a000-000000000010';
  const userBId = '00000000-0000-4000-a000-000000000020';
  let app: FastifyInstance;
  let testIpoId: string;
  let userAAccountId: string;
  let userAAppId: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-allotment@apexos.dev', name: 'User A Allotment' },
      { id: userBId, email: 'user-b-allotment@apexos.dev', name: 'User B Allotment' }
    ]).onConflictDoNothing();

    // 2. Seed canonical IPO
    const [testIpo] = await db.insert(ipos).values({
      externalId: 'IPO_ALLOTMENT_TEST_001',
      provider: 'TEST_FIXTURE',
      source: 'Test Feed',
      issuerName: 'Apex Securities & Systems Ltd',
      ipoName: 'Apex Securities IPO',
      symbol: 'APEXSEC',
      exchange: 'NSE',
      issueType: 'MAINBOARD',
      status: 'CLOSED',
      priceBandLow: '500.0000',
      priceBandHigh: '525.0000',
      lotSize: 30
    }).returning();
    testIpoId = testIpo.id;

    // 3. Seed khata account for User A
    const [accA] = await db.insert(khataAccounts).values({
      userId: userAId,
      displayName: 'User A Primary Demat Bank',
      accountType: 'PERSONAL'
    }).returning();
    userAAccountId = accA.id;

    // 4. Seed Phase 7 IPO Application for User A
    const [appRecord] = await db.insert(ipoApplications).values({
      userId: userAId,
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date('2026-09-10T10:00:00Z'),
      lotsApplied: 2,
      quantityApplied: 60,
      applicationAmount: '31500.0000',
      status: 'COMPLETED',
      paymentReference: 'APP-APEX-998811'
    }).returning();
    userAAppId = appRecord.id;

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('HTTP API GET /api/v1/ipo/allotments enforces development identity boundary: rejects 401 without valid header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ipo/allotments'
    });
    expect(res.statusCode).toBe(401);
  });

  it('triggers provider check and returns MANUAL_REQUIRED without fake allotment results (Zero Fake Data)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/allotments/check/${userAAppId}`,
      headers: { 'x-user-id': userAId }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.applicationId).toBe(userAAppId);
    expect(body.data.allotmentStatus).toBe('UNKNOWN'); // Not fake ALLOTTED
    expect(body.data.verificationStatus).toBe('MANUAL_REQUIRED');
    expect(body.data.verificationMethod).toBe('PROVIDER_API');
    expect(body.data.appliedQuantity).toBe(60);
    expect(body.data.allottedQuantity).toBe(0);
  });

  it('allows user to record an explicit manual verification with MANUAL verificationMethod and VERIFIED status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/allotments/verify/${userAAppId}`,
      headers: { 'x-user-id': userAId },
      payload: {
        allotmentStatus: 'ALLOTTED',
        allottedQuantity: 60,
        notes: 'Verified via Link Intime registrar portal',
        source: 'Link Intime Official Portal'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.allotmentStatus).toBe('ALLOTTED');
    expect(body.data.verificationStatus).toBe('VERIFIED');
    expect(body.data.verificationMethod).toBe('MANUAL'); // Explicitly MANUAL
    expect(body.data.allottedQuantity).toBe(60);
    expect(body.data.allotmentRatio).toBe('1.0000'); // 60/60
  });

  it('maintains single canonical result per application by updating existing record on subsequent check/verify', async () => {
    // Record a subsequent manual update for PARTIALLY_ALLOTTED (30 shares)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/allotments/verify/${userAAppId}`,
      headers: { 'x-user-id': userAId },
      payload: {
        allotmentStatus: 'PARTIALLY_ALLOTTED',
        allottedQuantity: 30,
        notes: 'Corrected after reviewing final allotment advice'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.allotmentStatus).toBe('PARTIALLY_ALLOTTED');
    expect(body.data.allottedQuantity).toBe(30);
    expect(body.data.allotmentRatio).toBe('0.5000'); // 30/60

    // List allotments -> totalCount should still be 1 (No duplicate records)
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ipo/allotments?applicationId=${userAAppId}`,
      headers: { 'x-user-id': userAId }
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.meta.totalCount).toBe(1);
  });

  it('enforces strict quantity validation rules and rejects invalid allotment values', async () => {
    // Allotted quantity > Applied quantity (60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'ALLOTTED',
      allottedQuantity: 90
    })).rejects.toThrow('INVALID_QUANTITY');

    // PARTIALLY_ALLOTTED with 0 shares
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'PARTIALLY_ALLOTTED',
      allottedQuantity: 0
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');

    // NOT_ALLOTTED with > 0 shares
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'NOT_ALLOTTED',
      allottedQuantity: 30
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');
  });

  it('enforces strict cross-user security isolation: User B cannot check or read User A allotment', async () => {
    // User B attempts check on User A's application
    const checkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/allotments/check/${userAAppId}`,
      headers: { 'x-user-id': userBId }
    });
    expect(checkRes.statusCode).toBe(404);

    // User B attempts manual verify on User A's application
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/allotments/verify/${userAAppId}`,
      headers: { 'x-user-id': userBId },
      payload: { allotmentStatus: 'ALLOTTED', allottedQuantity: 60 }
    });
    expect(verifyRes.statusCode).toBe(404);

    // User B attempts GET /api/v1/ipo/allotments -> Returns empty list for User B
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/ipo/allotments',
      headers: { 'x-user-id': userBId }
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.data.length).toBe(0);
    expect(listBody.summary.total).toBe(0);
  });

  it('verifies Phase 7 IPO application status remains completely unchanged after allotment check & manual verification', async () => {
    const db = await getDb();
    const [appRecord] = await db
      .select()
      .from(ipoApplications)
      .where(require('drizzle-orm').eq(ipoApplications.id, userAAppId));

    expect(appRecord.status).toBe('COMPLETED'); // Unchanged Phase 7 status
  });

  it('protects an existing VERIFIED result from being overwritten or downgraded when provider returns UNAVAILABLE', async () => {
    // 1. Manually verify result as ALLOTTED + VERIFIED + MANUAL
    await allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'ALLOTTED',
      allottedQuantity: 60,
      notes: 'Verified result to test state protection'
    });

    // 2. Trigger provider check (which returns MANUAL_REQUIRED / UNAVAILABLE / UNKNOWN)
    const checkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/allotments/check/${userAAppId}`,
      headers: { 'x-user-id': userAId }
    });

    expect(checkRes.statusCode).toBe(200);
    const body = JSON.parse(checkRes.body);

    // MUST NOT be downgraded to UNKNOWN or UNAVAILABLE
    expect(body.data.allotmentStatus).toBe('ALLOTTED');
    expect(body.data.verificationStatus).toBe('VERIFIED');
    expect(body.data.verificationMethod).toBe('MANUAL');
    expect(body.data.allottedQuantity).toBe(60);
  });

  it('enforces exhaustive quantity & status invariant validation rules for all status combinations', async () => {
    // 1. Negative allotted quantity
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'PARTIALLY_ALLOTTED',
      allottedQuantity: -10
    })).rejects.toThrow('INVALID_QUANTITY');

    // 2. Allotted > Applied (75 > 60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'ALLOTTED',
      allottedQuantity: 75
    })).rejects.toThrow('INVALID_QUANTITY');

    // 3. ALLOTTED status with partial quantity (30 out of 60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'ALLOTTED',
      allottedQuantity: 30
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');

    // 4. PARTIALLY_ALLOTTED with zero quantity (0 out of 60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'PARTIALLY_ALLOTTED',
      allottedQuantity: 0
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');

    // 5. PARTIALLY_ALLOTTED with full quantity (60 out of 60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'PARTIALLY_ALLOTTED',
      allottedQuantity: 60
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');

    // 6. NOT_ALLOTTED with non-zero quantity (30 out of 60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'NOT_ALLOTTED',
      allottedQuantity: 30
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');

    // 7. REJECTED with non-zero quantity (15 out of 60)
    await expect(allotmentService.recordManualVerification(userAAppId, userAId, {
      allotmentStatus: 'REJECTED',
      allottedQuantity: 15
    })).rejects.toThrow('INVALID_ALLOTMENT_STATUS');
  });
});
