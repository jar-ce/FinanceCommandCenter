import {
  MarketInstrumentRecord,
  MarketQuoteRecord,
  MarketCandle,
  MarketSearchFilters
} from '@finance-command-center/shared-types';
import { MarketInstrumentInsert } from '../../db/schema/market-instruments.js';
import { MarketQuoteInsert } from '../../db/schema/market-quotes.js';

export interface EnrichedMarketQuote extends MarketQuoteRecord {
  symbol?: string;
  displayName?: string;
  exchange?: any;
}

export interface IMarketRepository {
  // Instrument Master Operations
  searchInstruments(filters: MarketSearchFilters): Promise<{ instruments: MarketInstrumentRecord[]; totalCount: number }>;
  getInstrumentById(id: string, tx?: any): Promise<MarketInstrumentRecord | null>;
  getInstrumentBySymbolAndExchange(symbol: string, exchange: string): Promise<MarketInstrumentRecord | null>;
  getInstrumentByProviderId(provider: string, providerInstrumentId: string): Promise<MarketInstrumentRecord | null>;
  upsertInstrument(record: MarketInstrumentInsert): Promise<MarketInstrumentRecord>;

  // Quote Observation Cache Operations
  getQuoteByInstrumentId(instrumentId: string): Promise<EnrichedMarketQuote | null>;
  getQuoteBySymbolAndExchange(symbol: string, exchange: string): Promise<EnrichedMarketQuote | null>;
  getBatchQuotes(instrumentIds: string[], tx?: any): Promise<EnrichedMarketQuote[]>;
  upsertQuote(record: MarketQuoteInsert): Promise<MarketQuoteRecord>;

  // Historical Price Candle Contract
  getHistoricalCandles(instrumentId: string, interval: string, range?: string): Promise<MarketCandle[]>;
}
