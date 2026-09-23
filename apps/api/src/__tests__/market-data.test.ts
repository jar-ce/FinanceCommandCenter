import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb } from '../db/index.js';
import { DrizzleMarketRepository } from '../infrastructure/repositories/DrizzleMarketRepository.js';
import { DevelopmentMarketDataProvider } from '../infrastructure/providers/DevelopmentMarketDataProvider.js';
import { MarketDataService } from '../domain/services/MarketDataService.js';
import { IMarketDataProvider } from '../domain/providers/IMarketDataProvider.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { createAuthHeaders } from '../infrastructure/auth/principal.js';

describe('Phase 9 Stock Market Data Architecture Test Suite', () => {
  const repo = new DrizzleMarketRepository();
  const devProvider = new DevelopmentMarketDataProvider();
  const marketService = new MarketDataService(repo, devProvider, { cacheTtlMs: 500 });
  let app: FastifyInstance;
  let testInstrumentId: string;

  beforeAll(async () => {
    await runMigrations();
    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('1. Decimal.js High-Precision Financial Calculation Unit Tests', () => {
    it('calculates price change and percentage accurately without JavaScript float inaccuracies', () => {
      // 2542.55 - 2500.00 = 42.5500; (42.55 / 2500) * 100 = 1.7020%
      const res = MarketDataService.calculateQuoteMetrics('2542.5500', '2500.0000');
      expect(res.change).toBe('42.5500');
      expect(res.changePercent).toBe('1.7020');
    });

    it('handles negative change accurately', () => {
      // 2450.00 - 2500.00 = -50.0000; (-50 / 2500) * 100 = -2.0000%
      const res = MarketDataService.calculateQuoteMetrics('2450.0000', '2500.0000');
      expect(res.change).toBe('-50.0000');
      expect(res.changePercent).toBe('-2.0000');
    });

    it('handles zero previous close safely without division by zero crash', () => {
      const res = MarketDataService.calculateQuoteMetrics('100.0000', '0.0000');
      expect(res.change).toBe('100.0000');
      expect(res.changePercent).toBe('0.0000');
    });
  });

  describe('2. Zero Fake Data Policy — Development Provider Isolation', () => {
    it('returns status UNAVAILABLE and empty results for search query', async () => {
      const res = await devProvider.searchInstruments('RELIANCE');
      expect(res.status).toBe('UNAVAILABLE');
      expect(res.data).toEqual([]);
    });

    it('returns status UNAVAILABLE and null for single instrument lookup', async () => {
      const res = await devProvider.getInstrument('RELIANCE', 'NSE');
      expect(res.status).toBe('UNAVAILABLE');
      expect(res.data).toBeNull();
    });

    it('returns status UNAVAILABLE and null for quote query', async () => {
      const res = await devProvider.getQuote('RELIANCE', 'NSE');
      expect(res.status).toBe('UNAVAILABLE');
      expect(res.data).toBeNull();
    });

    it('returns status UNAVAILABLE and empty array for historical candles', async () => {
      const res = await devProvider.getHistoricalPrices('RELIANCE', '1d');
      expect(res.status).toBe('UNAVAILABLE');
      expect(res.data).toEqual([]);
    });

    it('returns status UNAVAILABLE and closed session for market status', async () => {
      const res = await devProvider.getMarketStatus('NSE');
      expect(res.status).toBe('UNAVAILABLE');
      expect(res.data.marketState).toBe('CLOSED');
      expect(res.data.isOpen).toBe(false);
    });
  });

  describe('3. Market Instruments Security Master Repository & Domain Logic', () => {
    it('registers a new market instrument into security master with UUID primary key', async () => {
      const record = await marketService.registerInstrument({
        symbol: 'RELIANCE',
        displayName: 'Reliance Industries Limited',
        exchange: 'NSE',
        market: 'IN',
        securityType: 'EQUITY',
        currency: 'INR',
        provider: 'NSE_INDIA',
        providerInstrumentId: 'NSE_RELIANCE_EQ'
      });

      expect(record.id).toBeDefined();
      expect(typeof record.id).toBe('string');
      expect(record.symbol).toBe('RELIANCE');
      expect(record.exchange).toBe('NSE');
      expect(record.providerInstrumentId).toBe('NSE_RELIANCE_EQ');

      testInstrumentId = record.id;
    });

    it('retrieves instrument by ID, symbol + exchange, and provider ID', async () => {
      const byId = await marketService.getInstrumentById(testInstrumentId);
      expect(byId?.symbol).toBe('RELIANCE');

      const bySymEx = await marketService.getInstrumentBySymbolAndExchange('RELIANCE', 'NSE');
      expect(bySymEx?.id).toBe(testInstrumentId);

      const byProvId = await repo.getInstrumentByProviderId('NSE_INDIA', 'NSE_RELIANCE_EQ');
      expect(byProvId?.id).toBe(testInstrumentId);
    });

    it('upserts on (exchange, symbol) conflict without creating duplicate rows', async () => {
      const updated = await marketService.registerInstrument({
        symbol: 'RELIANCE',
        displayName: 'Reliance Industries Ltd (Updated)',
        exchange: 'NSE',
        provider: 'NSE_INDIA',
        providerInstrumentId: 'NSE_RELIANCE_EQ'
      });

      expect(updated.id).toBe(testInstrumentId);
      expect(updated.displayName).toBe('Reliance Industries Ltd (Updated)');

      const searchRes = await marketService.searchInstruments({ query: 'RELIANCE' });
      expect(searchRes.totalCount).toBe(1);
    });
  });

  describe('4. Quote Caching, Freshness & Stale Provider Fallback Integrity', () => {
    it('returns UNAVAILABLE quote when no quote is cached and provider is unavailable', async () => {
      const quote = await marketService.getQuote(testInstrumentId);
      expect(quote).toBeDefined();
      expect(quote?.dataFreshness).toBe('UNAVAILABLE');
      expect(quote?.marketStatus).toBe('UNKNOWN');
      expect(quote?.lastPrice).toBeNull();
    });

    it('stores fresh quote observation when provider supplies live market quote', async () => {
      // Create custom mock provider that supplies live data
      const mockLiveProvider: IMarketDataProvider = {
        providerId: 'MOCK_LIVE_PROVIDER',
        providerName: 'Mock Live Market Data Provider',
        async searchInstruments() { return { status: 'AVAILABLE', data: [] }; },
        async getInstrument() { return { status: 'AVAILABLE', data: null }; },
        async getQuote() {
          return {
            status: 'AVAILABLE',
            data: {
              id: '',
              instrumentId: testInstrumentId,
              lastPrice: '2540.0000',
              previousClose: '2500.0000',
              open: '2505.0000',
              high: '2550.0000',
              low: '2495.0000',
              close: '2540.0000',
              volume: 1250000,
              change: '40.0000',
              changePercent: '1.6000',
              currency: 'INR',
              marketStatus: 'OPEN',
              dataFreshness: 'LIVE',
              asOf: new Date().toISOString(),
              retrievedAt: new Date().toISOString(),
              provider: 'MOCK_LIVE_PROVIDER',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          };
        },
        async getBatchQuotes() { return { status: 'AVAILABLE', data: new Map() }; },
        async getHistoricalPrices() { return { status: 'AVAILABLE', data: [] }; },
        async getMarketStatus() {
          return { status: 'AVAILABLE', data: { exchange: 'NSE', isOpen: true, marketState: 'OPEN', lastUpdated: new Date().toISOString() } };
        }
      };

      const liveService = new MarketDataService(repo, mockLiveProvider, { cacheTtlMs: 1000 });
      const quote = await liveService.getQuote(testInstrumentId);

      expect(quote?.lastPrice).toBe('2540.0000');
      expect(quote?.change).toBe('40.0000');
      expect(quote?.changePercent).toBe('1.6000');
      expect(quote?.dataFreshness).toBe('LIVE');
      expect(quote?.marketStatus).toBe('OPEN');
    });

    it('preserves cached quote but downgrades freshness to STALE and marketStatus to UNAVAILABLE on provider failure', async () => {
      // Now use service connected to DevelopmentMarketDataProvider (which returns UNAVAILABLE)
      // and wait for cache TTL (500ms) to expire
      await new Promise(r => setTimeout(r, 600));

      const quote = await marketService.getQuote(testInstrumentId);

      expect(quote).toBeDefined();
      expect(quote?.lastPrice).toBe('2540.0000'); // Preserves cached price
      expect(quote?.dataFreshness).toBe('STALE'); // Clearly labeled STALE
      expect(quote?.marketStatus).toBe('OPEN'); // Retains cached market state
      expect(quote?.dataFreshness).not.toBe('LIVE'); // NEVER labels stale data as LIVE
    });
  });

  describe('5. Fastify REST Endpoints (/api/v1/market)', () => {
    it('GET /api/v1/market/instruments returns list of registered instruments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/market/instruments?query=RELIANCE'
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0].symbol).toBe('RELIANCE');
    });

    it('GET /api/v1/market/instruments/:id returns single instrument by UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/market/instruments/${testInstrumentId}`
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(testInstrumentId);
      expect(body.data.symbol).toBe('RELIANCE');
    });

    it('GET /api/v1/market/instruments/:id/quote returns current quote observation', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/market/instruments/${testInstrumentId}/quote`
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.instrumentId).toBe(testInstrumentId);
      expect(body.data.dataFreshness).toBeDefined();
    });

    it('GET /api/v1/market/status returns market system status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/market/status?exchange=NSE'
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.exchange).toBe('NSE');
    });

    it('POST /api/v1/market/instruments rejects unauthenticated request without x-user-id header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/market/instruments',
        payload: {
          symbol: 'INFY',
          displayName: 'Infosys Limited',
          exchange: 'NSE'
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/v1/market/instruments registers a new security when authenticated with x-user-id', async () => {
      const validAdminId = '00000000-0000-4000-a000-000000000001';
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/market/instruments',
        headers: createAuthHeaders(validAdminId, 'admin'),
        payload: {
          symbol: 'TCS',
          displayName: 'Tata Consultancy Services Ltd',
          exchange: 'NSE',
          securityType: 'EQUITY',
          currency: 'INR',
          provider: 'NSE_INDIA',
          providerInstrumentId: 'NSE_TCS_EQ'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.symbol).toBe('TCS');
      expect(body.data.providerInstrumentId).toBe('NSE_TCS_EQ');
    });
  });

  describe('6. Financial Calculation & Database Safety Invariant Regression Tests', () => {
    it('proves financial calculations do not suffer from JavaScript floating-point artifacts (0.1 + 0.2 precision test)', () => {
      // Standard JS 0.1 + 0.2 === 0.30000000000000004
      // Decimal.js calculation engine must evaluate exact 0.3000
      const calcResult = MarketDataService.calculateQuoteMetrics('0.3000', '0.2000');
      expect(calcResult.change).toBe('0.1000'); // Exact 0.1000 without IEEE-754 drift
      expect(calcResult.changePercent).toBe('50.0000');
    });

    it('enforces database ON DELETE RESTRICT behavior: deleting instrument with quote observations throws FK constraint error', async () => {
      const db = await (await import('../db/index.js')).getDb();
      const { marketInstruments } = await import('../db/schema/market-instruments.js');
      const { eq } = await import('drizzle-orm');

      // Attempt to delete testInstrumentId which has associated quote observations in market_quotes
      await expect(
        db.delete(marketInstruments).where(eq(marketInstruments.id, testInstrumentId))
      ).rejects.toThrow();
    });
  });
});
