import { pgTable, uuid, varchar, numeric, bigint, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { marketInstruments } from './market-instruments.js';

export const marketQuotes = pgTable('market_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  instrumentId: uuid('instrument_id')
    .references(() => marketInstruments.id, { onDelete: 'restrict' })
    .notNull(),
  lastPrice: numeric('last_price', { precision: 18, scale: 4 }),
  previousClose: numeric('previous_close', { precision: 18, scale: 4 }),
  open: numeric('open', { precision: 18, scale: 4 }),
  high: numeric('high', { precision: 18, scale: 4 }),
  low: numeric('low', { precision: 18, scale: 4 }),
  close: numeric('close', { precision: 18, scale: 4 }),
  volume: bigint('volume', { mode: 'number' }).notNull().default(0),
  change: numeric('change', { precision: 18, scale: 4 }).notNull().default('0.0000'),
  changePercent: numeric('change_percent', { precision: 8, scale: 4 }).notNull().default('0.0000'),
  currency: varchar('currency', { length: 10 }).notNull().default('INR'),
  marketStatus: varchar('market_status', { length: 50 }).notNull().default('CLOSED'),
  dataFreshness: varchar('data_freshness', { length: 50 }).notNull().default('EOD'),
  asOf: timestamp('as_of', { withTimezone: true }),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).defaultNow().notNull(),
  provider: varchar('provider', { length: 50 }).notNull().default('DEVELOPMENT_STUB'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ([
  uniqueIndex('idx_market_quotes_instrument').on(table.instrumentId),
  index('idx_market_quotes_freshness').on(table.dataFreshness),
  index('idx_market_quotes_provider').on(table.provider)
]));

export type MarketQuoteSelect = typeof marketQuotes.$inferSelect;
export type MarketQuoteInsert = typeof marketQuotes.$inferInsert;
