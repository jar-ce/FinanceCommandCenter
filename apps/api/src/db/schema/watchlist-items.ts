import { pgTable, uuid, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { watchlists } from './watchlists.js';
import { marketInstruments } from './market-instruments.js';

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    watchlistId: uuid('watchlist_id')
      .references(() => watchlists.id, { onDelete: 'cascade' })
      .notNull(),
    instrumentId: uuid('instrument_id')
      .references(() => marketInstruments.id, { onDelete: 'restrict' })
      .notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('idx_watchlist_items_unique').on(table.watchlistId, table.instrumentId),
    index('idx_watchlist_items_watchlist').on(table.watchlistId),
    index('idx_watchlist_items_instrument').on(table.instrumentId)
  ]
);

export type WatchlistItemSelect = typeof watchlistItems.$inferSelect;
export type WatchlistItemInsert = typeof watchlistItems.$inferInsert;
