import { eq, and, or, ilike, count, desc } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { marketInstruments, MarketInstrumentInsert } from '../../db/schema/market-instruments.js';
import { marketQuotes, MarketQuoteInsert } from '../../db/schema/market-quotes.js';
import {
  IMarketRepository,
  EnrichedMarketQuote
} from '../../domain/repositories/IMarketRepository.js';
import {
  MarketInstrumentRecord,
  MarketQuoteRecord,
  MarketCandle,
  MarketSearchFilters
} from '@finance-command-center/shared-types';

export class DrizzleMarketRepository implements IMarketRepository {
  async searchInstruments(filters: MarketSearchFilters): Promise<{ instruments: MarketInstrumentRecord[]; totalCount: number }> {
    const db = await getDb();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (filters.status) {
      conditions.push(eq(marketInstruments.status, filters.status));
    }
    if (filters.exchange) {
      conditions.push(eq(marketInstruments.exchange, filters.exchange));
    }
    if (filters.securityType) {
      conditions.push(eq(marketInstruments.securityType, filters.securityType));
    }
    if (filters.query && filters.query.trim()) {
      const term = `%${filters.query.trim()}%`;
      conditions.push(
        or(
          ilike(marketInstruments.symbol, term),
          ilike(marketInstruments.displayName, term),
          ilike(marketInstruments.providerInstrumentId, term)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(marketInstruments)
      .where(whereClause);

    const rows = await db
      .select({
        id: marketInstruments.id,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange,
        market: marketInstruments.market,
        securityType: marketInstruments.securityType,
        currency: marketInstruments.currency,
        provider: marketInstruments.provider,
        providerInstrumentId: marketInstruments.providerInstrumentId,
        status: marketInstruments.status,
        createdAt: marketInstruments.createdAt,
        updatedAt: marketInstruments.updatedAt
      })
      .from(marketInstruments)
      .where(whereClause)
      .orderBy(marketInstruments.symbol)
      .limit(limit)
      .offset(offset);

    const instruments: MarketInstrumentRecord[] = rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      displayName: r.displayName,
      exchange: r.exchange as any,
      market: r.market,
      securityType: r.securityType as any,
      currency: r.currency,
      provider: r.provider,
      providerInstrumentId: r.providerInstrumentId || null,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    return { instruments, totalCount: Number(totalCount) };
  }

  async getInstrumentById(id: string, tx?: any): Promise<MarketInstrumentRecord | null> {
    const db = tx || (await getDb());
    const [row] = await db
      .select({
        id: marketInstruments.id,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange,
        market: marketInstruments.market,
        securityType: marketInstruments.securityType,
        currency: marketInstruments.currency,
        provider: marketInstruments.provider,
        providerInstrumentId: marketInstruments.providerInstrumentId,
        status: marketInstruments.status,
        createdAt: marketInstruments.createdAt,
        updatedAt: marketInstruments.updatedAt
      })
      .from(marketInstruments)
      .where(eq(marketInstruments.id, id))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      symbol: row.symbol,
      displayName: row.displayName,
      exchange: row.exchange as any,
      market: row.market,
      securityType: row.securityType as any,
      currency: row.currency,
      provider: row.provider,
      providerInstrumentId: row.providerInstrumentId || null,
      status: row.status as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async getInstrumentBySymbolAndExchange(symbol: string, exchange: string): Promise<MarketInstrumentRecord | null> {
    const db = await getDb();
    const [row] = await db
      .select({
        id: marketInstruments.id,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange,
        market: marketInstruments.market,
        securityType: marketInstruments.securityType,
        currency: marketInstruments.currency,
        provider: marketInstruments.provider,
        providerInstrumentId: marketInstruments.providerInstrumentId,
        status: marketInstruments.status,
        createdAt: marketInstruments.createdAt,
        updatedAt: marketInstruments.updatedAt
      })
      .from(marketInstruments)
      .where(and(eq(marketInstruments.symbol, symbol.toUpperCase()), eq(marketInstruments.exchange, exchange.toUpperCase())))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      symbol: row.symbol,
      displayName: row.displayName,
      exchange: row.exchange as any,
      market: row.market,
      securityType: row.securityType as any,
      currency: row.currency,
      provider: row.provider,
      providerInstrumentId: row.providerInstrumentId || null,
      status: row.status as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async getInstrumentByProviderId(provider: string, providerInstrumentId: string): Promise<MarketInstrumentRecord | null> {
    const db = await getDb();
    const [row] = await db
      .select({
        id: marketInstruments.id,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange,
        market: marketInstruments.market,
        securityType: marketInstruments.securityType,
        currency: marketInstruments.currency,
        provider: marketInstruments.provider,
        providerInstrumentId: marketInstruments.providerInstrumentId,
        status: marketInstruments.status,
        createdAt: marketInstruments.createdAt,
        updatedAt: marketInstruments.updatedAt
      })
      .from(marketInstruments)
      .where(and(eq(marketInstruments.provider, provider), eq(marketInstruments.providerInstrumentId, providerInstrumentId)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      symbol: row.symbol,
      displayName: row.displayName,
      exchange: row.exchange as any,
      market: row.market,
      securityType: row.securityType as any,
      currency: row.currency,
      provider: row.provider,
      providerInstrumentId: row.providerInstrumentId || null,
      status: row.status as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async upsertInstrument(record: MarketInstrumentInsert): Promise<MarketInstrumentRecord> {
    const db = await getDb();

    const sanitized = {
      symbol: record.symbol.toUpperCase(),
      displayName: record.displayName,
      exchange: record.exchange.toUpperCase(),
      market: record.market ?? 'IN',
      securityType: record.securityType ?? 'EQUITY',
      currency: record.currency ?? 'INR',
      provider: record.provider ?? 'DEVELOPMENT_STUB',
      providerInstrumentId: record.providerInstrumentId ?? null,
      status: record.status ?? 'ACTIVE',
      updatedAt: new Date()
    };

    const [inserted] = await db
      .insert(marketInstruments)
      .values(sanitized)
      .onConflictDoUpdate({
        target: [marketInstruments.exchange, marketInstruments.symbol],
        set: {
          displayName: sanitized.displayName,
          market: sanitized.market,
          securityType: sanitized.securityType,
          currency: sanitized.currency,
          provider: sanitized.provider,
          providerInstrumentId: sanitized.providerInstrumentId,
          status: sanitized.status,
          updatedAt: new Date()
        }
      })
      .returning();

    return {
      id: inserted.id,
      symbol: inserted.symbol,
      displayName: inserted.displayName,
      exchange: inserted.exchange as any,
      market: inserted.market,
      securityType: inserted.securityType as any,
      currency: inserted.currency,
      provider: inserted.provider,
      providerInstrumentId: inserted.providerInstrumentId || null,
      status: inserted.status as any,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString()
    };
  }

  async getQuoteByInstrumentId(instrumentId: string): Promise<EnrichedMarketQuote | null> {
    const db = await getDb();
    const [row] = await db
      .select({
        id: marketQuotes.id,
        instrumentId: marketQuotes.instrumentId,
        lastPrice: marketQuotes.lastPrice,
        previousClose: marketQuotes.previousClose,
        open: marketQuotes.open,
        high: marketQuotes.high,
        low: marketQuotes.low,
        close: marketQuotes.close,
        volume: marketQuotes.volume,
        change: marketQuotes.change,
        changePercent: marketQuotes.changePercent,
        currency: marketQuotes.currency,
        marketStatus: marketQuotes.marketStatus,
        dataFreshness: marketQuotes.dataFreshness,
        asOf: marketQuotes.asOf,
        retrievedAt: marketQuotes.retrievedAt,
        provider: marketQuotes.provider,
        createdAt: marketQuotes.createdAt,
        updatedAt: marketQuotes.updatedAt,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange
      })
      .from(marketQuotes)
      .leftJoin(marketInstruments, eq(marketQuotes.instrumentId, marketInstruments.id))
      .where(eq(marketQuotes.instrumentId, instrumentId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      instrumentId: row.instrumentId,
      lastPrice: row.lastPrice,
      previousClose: row.previousClose,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      change: row.change,
      changePercent: row.changePercent,
      currency: row.currency,
      marketStatus: row.marketStatus as any,
      dataFreshness: row.dataFreshness as any,
      asOf: row.asOf ? row.asOf.toISOString() : null,
      retrievedAt: row.retrievedAt.toISOString(),
      provider: row.provider,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      symbol: row.symbol || undefined,
      displayName: row.displayName || undefined,
      exchange: row.exchange as any
    };
  }

  async getQuoteBySymbolAndExchange(symbol: string, exchange: string): Promise<EnrichedMarketQuote | null> {
    const inst = await this.getInstrumentBySymbolAndExchange(symbol, exchange);
    if (!inst) return null;
    return this.getQuoteByInstrumentId(inst.id);
  }

  async getBatchQuotes(instrumentIds: string[], tx?: any): Promise<EnrichedMarketQuote[]> {
    if (instrumentIds.length === 0) return [];
    const db = tx || (await getDb());
    const rows = await db
      .select({
        id: marketQuotes.id,
        instrumentId: marketQuotes.instrumentId,
        lastPrice: marketQuotes.lastPrice,
        previousClose: marketQuotes.previousClose,
        open: marketQuotes.open,
        high: marketQuotes.high,
        low: marketQuotes.low,
        close: marketQuotes.close,
        volume: marketQuotes.volume,
        change: marketQuotes.change,
        changePercent: marketQuotes.changePercent,
        currency: marketQuotes.currency,
        marketStatus: marketQuotes.marketStatus,
        dataFreshness: marketQuotes.dataFreshness,
        asOf: marketQuotes.asOf,
        retrievedAt: marketQuotes.retrievedAt,
        provider: marketQuotes.provider,
        createdAt: marketQuotes.createdAt,
        updatedAt: marketQuotes.updatedAt,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange
      })
      .from(marketQuotes)
      .leftJoin(marketInstruments, eq(marketQuotes.instrumentId, marketInstruments.id))
      .where(or(...instrumentIds.map(id => eq(marketQuotes.instrumentId, id))))
      .orderBy(desc(marketQuotes.updatedAt));

    return rows.map((r: any) => ({
      id: r.id,
      instrumentId: r.instrumentId,
      lastPrice: r.lastPrice,
      previousClose: r.previousClose,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      change: r.change,
      changePercent: r.changePercent,
      currency: r.currency,
      marketStatus: r.marketStatus as any,
      dataFreshness: r.dataFreshness as any,
      asOf: r.asOf ? r.asOf.toISOString() : null,
      retrievedAt: r.retrievedAt.toISOString(),
      provider: r.provider,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      symbol: r.symbol || undefined,
      displayName: r.displayName || undefined,
      exchange: r.exchange as any
    }));
  }

  async upsertQuote(record: MarketQuoteInsert): Promise<MarketQuoteRecord> {
    const db = await getDb();

    const sanitized = {
      instrumentId: record.instrumentId,
      lastPrice: record.lastPrice,
      previousClose: record.previousClose,
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: record.volume ?? 0,
      change: record.change,
      changePercent: record.changePercent,
      currency: record.currency ?? 'INR',
      marketStatus: record.marketStatus ?? 'CLOSED',
      dataFreshness: record.dataFreshness ?? 'EOD',
      asOf: record.asOf ?? null,
      retrievedAt: record.retrievedAt ?? new Date(),
      provider: record.provider ?? 'DEVELOPMENT_STUB',
      updatedAt: new Date()
    };

    const [inserted] = await db
      .insert(marketQuotes)
      .values(sanitized)
      .onConflictDoUpdate({
        target: [marketQuotes.instrumentId],
        set: {
          lastPrice: sanitized.lastPrice,
          previousClose: sanitized.previousClose,
          open: sanitized.open,
          high: sanitized.high,
          low: sanitized.low,
          close: sanitized.close,
          volume: sanitized.volume,
          change: sanitized.change,
          changePercent: sanitized.changePercent,
          currency: sanitized.currency,
          marketStatus: sanitized.marketStatus,
          dataFreshness: sanitized.dataFreshness,
          asOf: sanitized.asOf,
          retrievedAt: sanitized.retrievedAt,
          provider: sanitized.provider,
          updatedAt: new Date()
        }
      })
      .returning();

    return {
      id: inserted.id,
      instrumentId: inserted.instrumentId,
      lastPrice: inserted.lastPrice,
      previousClose: inserted.previousClose,
      open: inserted.open,
      high: inserted.high,
      low: inserted.low,
      close: inserted.close,
      volume: inserted.volume,
      change: inserted.change,
      changePercent: inserted.changePercent,
      currency: inserted.currency,
      marketStatus: inserted.marketStatus as any,
      dataFreshness: inserted.dataFreshness as any,
      asOf: inserted.asOf ? inserted.asOf.toISOString() : null,
      retrievedAt: inserted.retrievedAt.toISOString(),
      provider: inserted.provider,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString()
    };
  }

  async getHistoricalCandles(_instrumentId: string, _interval: string, _range?: string): Promise<MarketCandle[]> {
    // Structural contract interface for Phase 10 consumption
    return [];
  }
}
