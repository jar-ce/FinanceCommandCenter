import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { marketInstruments } from '../db/schema/market-instruments.js';
import { marketQuotes } from '../db/schema/market-quotes.js';
import { DrizzleWatchlistRepository } from '../infrastructure/repositories/DrizzleWatchlistRepository.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { WatchlistService } from '../domain/services/WatchlistService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 11 Watchlist Domain, Service & HTTP Security Isolation Suite', () => {
  const watchlistRepo = new DrizzleWatchlistRepository();
  const marketRepo = new DrizzleMarketRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const watchlistService = new WatchlistService(watchlistRepo, marketRepo, auditRepo);

  const userAId = '00000000-0000-4000-a000-000000000010';
  const userBId = '00000000-0000-4000-a000-000000000020';
  let app: FastifyInstance;
  let testInstrument1Id: string;
  let testInstrument2Id: string;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();

    // 1. Seed test users
    await db.insert(users).values([
      { id: userAId, email: 'user-a-watchlist@apexos.dev', name: 'User A Watchlist' },
      { id: userBId, email: 'user-b-watchlist@apexos.dev', name: 'User B Watchlist' }
    ]).onConflictDoNothing();

    // 2. Seed canonical market instruments
    const [inst1] = await db.insert(marketInstruments).values({
      symbol: 'TATASTEEL',
      displayName: 'Tata Steel Limited',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    const [inst2] = await db.insert(marketInstruments).values({
      symbol: 'HDFCBANK',
      displayName: 'HDFC Bank Limited',
      exchange: 'NSE',
      market: 'IN',
      securityType: 'EQUITY',
      currency: 'INR',
      provider: 'NSE_INDIA',
      status: 'ACTIVE'
    }).onConflictDoNothing().returning();

    testInstrument1Id = inst1 ? inst1.id : (await marketRepo.getInstrumentBySymbolAndExchange('TATASTEEL', 'NSE'))!.id;
    testInstrument2Id = inst2 ? inst2.id : (await marketRepo.getInstrumentBySymbolAndExchange('HDFCBANK', 'NSE'))!.id;

    // 3. Seed initial quote observations
    await db.insert(marketQuotes).values([
      {
        instrumentId: testInstrument1Id,
        lastPrice: '150.2500',
        previousClose: '148.0000',
        change: '2.2500',
        changePercent: '1.5203',
        currency: 'INR',
        marketStatus: 'OPEN',
        dataFreshness: 'LIVE',
        provider: 'NSE_INDIA'
      },
      {
        instrumentId: testInstrument2Id,
        lastPrice: '1620.0000',
        previousClose: '1600.0000',
        change: '20.0000',
        changePercent: '1.2500',
        currency: 'INR',
        marketStatus: 'OPEN',
        dataFreshness: 'LIVE',
        provider: 'NSE_INDIA'
      }
    ]).onConflictDoNothing();

    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDb();
  });

  describe('1. HTTP Identity Boundary & Authentication (Strict x-user-id Requirement)', () => {
    it('Test A: rejects GET /api/v1/watchlists with 401 when x-user-id header is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/watchlists'
      });
      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('UNAUTHORIZED');
    });

    it('Test B: rejects request with 401 when x-user-id header is empty or malformed', async () => {
      const resEmpty = await app.inject({
        method: 'GET',
        url: '/api/v1/watchlists',
        headers: { 'x-user-id': '   ' }
      });
      expect(resEmpty.statusCode).toBe(401);

      const resMalformed = await app.inject({
        method: 'GET',
        url: '/api/v1/watchlists',
        headers: { 'x-user-id': 'invalid-uuid-format' }
      });
      expect(resMalformed.statusCode).toBe(401);
    });

    it('Test C: rejects GET /api/v1/watchlists/:id with 401 without x-user-id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/watchlists/00000000-0000-4000-a000-000000000001'
      });
      expect(response.statusCode).toBe(401);
    });

    it('Test D: rejects POST /api/v1/watchlists with 401 without x-user-id header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/watchlists',
        payload: { name: 'Unauthorized Watchlist' }
      });
      expect(response.statusCode).toBe(401);
    });

    it('Test E: rejects POST /api/v1/watchlists/:id/items with 401 without x-user-id header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/watchlists/00000000-0000-4000-a000-000000000001/items',
        payload: { instrumentId: testInstrument1Id }
      });
      expect(response.statusCode).toBe(401);
    });

    it('Test F: rejects PATCH/DELETE/archive/restore endpoints with 401 without x-user-id header', async () => {
      const dummyId = '00000000-0000-4000-a000-000000000001';

      const resPatch = await app.inject({ method: 'PATCH', url: `/api/v1/watchlists/${dummyId}`, payload: { name: 'X' } });
      expect(resPatch.statusCode).toBe(401);

      const resDelete = await app.inject({ method: 'DELETE', url: `/api/v1/watchlists/${dummyId}/items/${testInstrument1Id}` });
      expect(resDelete.statusCode).toBe(401);

      const resArchive = await app.inject({ method: 'POST', url: `/api/v1/watchlists/${dummyId}/archive` });
      expect(resArchive.statusCode).toBe(401);

      const resRestore = await app.inject({ method: 'POST', url: `/api/v1/watchlists/${dummyId}/restore` });
      expect(resRestore.statusCode).toBe(401);

      const resReorder = await app.inject({ method: 'PATCH', url: `/api/v1/watchlists/${dummyId}/reorder`, payload: { itemIds: [] } });
      expect(resReorder.statusCode).toBe(401);
    });

    it('Test G: verifies no request path automatically resolves to a default/fallback identity', async () => {
      // Unauthenticated request must NEVER return data belonging to any user
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/watchlists'
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns empty array when authenticated user has no watchlists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/watchlists',
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual([]);
    });
  });

  describe('2. Watchlist CRUD & User Ownership Isolation', () => {
    let userAWatchlistId: string;

    it('creates a new watchlist for User A', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/watchlists',
        headers: { 'x-user-id': userAId },
        payload: {
          name: 'Core Tech & Metals',
          description: 'Long term watchlist'
        }
      });
      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.name).toBe('Core Tech & Metals');
      expect(payload.data.userId).toBe(userAId);
      expect(payload.data.status).toBe('ACTIVE');
      userAWatchlistId = payload.data.id;
    });

    it('prevents User B from viewing User A watchlist details (404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/watchlists/${userAWatchlistId}`,
        headers: { 'x-user-id': userBId }
      });
      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });

    it('allows User A to view their own watchlist details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/watchlists/${userAWatchlistId}`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.id).toBe(userAWatchlistId);
      expect(payload.data.items).toEqual([]);
    });

    it('allows User A to rename their watchlist', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/watchlists/${userAWatchlistId}`,
        headers: { 'x-user-id': userAId },
        payload: { name: 'Metals & Banking Focus' }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.name).toBe('Metals & Banking Focus');
    });

    it('prevents User B from renaming User A watchlist (404)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/watchlists/${userAWatchlistId}`,
        headers: { 'x-user-id': userBId },
        payload: { name: 'Hacked Name' }
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('3. Watchlist Items, Duplicate Prevention & Non-Destructive Deletion', () => {
    let watchlistId: string;

    beforeAll(async () => {
      const list = await watchlistService.createWatchlist(userAId, 'Banking Watchlist');
      watchlistId = list.id;
    });

    it('adds a canonical market instrument to the watchlist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/items`,
        headers: { 'x-user-id': userAId },
        payload: { instrumentId: testInstrument1Id }
      });
      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.instrumentId).toBe(testInstrument1Id);
      expect(payload.data.instrument.symbol).toBe('TATASTEEL');
      expect(payload.data.quote.lastPrice).toBe('150.2500');
    });

    it('prevents duplicate membership in the same watchlist (409 Conflict)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/items`,
        headers: { 'x-user-id': userAId },
        payload: { instrumentId: testInstrument1Id }
      });
      expect(response.statusCode).toBe(409);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('DUPLICATE_ITEM');
    });

    it('prevents User B from adding an item to User A watchlist (404)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/items`,
        headers: { 'x-user-id': userBId },
        payload: { instrumentId: testInstrument2Id }
      });
      expect(response.statusCode).toBe(404);
    });

    it('adds a second canonical instrument to the watchlist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/items`,
        headers: { 'x-user-id': userAId },
        payload: { instrumentId: testInstrument2Id }
      });
      expect(response.statusCode).toBe(201);

      // Verify detailed view contains both items with live quote enrichment
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/watchlists/${watchlistId}`,
        headers: { 'x-user-id': userAId }
      });
      const detailPayload = JSON.parse(detailRes.payload);
      expect(detailPayload.data.items.length).toBe(2);
      expect(detailPayload.data.itemCount).toBe(2);
    });

    it('removes an item from the watchlist without deleting underlying market_instruments', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/watchlists/${watchlistId}/items/${testInstrument1Id}`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);

      // Verify underlying market instrument still exists in database
      const inst = await marketRepo.getInstrumentById(testInstrument1Id);
      expect(inst).not.toBeNull();
      expect(inst?.symbol).toBe('TATASTEEL');

      // Verify item count is now 1
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/watchlists/${watchlistId}`,
        headers: { 'x-user-id': userAId }
      });
      const detailPayload = JSON.parse(detailRes.payload);
      expect(detailPayload.data.items.length).toBe(1);
    });
  });

  describe('4. Non-Destructive Archiving & Restore Workflow', () => {
    let watchlistId: string;

    beforeAll(async () => {
      const list = await watchlistService.createWatchlist(userAId, 'Archivable Watchlist');
      await watchlistService.addItem(list.id, testInstrument2Id, userAId);
      watchlistId = list.id;
    });

    it('archives a watchlist successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/archive`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.status).toBe('ARCHIVED');
      expect(payload.data.archivedAt).not.toBeNull();
    });

    it('rejects adding new items to an archived watchlist (422 Unprocessable)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/items`,
        headers: { 'x-user-id': userAId },
        payload: { instrumentId: testInstrument1Id }
      });
      expect(response.statusCode).toBe(422);
      const payload = JSON.parse(response.payload);
      expect(payload.error.code).toBe('ARCHIVED_WATCHLIST');
    });

    it('restores an archived watchlist back to ACTIVE', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/restore`,
        headers: { 'x-user-id': userAId }
      });
      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data.status).toBe('ACTIVE');
      expect(payload.data.archivedAt).toBeNull();
    });

    it('allows adding items after watchlist is restored', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/watchlists/${watchlistId}/items`,
        headers: { 'x-user-id': userAId },
        payload: { instrumentId: testInstrument1Id }
      });
      expect(response.statusCode).toBe(201);
    });
  });
});
