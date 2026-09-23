import {
  MarketProviderStatus,
  MarketInstrumentRecord,
  MarketQuoteRecord,
  MarketCandle,
  MarketStatus,
  MarketSearchFilters,
  MarketExchange
} from '@finance-command-center/shared-types';

export interface MarketProviderCheckRequest {
  symbolOrId: string;
  exchange?: MarketExchange;
}

export interface IMarketDataProvider {
  readonly providerId: string;
  readonly providerName: string;

  searchInstruments(query: string, filters?: Partial<MarketSearchFilters>): Promise<{
    status: MarketProviderStatus;
    data: MarketInstrumentRecord[];
  }>;

  getInstrument(symbolOrId: string, exchange?: MarketExchange): Promise<{
    status: MarketProviderStatus;
    data: MarketInstrumentRecord | null;
  }>;

  getQuote(symbolOrId: string, exchange?: MarketExchange): Promise<{
    status: MarketProviderStatus;
    data: MarketQuoteRecord | null;
  }>;

  getBatchQuotes(symbolsOrIds: string[]): Promise<{
    status: MarketProviderStatus;
    data: Map<string, MarketQuoteRecord>;
  }>;

  getHistoricalPrices(symbolOrId: string, interval: string, range?: string): Promise<{
    status: MarketProviderStatus;
    data: MarketCandle[];
  }>;

  getMarketStatus(exchange?: MarketExchange): Promise<{
    status: MarketProviderStatus;
    data: MarketStatus;
  }>;
}
