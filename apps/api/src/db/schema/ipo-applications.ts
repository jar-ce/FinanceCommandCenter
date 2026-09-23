import { pgTable, uuid, varchar, numeric, integer, timestamp, index, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { ipos } from './ipos.js';
import { khataAccounts } from './khata-accounts.js';

export const ipoApplications = pgTable('ipo_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  ipoId: uuid('ipo_id')
    .references(() => ipos.id, { onDelete: 'restrict' })
    .notNull(),
  applicationAccountId: uuid('application_account_id')
    .references(() => khataAccounts.id, { onDelete: 'restrict' })
    .notNull(),
  applicationDate: timestamp('application_date', { withTimezone: true }).notNull(),
  lotsApplied: integer('lots_applied').notNull(),
  quantityApplied: integer('quantity_applied').notNull(),
  applicationAmount: numeric('application_amount', { precision: 18, scale: 4 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('SUBMITTED'),
  paymentReference: varchar('payment_reference', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ([
  index('idx_ipo_apps_user_id').on(table.userId),
  index('idx_ipo_apps_ipo_id').on(table.ipoId),
  index('idx_ipo_apps_account_id').on(table.applicationAccountId),
  index('idx_ipo_apps_status').on(table.status),
  index('idx_ipo_apps_date').on(table.applicationDate)
]));

export type IPOApplicationSelect = typeof ipoApplications.$inferSelect;
export type IPOApplicationInsert = typeof ipoApplications.$inferInsert;
