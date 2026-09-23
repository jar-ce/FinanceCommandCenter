import { IMarketDataProvider } from '../../domain/providers/IMarketDataProvider.js';
import {
  MarketProviderStatus,
  MarketInstrumentRecord,
  MarketQuoteRecord,
  MarketCandle,
  MarketStatus,
  MarketSearchFilters,
  MarketExchange
} from '@finance-command-center/shared-types';

/**
 * DevelopmentMarketDataProvider
 *
 * Implements zero-fake-data policy for Phase 9:
 * Development provider does NOT fabricate random stock prices or fake tickers.
 * It strictly returns status: 'UNAVAILABLE' with empty/null data payloads.
 */
export class DevelopmentMarketDataProvider implements IMarketDataProvider {
  readonly providerId = 'DEV_MARKET_PROVIDER';
  readonly providerName = 'Development (No Live Data) Market Data Provider';

  async searchInstruments(
    _query: string,
    _filters?: Partial<MarketSearchFilters>
  ): Promise<{ status: MarketProviderStatus; data: MarketInstrumentRecord[] }> {
    return {
      status: 'UNAVAILABLE',
      data: []
    };
  }

  async getInstrument(
    _symbolOrId: string,
    _exchange?: MarketExchange
  ): Promise<{ status: MarketProviderStatus; data: MarketInstrumentRecord | null }> {
    return {
      status: 'UNAVAILABLE',
      data: null
    };
  }

  async getQuote(
    _symbolOrId: string,
    _exchange?: MarketExchange
  ): Promise<{ status: MarketProviderStatus; data: MarketQuoteRecord | null }> {
    return {
      status: 'UNAVAILABLE',
      data: null
    };
  }

  async getBatchQuotes(
    _symbolsOrIds: string[]
  ): Promise<{ status: MarketProviderStatus; data: Map<string, MarketQuoteRecord> }> {
    return {
      status: 'UNAVAILABLE',
      data: new Map()
    };
  }

  async getHistoricalPrices(
    _symbolOrId: string,
    _interval: string,
    _range?: string
  ): Promise<{ status: MarketProviderStatus; data: MarketCandle[] }> {
    return {
      status: 'UNAVAILABLE',
      data: []
    };
  }

  async getMarketStatus(
    _exchange?: MarketExchange
  ): Promise<{ status: MarketProviderStatus; data: MarketStatus }> {
    return {
      status: 'UNAVAILABLE',
      data: {
        exchange: _exchange || 'NSE',
        isOpen: false,
        marketState: 'CLOSED',
        lastUpdated: new Date().toISOString()
      }
    };
  }
}
