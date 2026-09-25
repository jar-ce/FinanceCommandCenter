import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MarketDataService } from '../domain/services/MarketDataService.js';
import { runMigrations } from '../db/migrate.js';
import { closeDb } from '../db/index.js';

describe('Phase 19 — OPT-03 Market Quote In-Memory Cache Suite', () => {
  const testInstId1 = '99999999-1111-4999-a999-111111111111';
  const testInstId2 = '99999999-2222-4999-a999-222222222222';

  const mockRepo: any = {
    getInstrumentById: async (id: string) => {
      if (id === testInstId1) {
        return { id: testInstId1, symbol: 'CACHE_STK1', displayName: 'Cache Stock 1', exchange: 'NSE', currency: 'INR' };
      }
      if (id === testInstId2) {
        return { id: testInstId2, symbol: 'CACHE_STK2', displayName: 'Cache Stock 2', exchange: 'NSE', currency: 'INR' };
      }
      return null;
    },
    getQuoteByInstrumentId: async (id: string) => {
      if (id === testInstId1) {
        return {
          id: 'q1',
          instrumentId: testInstId1,
          lastPrice: '100.0000',
          previousClose: '95.0000',
          dataFreshness: 'LIVE',
          marketStatus: 'OPEN',
          retrievedAt: new Date().toISOString()
        };
      }
      return null;
    },
    upsertQuote: async (q: any) => ({ ...q, id: 'upserted-' + q.instrumentId })
  };

  const mockProvider: any = {
    providerId: 'MOCK_PROVIDER',
    getQuote: async (symbol: string) => {
      if (symbol === 'CACHE_STK2') {
        return {
          status: 'AVAILABLE',
          data: {
            lastPrice: '250.0000',
            previousClose: '240.0000',
            dataFreshness: 'LIVE',
            marketStatus: 'OPEN',
            asOf: new Date().toISOString()
          }
        };
      }
      return { status: 'UNAVAILABLE', data: null };
    }
  };

  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('populates in-memory cache on first lookup and serves subsequent hits from in-memory cache', async () => {
    const service = new MarketDataService(mockRepo, mockProvider, { cacheTtlMs: 5000 });
    expect(service.getInMemoryCacheSize()).toBe(0);

    const quote1 = await service.getQuote(testInstId1);
    expect(quote1).not.toBeNull();
    expect(quote1?.lastPrice).toBe('100.0000');
    expect(service.getInMemoryCacheSize()).toBe(1);

    // Second call hit in-memory cache directly
    const quote1Cached = await service.getQuote(testInstId1);
    expect(quote1Cached?.lastPrice).toBe('100.0000');
    expect(service.getInMemoryCacheSize()).toBe(1);
  });

  it('fetches from provider on cache miss, upserts to DB and caches in-memory', async () => {
    const service = new MarketDataService(mockRepo, mockProvider, { cacheTtlMs: 5000 });

    const quote2 = await service.getQuote(testInstId2);
    expect(quote2).not.toBeNull();
    expect(quote2?.lastPrice).toBe('250.0000');
    expect(quote2?.dataFreshness).toBe('LIVE');
    expect(service.getInMemoryCacheSize()).toBe(1);
  });

  it('performs batch lookup using in-memory cache hits and fetching missing IDs', async () => {
    const service = new MarketDataService(mockRepo, mockProvider, { cacheTtlMs: 5000 });

    // Seed inst 1 into in-memory cache
    await service.getQuote(testInstId1);
    expect(service.getInMemoryCacheSize()).toBe(1);

    const batch = await service.getBatchQuotes([testInstId1, testInstId2]);
    expect(batch.length).toBe(2);
    expect(service.getInMemoryCacheSize()).toBe(2);
  });

  it('respects TTL expiry and falls back to provider/DB on expired in-memory cache', async () => {
    const service = new MarketDataService(mockRepo, mockProvider, { cacheTtlMs: 1 }); // 1ms TTL
    await service.getQuote(testInstId1);

    // Wait 10ms for TTL to expire
    await new Promise((r) => setTimeout(r, 10));

    const quoteAfterExpiry = await service.getQuote(testInstId1);
    expect(quoteAfterExpiry).not.toBeNull();
    expect(quoteAfterExpiry?.lastPrice).toBe('100.0000');
  });

  it('returns STALE freshness when provider fails and DB cached quote exists', async () => {
    const staleRepo: any = {
      getInstrumentById: async () => ({ id: 'stale-1', symbol: 'FAIL_STK', displayName: 'Stale Stock', exchange: 'NSE', currency: 'INR' }),
      getQuoteByInstrumentId: async () => ({
        id: 'stale-q1',
        instrumentId: 'stale-1',
        lastPrice: '50.0000',
        previousClose: '50.0000',
        dataFreshness: 'LIVE',
        retrievedAt: new Date(Date.now() - 100000).toISOString() // Old timestamp -> expired
      })
    };
    const failingProvider: any = {
      providerId: 'FAIL_PROVIDER',
      getQuote: async () => { throw new Error('Provider Down'); }
    };

    const service = new MarketDataService(staleRepo, failingProvider, { cacheTtlMs: 5000 });
    const quote = await service.getQuote('stale-1');

    expect(quote).not.toBeNull();
    expect(quote?.dataFreshness).toBe('STALE');
    expect(quote?.lastPrice).toBe('50.0000');
  });
});
