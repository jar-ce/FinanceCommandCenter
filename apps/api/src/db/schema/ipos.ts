import { pgTable, uuid, varchar, numeric, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const ipos = pgTable('ipos', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull().default('DEVELOPMENT_STUB'),
  source: varchar('source', { length: 255 }).notNull().default('System Default Feed'),
  issuerName: varchar('issuer_name', { length: 255 }).notNull(),
  ipoName: varchar('ipo_name', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 50 }),
  exchange: varchar('exchange', { length: 50 }).notNull().default('UNKNOWN'),
  securityType: varchar('security_type', { length: 50 }).notNull().default('EQUITY'),
  issueType: varchar('issue_type', { length: 50 }).notNull().default('MAINBOARD'),
  status: varchar('status', { length: 50 }).notNull().default('UPCOMING'),
  openDate: timestamp('open_date', { withTimezone: true }),
  closeDate: timestamp('close_date', { withTimezone: true }),
  listingDate: timestamp('listing_date', { withTimezone: true }),
  faceValue: numeric('face_value', { precision: 18, scale: 4 }),
  priceBandLow: numeric('price_band_low', { precision: 18, scale: 4 }),
  priceBandHigh: numeric('price_band_high', { precision: 18, scale: 4 }),
  lotSize: integer('lot_size'),
  issueSize: numeric('issue_size', { precision: 18, scale: 4 }),
  freshIssueSize: numeric('fresh_issue_size', { precision: 18, scale: 4 }),
  offerForSaleSize: numeric('offer_for_sale_size', { precision: 18, scale: 4 }),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  providerExternalIdIdx: uniqueIndex('ipos_provider_external_id_idx').on(table.provider, table.externalId),
  statusIdx: index('ipos_status_idx').on(table.status),
  exchangeIdx: index('ipos_exchange_idx').on(table.exchange),
  issueTypeIdx: index('ipos_issue_type_idx').on(table.issueType),
  openDateIdx: index('ipos_open_date_idx').on(table.openDate)
}));

export type IPOSelect = typeof ipos.$inferSelect;
export type IPOInsert = typeof ipos.$inferInsert;
