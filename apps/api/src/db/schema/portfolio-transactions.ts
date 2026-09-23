import { pgTable, uuid, varchar, numeric, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { portfolios } from './portfolios.js';
import { marketInstruments } from './market-instruments.js';

export const portfolioTransactions = pgTable('portfolio_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'restrict' }), // ON DELETE RESTRICT for history protection
  instrumentId: uuid('instrument_id').notNull().references(() => marketInstruments.id, { onDelete: 'restrict' }),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(), // BUY | SELL
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  price: numeric('price', { precision: 18, scale: 4 }).notNull(),
  grossAmount: numeric('gross_amount', { precision: 18, scale: 4 }).notNull(),
  charges: numeric('charges', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  taxes: numeric('taxes', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 4 }).notNull(),
  externalReference: varchar('external_reference', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('idx_portfolio_tx_portfolio').on(table.portfolioId),
  index('idx_portfolio_tx_instrument').on(table.instrumentId),
  index('idx_portfolio_tx_date').on(table.transactionDate),
  check('chk_portfolio_tx_type', sql`${table.transactionType} IN ('BUY', 'SELL')`),
  check('chk_portfolio_tx_qty', sql`${table.quantity} > 0`),
  check('chk_portfolio_tx_price', sql`${table.price} >= 0`),
  check('chk_portfolio_tx_charges', sql`${table.charges} >= 0`),
  check('chk_portfolio_tx_taxes', sql`${table.taxes} >= 0`),
  check('chk_portfolio_tx_gross', sql`${table.grossAmount} >= 0`),
  check('chk_portfolio_tx_total', sql`${table.totalAmount} >= 0`)
]);

export type PortfolioTransactionSelect = typeof portfolioTransactions.$inferSelect;
export type PortfolioTransactionInsert = typeof portfolioTransactions.$inferInsert;
