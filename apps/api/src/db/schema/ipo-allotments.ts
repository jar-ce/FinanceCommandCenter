import { pgTable, uuid, varchar, numeric, integer, timestamp, index, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { ipoApplications } from './ipo-applications.js';

export const ipoAllotmentResults = pgTable('ipo_allotment_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  applicationId: uuid('application_id')
    .references(() => ipoApplications.id, { onDelete: 'restrict' })
    .notNull(),
  allotmentStatus: varchar('allotment_status', { length: 50 }).notNull().default('UNKNOWN'),
  verificationStatus: varchar('verification_status', { length: 50 }).notNull().default('UNAVAILABLE'),
  verificationMethod: varchar('verification_method', { length: 50 }).notNull().default('PROVIDER_API'),
  appliedQuantity: integer('applied_quantity').notNull(),
  allottedQuantity: integer('allotted_quantity').notNull().default(0),
  allotmentRatio: numeric('allotment_ratio', { precision: 18, scale: 4 }),
  provider: varchar('provider', { length: 50 }).notNull().default('DEVELOPMENT_STUB'),
  source: varchar('source', { length: 255 }).notNull().default('Official Provider API'),
  externalReference: varchar('external_reference', { length: 255 }),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ([
  uniqueIndex('idx_ipo_allotment_app_unique').on(table.applicationId),
  index('idx_ipo_allotment_user_id').on(table.userId),
  index('idx_ipo_allotment_app_id').on(table.applicationId),
  index('idx_ipo_allotment_status').on(table.allotmentStatus),
  index('idx_ipo_allotment_verification').on(table.verificationStatus)
]));

export type IPOAllotmentResultSelect = typeof ipoAllotmentResults.$inferSelect;
export type IPOAllotmentResultInsert = typeof ipoAllotmentResults.$inferInsert;
