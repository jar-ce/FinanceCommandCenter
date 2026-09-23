import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const khataAccounts = pgTable(
  'khata_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    displayName: text('display_name').notNull(),
    phone: text('phone'),
    accountType: text('account_type').notNull().default('CUSTOMER'),
    notes: text('notes'),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true })
  },
  (table) => [
    index('idx_khata_accounts_user_id').on(table.userId),
    index('idx_khata_accounts_name').on(table.displayName),
    index('idx_khata_accounts_status').on(table.status)
  ]
);

export type KhataAccountRow = typeof khataAccounts.$inferSelect;
export type NewKhataAccountRow = typeof khataAccounts.$inferInsert;
