import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { watchlists, WatchlistSelect } from '../../db/schema/watchlists.js';
import { watchlistItems } from '../../db/schema/watchlist-items.js';
import { marketInstruments } from '../../db/schema/market-instruments.js';
import { marketQuotes } from '../../db/schema/market-quotes.js';
import { IWatchlistRepository } from '../../domain/repositories/IWatchlistRepository.js';
import {
  WatchlistRecord,
  WatchlistItemRecord,
  WatchlistWithItemsRecord,
  WatchlistStatus
} from '@finance-command-center/shared-types';

export class DrizzleWatchlistRepository implements IWatchlistRepository {
  private mapWatchlistRow(row: WatchlistSelect, itemCount?: number): WatchlistRecord {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      status: row.status as WatchlistStatus,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      itemCount
    };
  }

  async createWatchlist(data: { userId: string; name: string; description?: string }): Promise<WatchlistRecord> {
    const db = await getDb();
    const [inserted] = await db
      .insert(watchlists)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description || null,
        status: 'ACTIVE',
        sortOrder: 0
      })
      .returning();

    return this.mapWatchlistRow(inserted, 0);
  }

  async getWatchlistById(id: string, userId: string): Promise<WatchlistRecord | null> {
    const db = await getDb();
    const rows = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));

    if (rows.length === 0) return null;
    
    // Count items
    const items = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(eq(watchlistItems.watchlistId, id));

    return this.mapWatchlistRow(rows[0], items.length);
  }

  async getWatchlistWithItems(id: string, userId: string): Promise<WatchlistWithItemsRecord | null> {
    const db = await getDb();
    const watchlistRows = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));

    if (watchlistRows.length === 0) return null;

    const watchlist = watchlistRows[0];

    // Query items joined with market_instruments and market_quotes
    const itemRows = await db
      .select({
        item: watchlistItems,
        instrument: marketInstruments,
        quote: marketQuotes
      })
      .from(watchlistItems)
      .innerJoin(marketInstruments, eq(watchlistItems.instrumentId, marketInstruments.id))
      .leftJoin(marketQuotes, eq(watchlistItems.instrumentId, marketQuotes.instrumentId))
      .where(eq(watchlistItems.watchlistId, id))
      .orderBy(asc(watchlistItems.sortOrder), asc(watchlistItems.createdAt));

    const mappedItems: WatchlistItemRecord[] = itemRows.map(({ item, instrument, quote }) => ({
      id: item.id,
      watchlistId: item.watchlistId,
      instrumentId: item.instrumentId,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      instrument: {
        id: instrument.id,
        symbol: instrument.symbol,
        displayName: instrument.displayName,
        exchange: instrument.exchange as any,
        market: instrument.market,
        securityType: instrument.securityType as any,
        currency: instrument.currency,
        provider: instrument.provider,
        providerInstrumentId: instrument.providerInstrumentId,
        status: instrument.status as any,
        createdAt: instrument.createdAt.toISOString(),
        updatedAt: instrument.updatedAt.toISOString()
      },
      quote: quote ? {
        id: quote.id,
        instrumentId: quote.instrumentId,
        lastPrice: quote.lastPrice,
        previousClose: quote.previousClose,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
        change: quote.change,
        changePercent: quote.changePercent,
        currency: quote.currency,
        marketStatus: quote.marketStatus as any,
        dataFreshness: quote.dataFreshness as any,
        asOf: quote.asOf ? quote.asOf.toISOString() : null,
        retrievedAt: quote.retrievedAt.toISOString(),
        provider: quote.provider,
        createdAt: quote.createdAt.toISOString(),
        updatedAt: quote.updatedAt.toISOString(),
        symbol: instrument.symbol,
        displayName: instrument.displayName,
        exchange: instrument.exchange as any
      } : undefined
    }));

    return {
      ...this.mapWatchlistRow(watchlist, mappedItems.length),
      items: mappedItems
    };
  }

  async getUserWatchlists(userId: string, includeArchived: boolean = false): Promise<WatchlistRecord[]> {
    const db = await getDb();
    const conditions = [eq(watchlists.userId, userId)];

    if (!includeArchived) {
      conditions.push(eq(watchlists.status, 'ACTIVE'));
    }

    const rows = await db
      .select()
      .from(watchlists)
      .where(and(...conditions))
      .orderBy(asc(watchlists.sortOrder), asc(watchlists.createdAt));

    const result: WatchlistRecord[] = [];
    for (const row of rows) {
      const items = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .where(eq(watchlistItems.watchlistId, row.id));

      result.push(this.mapWatchlistRow(row, items.length));
    }

    return result;
  }

  async updateWatchlist(id: string, userId: string, data: { name?: string; description?: string }): Promise<WatchlistRecord | null> {
    const db = await getDb();
    const existing = await this.getWatchlistById(id, userId);
    if (!existing) return null;

    const updateFields: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;

    const [updated] = await db
      .update(watchlists)
      .set(updateFields)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();

    return this.mapWatchlistRow(updated, existing.itemCount);
  }

  async archiveWatchlist(id: string, userId: string): Promise<WatchlistRecord | null> {
    const db = await getDb();
    const existing = await this.getWatchlistById(id, userId);
    if (!existing) return null;

    const [updated] = await db
      .update(watchlists)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();

    return this.mapWatchlistRow(updated, existing.itemCount);
  }

  async restoreWatchlist(id: string, userId: string): Promise<WatchlistRecord | null> {
    const db = await getDb();
    const existing = await this.getWatchlistById(id, userId);
    if (!existing) return null;

    const [updated] = await db
      .update(watchlists)
      .set({
        status: 'ACTIVE',
        archivedAt: null,
        updatedAt: new Date()
      })
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();

    return this.mapWatchlistRow(updated, existing.itemCount);
  }

  async addItem(watchlistId: string, instrumentId: string): Promise<WatchlistItemRecord> {
    const db = await getDb();
    
    // Calculate next sort order
    const existingItems = await db
      .select({ sortOrder: watchlistItems.sortOrder })
      .from(watchlistItems)
      .where(eq(watchlistItems.watchlistId, watchlistId))
      .orderBy(asc(watchlistItems.sortOrder));

    const nextOrder = existingItems.length > 0
      ? Math.max(...existingItems.map(i => i.sortOrder)) + 1
      : 0;

    const [inserted] = await db
      .insert(watchlistItems)
      .values({
        watchlistId,
        instrumentId,
        sortOrder: nextOrder
      })
      .returning();

    return {
      id: inserted.id,
      watchlistId: inserted.watchlistId,
      instrumentId: inserted.instrumentId,
      sortOrder: inserted.sortOrder,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString()
    };
  }

  async removeItem(watchlistId: string, instrumentId: string): Promise<boolean> {
    const db = await getDb();
    const deleted = await db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.watchlistId, watchlistId), eq(watchlistItems.instrumentId, instrumentId)))
      .returning({ id: watchlistItems.id });

    return deleted.length > 0;
  }

  async getWatchlistItems(watchlistId: string): Promise<WatchlistItemRecord[]> {
    const db = await getDb();
    const itemRows = await db
      .select({
        item: watchlistItems,
        instrument: marketInstruments,
        quote: marketQuotes
      })
      .from(watchlistItems)
      .innerJoin(marketInstruments, eq(watchlistItems.instrumentId, marketInstruments.id))
      .leftJoin(marketQuotes, eq(watchlistItems.instrumentId, marketQuotes.instrumentId))
      .where(eq(watchlistItems.watchlistId, watchlistId))
      .orderBy(asc(watchlistItems.sortOrder), asc(watchlistItems.createdAt));

    return itemRows.map(({ item, instrument, quote }) => ({
      id: item.id,
      watchlistId: item.watchlistId,
      instrumentId: item.instrumentId,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      instrument: {
        id: instrument.id,
        symbol: instrument.symbol,
        displayName: instrument.displayName,
        exchange: instrument.exchange as any,
        market: instrument.market,
        securityType: instrument.securityType as any,
        currency: instrument.currency,
        provider: instrument.provider,
        providerInstrumentId: instrument.providerInstrumentId,
        status: instrument.status as any,
        createdAt: instrument.createdAt.toISOString(),
        updatedAt: instrument.updatedAt.toISOString()
      },
      quote: quote ? {
        id: quote.id,
        instrumentId: quote.instrumentId,
        lastPrice: quote.lastPrice,
        previousClose: quote.previousClose,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
        change: quote.change,
        changePercent: quote.changePercent,
        currency: quote.currency,
        marketStatus: quote.marketStatus as any,
        dataFreshness: quote.dataFreshness as any,
        asOf: quote.asOf ? quote.asOf.toISOString() : null,
        retrievedAt: quote.retrievedAt.toISOString(),
        provider: quote.provider,
        createdAt: quote.createdAt.toISOString(),
        updatedAt: quote.updatedAt.toISOString(),
        symbol: instrument.symbol,
        displayName: instrument.displayName,
        exchange: instrument.exchange as any
      } : undefined
    }));
  }

  async reorderItems(watchlistId: string, itemIds: string[]): Promise<boolean> {
    const db = await getDb();
    for (let index = 0; index < itemIds.length; index++) {
      await db
        .update(watchlistItems)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(and(eq(watchlistItems.watchlistId, watchlistId), eq(watchlistItems.id, itemIds[index])));
    }
    return true;
  }

  async isItemInWatchlist(watchlistId: string, instrumentId: string): Promise<boolean> {
    const db = await getDb();
    const rows = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(and(eq(watchlistItems.watchlistId, watchlistId), eq(watchlistItems.instrumentId, instrumentId)));

    return rows.length > 0;
  }
}
