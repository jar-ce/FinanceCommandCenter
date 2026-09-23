import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const watchlists = pgTable(
  'watchlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true })
  },
  (table) => [
    index('idx_watchlists_user').on(table.userId),
    index('idx_watchlists_user_status').on(table.userId, table.status)
  ]
);

export type WatchlistSelect = typeof watchlists.$inferSelect;
export type WatchlistInsert = typeof watchlists.$inferInsert;
