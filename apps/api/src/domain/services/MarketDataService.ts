import { Decimal } from 'decimal.js';
import { IMarketRepository, EnrichedMarketQuote } from '../repositories/IMarketRepository.js';
import { IMarketDataProvider } from '../providers/IMarketDataProvider.js';
import {
  MarketInstrumentRecord,
  MarketCandle,
  MarketSearchFilters,
  MarketExchange,
  MarketStatus
} from '@finance-command-center/shared-types';
import { MarketInstrumentInsert } from '../../db/schema/market-instruments.js';

export interface MarketServiceOptions {
  cacheTtlMs?: number; // Default 15,000 ms
}

export class MarketDataService {
  private repository: IMarketRepository;
  private provider: IMarketDataProvider;
  private cacheTtlMs: number;

  constructor(
    repository: IMarketRepository,
    provider: IMarketDataProvider,
    options?: MarketServiceOptions
  ) {
    this.repository = repository;
    this.provider = provider;
    this.cacheTtlMs = options?.cacheTtlMs ?? 15_000;
  }

  /**
   * Financial calculation using Decimal.js for high-precision price change & change percentage.
   * Eliminates JavaScript floating-point rounding inaccuracies.
   */
  public static calculateQuoteMetrics(
    lastPriceStr: string,
    previousCloseStr: string
  ): { change: string; changePercent: string } {
    try {
      const lastPrice = new Decimal(lastPriceStr);
      const prevClose = new Decimal(previousCloseStr);

      const changeDec = lastPrice.sub(prevClose);
      const change = changeDec.toFixed(4);

      let changePercent = '0.0000';
      if (!prevClose.isZero()) {
        changePercent = changeDec.div(prevClose).mul(100).toFixed(4);
      }

      return { change, changePercent };
    } catch {
      return { change: '0.0000', changePercent: '0.0000' };
    }
  }

  // Instrument Master Operations
  async searchInstruments(
    filters: MarketSearchFilters
  ): Promise<{ instruments: MarketInstrumentRecord[]; totalCount: number }> {
    return this.repository.searchInstruments(filters);
  }

  async getInstrumentById(id: string): Promise<MarketInstrumentRecord | null> {
    return this.repository.getInstrumentById(id);
  }

  async getInstrumentBySymbolAndExchange(
    symbol: string,
    exchange: string
  ): Promise<MarketInstrumentRecord | null> {
    return this.repository.getInstrumentBySymbolAndExchange(symbol, exchange);
  }

  async registerInstrument(record: MarketInstrumentInsert): Promise<MarketInstrumentRecord> {
    return this.repository.upsertInstrument(record);
  }

  /**
   * Get Market Quote with Freshness & Provider Fallback Rules:
   * 1. If cached quote is fresh (age < TTL) and valid ('LIVE' / 'EOD'), return it directly.
   * 2. If stale or missing, query the active market data provider.
   * 3. On provider success: calculate metrics via Decimal.js, store in DB, return fresh quote with 'LIVE'/'EOD' freshness.
   * 4. On provider failure or 'UNAVAILABLE' response:
   *    - If cached quote exists: Return cached quote with dataFreshness set to 'STALE' and marketStatus set to 'UNAVAILABLE'.
   *      NEVER label stale data as LIVE or AVAILABLE.
   *    - If no cached quote exists: Return quote record marked 'UNAVAILABLE' with null prices.
   */
  async getQuote(instrumentId: string): Promise<EnrichedMarketQuote | null> {
    const instrument = await this.repository.getInstrumentById(instrumentId);
    if (!instrument) return null;

    const cachedQuote = await this.repository.getQuoteByInstrumentId(instrumentId);

    // 1. Check cache freshness
    if (cachedQuote && cachedQuote.retrievedAt) {
      const ageMs = Date.now() - new Date(cachedQuote.retrievedAt).getTime();
      const isFresh = ageMs < this.cacheTtlMs;
      const isFreshnessValid = cachedQuote.dataFreshness === 'LIVE' || cachedQuote.dataFreshness === 'EOD';

      if (isFresh && isFreshnessValid) {
        return cachedQuote;
      }
    }

    // 2. Query provider for live update
    try {
      const providerRes = await this.provider.getQuote(instrument.symbol, instrument.exchange);

      if (providerRes.status === 'AVAILABLE' && providerRes.data && providerRes.data.lastPrice) {
        const rawQuote = providerRes.data;
        const lastPrice = rawQuote.lastPrice!;
        const previousClose = rawQuote.previousClose ?? lastPrice;
        const open = rawQuote.open ?? lastPrice;
        const high = rawQuote.high ?? lastPrice;
        const low = rawQuote.low ?? lastPrice;
        const close = rawQuote.close ?? lastPrice;

        const metrics = MarketDataService.calculateQuoteMetrics(lastPrice, previousClose);

        const upserted = await this.repository.upsertQuote({
          instrumentId: instrument.id,
          lastPrice,
          previousClose,
          open,
          high,
          low,
          close,
          volume: rawQuote.volume || 0,
          change: metrics.change,
          changePercent: metrics.changePercent,
          currency: instrument.currency,
          marketStatus: rawQuote.marketStatus || 'OPEN',
          dataFreshness: rawQuote.dataFreshness || 'LIVE',
          asOf: rawQuote.asOf ? new Date(rawQuote.asOf) : new Date(),
          retrievedAt: new Date(),
          provider: this.provider.providerId
        });

        return {
          ...upserted,
          symbol: instrument.symbol,
          displayName: instrument.displayName,
          exchange: instrument.exchange
        };
      }
    } catch {
      // Provider error - fallback to stale cache or unavailable status
    }

    // 3. Provider failed or UNAVAILABLE: Preserve valid cached data if present, but mark as STALE.
    if (cachedQuote) {
      return {
        ...cachedQuote,
        dataFreshness: 'STALE',
        marketStatus: cachedQuote.marketStatus ?? 'UNKNOWN'
      };
    }

    // 4. No cache available and provider unavailable
    return {
      id: '',
      instrumentId: instrument.id,
      lastPrice: null,
      previousClose: null,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: 0,
      change: '0.0000',
      changePercent: '0.0000',
      currency: instrument.currency,
      marketStatus: 'UNKNOWN',
      dataFreshness: 'UNAVAILABLE',
      asOf: null,
      retrievedAt: new Date().toISOString(),
      provider: this.provider.providerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      symbol: instrument.symbol,
      displayName: instrument.displayName,
      exchange: instrument.exchange
    };
  }

  async getBatchQuotes(instrumentIds: string[]): Promise<EnrichedMarketQuote[]> {
    const results: EnrichedMarketQuote[] = [];
    for (const id of instrumentIds) {
      const q = await this.getQuote(id);
      if (q) results.push(q);
    }
    return results;
  }

  async getHistoricalCandles(
    instrumentId: string,
    interval: string,
    range?: string
  ): Promise<MarketCandle[]> {
    const instrument = await this.repository.getInstrumentById(instrumentId);
    if (!instrument) return [];

    const providerRes = await this.provider.getHistoricalPrices(instrument.symbol, interval, range);
    if (providerRes.status === 'AVAILABLE' && providerRes.data.length > 0) {
      return providerRes.data;
    }

    return this.repository.getHistoricalCandles(instrumentId, interval, range);
  }

  async getMarketStatus(exchange?: MarketExchange): Promise<MarketStatus> {
    const res = await this.provider.getMarketStatus(exchange);
    return res.data;
  }
}
