import {
  WatchlistRecord,
  WatchlistItemRecord,
  WatchlistWithItemsRecord
} from '@finance-command-center/shared-types';

export interface IWatchlistRepository {
  createWatchlist(data: { userId: string; name: string; description?: string }): Promise<WatchlistRecord>;
  getWatchlistById(id: string, userId: string): Promise<WatchlistRecord | null>;
  getWatchlistWithItems(id: string, userId: string): Promise<WatchlistWithItemsRecord | null>;
  getUserWatchlists(userId: string, includeArchived?: boolean): Promise<WatchlistRecord[]>;
  updateWatchlist(id: string, userId: string, data: { name?: string; description?: string }): Promise<WatchlistRecord | null>;
  archiveWatchlist(id: string, userId: string): Promise<WatchlistRecord | null>;
  restoreWatchlist(id: string, userId: string): Promise<WatchlistRecord | null>;
  
  addItem(watchlistId: string, instrumentId: string): Promise<WatchlistItemRecord>;
  removeItem(watchlistId: string, instrumentId: string): Promise<boolean>;
  getWatchlistItems(watchlistId: string): Promise<WatchlistItemRecord[]>;
  reorderItems(watchlistId: string, itemIds: string[]): Promise<boolean>;
  isItemInWatchlist(watchlistId: string, instrumentId: string): Promise<boolean>;
}
