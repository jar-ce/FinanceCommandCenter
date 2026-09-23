import { IWatchlistRepository } from '../repositories/IWatchlistRepository.js';
import { IMarketRepository } from '../repositories/IMarketRepository.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import {
  WatchlistRecord,
  WatchlistItemRecord,
  WatchlistWithItemsRecord
} from '@finance-command-center/shared-types';

export class WatchlistService {
  constructor(
    private watchlistRepo: IWatchlistRepository,
    private marketRepo: IMarketRepository,
    private auditRepo?: IAuditLogRepository
  ) {}

  async createWatchlist(userId: string, name: string, description?: string): Promise<WatchlistRecord> {
    const trimmedName = name ? name.trim() : '';
    if (!trimmedName) {
      throw new Error('Watchlist name is required and cannot be empty.');
    }

    const created = await this.watchlistRepo.createWatchlist({
      userId,
      name: trimmedName,
      description: description ? description.trim() : undefined
    });

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'WATCHLIST_CREATED',
        entityType: 'WATCHLIST',
        entityId: created.id,
        details: { name: created.name }
      }).catch(() => {});
    }

    return created;
  }

  async getUserWatchlists(userId: string, includeArchived: boolean = false): Promise<WatchlistRecord[]> {
    return this.watchlistRepo.getUserWatchlists(userId, includeArchived);
  }

  async getWatchlistDetails(id: string, userId: string): Promise<WatchlistWithItemsRecord> {
    const watchlist = await this.watchlistRepo.getWatchlistWithItems(id, userId);
    if (!watchlist) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    // Refresh quotes dynamically via Phase 9 IMarketRepository using batch query
    const instrumentIds = watchlist.items.map((item) => item.instrumentId);
    const batchQuotes = await this.marketRepo.getBatchQuotes(instrumentIds);
    const quoteMap = new Map(batchQuotes.map((q) => [q.instrumentId, q]));

    const enrichedItems: WatchlistItemRecord[] = watchlist.items.map((item) => ({
      ...item,
      quote: quoteMap.get(item.instrumentId) || item.quote
    }));

    return {
      ...watchlist,
      items: enrichedItems
    };
  }

  async updateWatchlist(id: string, userId: string, data: { name?: string; description?: string }): Promise<WatchlistRecord> {
    if (data.name !== undefined && (!data.name || !data.name.trim())) {
      throw new Error('Watchlist name cannot be empty.');
    }

    const updated = await this.watchlistRepo.updateWatchlist(id, userId, {
      name: data.name ? data.name.trim() : undefined,
      description: data.description !== undefined ? data.description.trim() : undefined
    });

    if (!updated) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'WATCHLIST_RENAMED',
        entityType: 'WATCHLIST',
        entityId: updated.id,
        details: { name: updated.name }
      }).catch(() => {});
    }

    return updated;
  }

  async archiveWatchlist(id: string, userId: string): Promise<WatchlistRecord> {
    const archived = await this.watchlistRepo.archiveWatchlist(id, userId);
    if (!archived) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'WATCHLIST_ARCHIVED',
        entityType: 'WATCHLIST',
        entityId: archived.id,
        details: { name: archived.name }
      }).catch(() => {});
    }

    return archived;
  }

  async restoreWatchlist(id: string, userId: string): Promise<WatchlistRecord> {
    const restored = await this.watchlistRepo.restoreWatchlist(id, userId);
    if (!restored) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'WATCHLIST_RESTORED',
        entityType: 'WATCHLIST',
        entityId: restored.id,
        details: { name: restored.name }
      }).catch(() => {});
    }

    return restored;
  }

  async addItem(watchlistId: string, instrumentId: string, userId: string): Promise<WatchlistItemRecord> {
    // 1. Verify Watchlist exists and belongs to user
    const watchlist = await this.watchlistRepo.getWatchlistById(watchlistId, userId);
    if (!watchlist) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    // 2. Reject adding items to archived watchlist
    if (watchlist.status === 'ARCHIVED') {
      throw new Error('ARCHIVED_WATCHLIST_MUTATION_MUTED');
    }

    // 3. Verify target Instrument exists in canonical market_instruments
    const instrument = await this.marketRepo.getInstrumentById(instrumentId);
    if (!instrument) {
      throw new Error('INSTRUMENT_NOT_FOUND');
    }

    // 4. Duplicate membership check
    const isDuplicate = await this.watchlistRepo.isItemInWatchlist(watchlistId, instrumentId);
    if (isDuplicate) {
      throw new Error('DUPLICATE_WATCHLIST_ITEM');
    }

    // 5. Add Item
    const item = await this.watchlistRepo.addItem(watchlistId, instrumentId);

    // Fetch live quote for enrichment
    const liveQuote = await this.marketRepo.getQuoteByInstrumentId(instrumentId);

    const enrichedItem: WatchlistItemRecord = {
      ...item,
      instrument,
      quote: liveQuote || undefined
    };

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'WATCHLIST_ITEM_ADDED',
        entityType: 'WATCHLIST_ITEM',
        entityId: item.id,
        details: { watchlistId, instrumentId, symbol: instrument.symbol }
      }).catch(() => {});
    }

    return enrichedItem;
  }

  async removeItem(watchlistId: string, instrumentId: string, userId: string): Promise<boolean> {
    // 1. Verify Watchlist ownership
    const watchlist = await this.watchlistRepo.getWatchlistById(watchlistId, userId);
    if (!watchlist) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    // 2. Reject modifying archived watchlist
    if (watchlist.status === 'ARCHIVED') {
      throw new Error('ARCHIVED_WATCHLIST_MUTATION_MUTED');
    }

    const removed = await this.watchlistRepo.removeItem(watchlistId, instrumentId);
    if (!removed) {
      throw new Error('WATCHLIST_ITEM_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'WATCHLIST_ITEM_REMOVED',
        entityType: 'WATCHLIST_ITEM',
        entityId: watchlistId,
        details: { watchlistId, instrumentId }
      }).catch(() => {});
    }

    return true;
  }

  async reorderItems(watchlistId: string, itemIds: string[], userId: string): Promise<boolean> {
    const watchlist = await this.watchlistRepo.getWatchlistById(watchlistId, userId);
    if (!watchlist) {
      throw new Error('WATCHLIST_NOT_FOUND');
    }

    if (watchlist.status === 'ARCHIVED') {
      throw new Error('ARCHIVED_WATCHLIST_MUTATION_MUTED');
    }

    return this.watchlistRepo.reorderItems(watchlistId, itemIds);
  }
}
