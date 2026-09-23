import { pgTable, uuid, text, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { khataAccounts } from './khata-accounts.js';

export const khataTransactions = pgTable(
  'khata_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => khataAccounts.id, { onDelete: 'restrict' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // MONEY_IN | MONEY_OUT
    amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
    runningBalance: numeric('running_balance', { precision: 18, scale: 4 }).notNull(),
    transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    reference: text('reference'),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | REVERSED
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversedBy: uuid('reversed_by').references(() => users.id, { onDelete: 'set null' }),
    reversalReason: text('reversal_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_khata_tx_account_id').on(table.accountId),
    index('idx_khata_tx_user_id').on(table.userId),
    index('idx_khata_tx_date').on(table.transactionDate),
    index('idx_khata_tx_status').on(table.status)
  ]
);

export type KhataTransactionRow = typeof khataTransactions.$inferSelect;
export type NewKhataTransactionRow = typeof khataTransactions.$inferInsert;
