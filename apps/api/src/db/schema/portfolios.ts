import { pgTable, uuid, varchar, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const portfolios = pgTable('portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true })
}, (table) => [
  index('idx_portfolios_user_status').on(table.userId, table.status),
  check('chk_portfolios_status', sql`${table.status} IN ('ACTIVE', 'ARCHIVED')`)
]);

export type PortfolioSelect = typeof portfolios.$inferSelect;
export type PortfolioInsert = typeof portfolios.$inferInsert;
