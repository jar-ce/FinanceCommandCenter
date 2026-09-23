import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { ipos } from '../db/schema/ipos.js';
import { khataAccounts } from '../db/schema/khata-accounts.js';
import { DrizzleIPOApplicationRepository } from '../infrastructure/repositories/DrizzleIPOApplicationRepository.js';
import { DrizzleIPORepository } from '../infrastructure/repositories/DrizzleIPORepository.js';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { IPOApplicationService } from '../domain/services/IPOApplicationService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 7 IPO Application Tracker Domain, Service & HTTP Isolation Suite', () => {
  const appRepo = new DrizzleIPOApplicationRepository();
  const ipoRepo = new DrizzleIPORepository();
  const accountRepo = new DrizzleKhataAccountRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const appService = new IPOApplicationService(appRepo, ipoRepo, accountRepo, auditRepo);

  const userAId = '00000000-0000-4000-a000-000000000001';
  const userBId = '00000000-0000-4000-a000-000000000002';
  let app: FastifyInstance;
  let testIpoId: string;
  let userAAccountId: string;
  let userBAccountId: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-app@apexos.dev', name: 'User A Applications' },
      { id: userBId, email: 'user-b-app@apexos.dev', name: 'User B Applications' }
    ]).onConflictDoNothing();

    // 2. Seed canonical IPO
    const [testIpo] = await db.insert(ipos).values({
      externalId: 'IPO_APP_TEST_001',
      provider: 'TEST_FIXTURE',
      source: 'Test Feed',
      issuerName: 'Apex Technology Systems Ltd',
      ipoName: 'Apex Tech IPO',
      symbol: 'APEXTECH',
      exchange: 'NSE',
      issueType: 'MAINBOARD',
      status: 'OPEN',
      priceBandLow: '200.0000',
      priceBandHigh: '215.0000',
      lotSize: 65
    }).returning();
    testIpoId = testIpo.id;

    // 3. Seed khata accounts for User A and User B
    const [accA] = await db.insert(khataAccounts).values({
      userId: userAId,
      displayName: 'User A Zerodha Account',
      accountType: 'PERSONAL'
    }).returning();
    userAAccountId = accA.id;

    const [accB] = await db.insert(khataAccounts).values({
      userId: userBId,
      displayName: 'User B Groww Account',
      accountType: 'PERSONAL'
    }).returning();
    userBAccountId = accB.id;

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('HTTP API POST /api/v1/ipo/applications enforces development identity boundary: rejects missing/invalid header with 401', async () => {
    // Missing header
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/ipo/applications',
      payload: { ipoId: testIpoId, applicationAccountId: userAAccountId, applicationDate: new Date().toISOString(), lotsApplied: 1 }
    });
    expect(res1.statusCode).toBe(401);

    // Invalid UUID
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/ipo/applications',
      headers: { 'x-user-id': 'invalid-uuid' },
      payload: { ipoId: testIpoId, applicationAccountId: userAAccountId, applicationDate: new Date().toISOString(), lotsApplied: 1 }
    });
    expect(res2.statusCode).toBe(401);
  });

  it('creates an IPO application linked to canonical IPO and user account with Decimal.js financial calculation', async () => {
    const created = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date('2026-09-25T10:00:00.000Z').toISOString(),
      lotsApplied: 2
    });

    expect(created).not.toBeNull();
    expect(created?.userId).toBe(userAId);
    expect(created?.ipoId).toBe(testIpoId);
    expect(created?.applicationAccountId).toBe(userAAccountId);
    expect(created?.lotsApplied).toBe(2);
    expect(created?.quantityApplied).toBe(130); // 2 * 65
    // priceBandHigh = 215.0000, 215 * 130 = 27950.0000
    expect(created?.applicationAmount).toBe('27950.0000');
    expect(created?.status).toBe('SUBMITTED');
    expect(created?.accountDisplayName).toBe('User A Zerodha Account');
  });

  it('allows user to record an explicit user application amount overriding estimate', async () => {
    const created = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1,
      quantityApplied: 65,
      applicationAmount: '13975.0000', // Explicit recorded value
      paymentReference: 'UPI-REF-889922'
    });

    expect(created?.applicationAmount).toBe('13975.0000');
    expect(created?.paymentReference).toBe('UPI-REF-889922');
  });

  it('rejects creation referencing an account belonging to another user (User Isolation)', async () => {
    // User A attempting to use User B's account
    await expect(appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userBAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    })).rejects.toThrow('ACCOUNT_NOT_FOUND');
  });

  it('rejects creation referencing a non-existent IPO master record', async () => {
    const nonExistentIpoId = '00000000-0000-4000-a000-999999999999';
    await expect(appService.createApplication(userAId, {
      ipoId: nonExistentIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    })).rejects.toThrow('IPO_NOT_FOUND');
  });

  it('enforces status transition matrix rules and blocks invalid state jumps', async () => {
    const appRecord = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    });

    // SUBMITTED -> PAYMENT_PENDING (Valid)
    const s1 = await appService.transitionStatus(appRecord!.id, userAId, 'PAYMENT_PENDING');
    expect(s1?.status).toBe('PAYMENT_PENDING');

    // PAYMENT_PENDING -> PAYMENT_CONFIRMED (Valid)
    const s2 = await appService.transitionStatus(appRecord!.id, userAId, 'PAYMENT_CONFIRMED');
    expect(s2?.status).toBe('PAYMENT_CONFIRMED');

    // PAYMENT_CONFIRMED -> COMPLETED (Valid)
    const s3 = await appService.transitionStatus(appRecord!.id, userAId, 'COMPLETED');
    expect(s3?.status).toBe('COMPLETED');

    // COMPLETED -> DRAFT (Invalid transition from terminal state)
    await expect(appService.transitionStatus(appRecord!.id, userAId, 'DRAFT'))
      .rejects.toThrow('INVALID_STATUS_TRANSITION');
  });

  it('enforces strict cross-user data isolation: User B cannot access or transition User A application', async () => {
    const userAApp = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    });

    // User B attempts GET via service -> returns null
    const bLookup = await appService.getApplication(userAApp!.id, userBId);
    expect(bLookup).toBeNull();

    // User B attempts HTTP GET /api/v1/ipo/applications/:id -> 404 Not Found
    const httpRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ipo/applications/${userAApp!.id}`,
      headers: { 'x-user-id': userBId }
    });
    expect(httpRes.statusCode).toBe(404);

    // User B attempts HTTP status transition -> 404 Not Found
    const statusRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/applications/${userAApp!.id}/status`,
      headers: { 'x-user-id': userBId },
      payload: { status: 'CANCELLED' }
    });
    expect(statusRes.statusCode).toBe(404);
  });

  it('HTTP API GET /api/v1/ipo/applications returns user-scoped application list, summary breakdown, and metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ipo/applications',
      headers: { 'x-user-id': userAId }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.total).toBeGreaterThanOrEqual(1);
    expect(body.meta.page).toBe(1);
  });

  it('HTTP API PATCH /api/v1/ipo/applications/:id updates editable notes & payment reference', async () => {
    const created = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ipo/applications/${created!.id}`,
      headers: { 'x-user-id': userAId },
      payload: {
        paymentReference: 'UPI-MANDATE-UPDATED-99',
        notes: 'Applied on Day 1 early morning'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.paymentReference).toBe('UPI-MANDATE-UPDATED-99');
    expect(body.data.notes).toBe('Applied on Day 1 early morning');
  });

  it('verifies PATCH /api/v1/ipo/applications/:id cannot arbitrarily alter application status', async () => {
    const created = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    });

    // Attempting to inject status into PATCH body
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ipo/applications/${created!.id}`,
      headers: { 'x-user-id': userAId },
      payload: {
        status: 'COMPLETED', // Should be ignored or not schema-matched
        notes: 'Status injection attempt'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('SUBMITTED'); // Status remains untouched
    expect(body.data.notes).toBe('Status injection attempt');
  });

  it('POST /api/v1/ipo/applications/:id/cancel cancels active application non-destructively', async () => {
    const created = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ipo/applications/${created!.id}/cancel`,
      headers: { 'x-user-id': userAId }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('CANCELLED');

    // Record remains preserved in database
    const fetched = await appService.getApplication(created!.id, userAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe('CANCELLED');
  });

  it('rejects creation using an ARCHIVED khata account with 400 ACCOUNT_ARCHIVED', async () => {
    const db = await getDb();
    const [archivedAcc] = await db.insert(khataAccounts).values({
      userId: userAId,
      displayName: 'User A Old Closed Bank',
      accountType: 'PERSONAL',
      status: 'ARCHIVED',
      archivedAt: new Date()
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ipo/applications',
      headers: { 'x-user-id': userAId },
      payload: {
        ipoId: testIpoId,
        applicationAccountId: archivedAcc.id,
        applicationDate: new Date().toISOString(),
        lotsApplied: 1
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('ACCOUNT_ARCHIVED');
  });

  it('enforces database ON DELETE RESTRICT foreign key constraint on users.id', async () => {
    const db = await getDb();
    const tempUserId = '00000000-0000-4000-a000-000000000099';
    await db.insert(users).values({
      id: tempUserId,
      email: 'temp-fk-user@apexos.dev',
      name: 'Temp FK User'
    });

    const [tempAcc] = await db.insert(khataAccounts).values({
      userId: tempUserId,
      displayName: 'Temp FK Account',
      accountType: 'PERSONAL'
    }).returning();

    await appService.createApplication(tempUserId, {
      ipoId: testIpoId,
      applicationAccountId: tempAcc.id,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1
    });

    // Attempting to delete temp user must fail due to ON DELETE RESTRICT on ipo_applications.user_id
    await expect(db.delete(users).where(require('drizzle-orm').eq(users.id, tempUserId)))
      .rejects.toThrow();
  });

  it('verifies recorded application amount can differ safely from calculated priceBandHigh * quantity estimate', async () => {
    // IPO priceBandHigh = 215.0000, lotSize = 65, quantity = 65 -> Calculated estimate = 13,975.0000
    // User records custom bid at lower price or with special retail discount: recorded = 13500.0000
    const created = await appService.createApplication(userAId, {
      ipoId: testIpoId,
      applicationAccountId: userAAccountId,
      applicationDate: new Date().toISOString(),
      lotsApplied: 1,
      quantityApplied: 65,
      applicationAmount: '13500.0000'
    });

    expect(created?.applicationAmount).toBe('13500.0000');
    // Verify stored applicationAmount is 13500.0000 and not overwritten by estimate (13975.0000)
    expect(created?.applicationAmount).not.toBe('13975.0000');
  });
});
