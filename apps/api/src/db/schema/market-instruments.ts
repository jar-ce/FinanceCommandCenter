import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const marketInstruments = pgTable('market_instruments', {
  id: uuid('id').primaryKey().defaultRandom(),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  exchange: varchar('exchange', { length: 50 }).notNull(),
  market: varchar('market', { length: 50 }).notNull().default('IN'),
  securityType: varchar('security_type', { length: 50 }).notNull().default('EQUITY'),
  currency: varchar('currency', { length: 10 }).notNull().default('INR'),
  provider: varchar('provider', { length: 50 }).notNull().default('DEVELOPMENT_STUB'),
  providerInstrumentId: varchar('provider_instrument_id', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ([
  uniqueIndex('idx_market_instruments_exch_sym').on(table.exchange, table.symbol),
  index('idx_market_instruments_symbol').on(table.symbol),
  index('idx_market_instruments_type').on(table.securityType),
  index('idx_market_instruments_status').on(table.status),
  index('idx_market_instruments_provider').on(table.provider)
]));

export type MarketInstrumentSelect = typeof marketInstruments.$inferSelect;
export type MarketInstrumentInsert = typeof marketInstruments.$inferInsert;
