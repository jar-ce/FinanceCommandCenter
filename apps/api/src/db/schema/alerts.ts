/**
 * FINANCE COMMAND CENTER (APEX OS)
 * Phase 14 — Alerts & Notifications Database Schema
 */

import { pgTable, uuid, varchar, text, numeric, integer, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    alertType: varchar('alert_type', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: uuid('target_id').notNull(),
    conditionOperator: varchar('condition_operator', { length: 16 }).notNull(),
    thresholdValue: numeric('threshold_value', { precision: 18, scale: 4 }),
    thresholdPercent: numeric('threshold_percent', { precision: 18, scale: 4 }),
    cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
    lastEvaluatedValue: numeric('last_evaluated_value', { precision: 18, scale: 4 }),
    lastEvaluatedState: varchar('last_evaluated_state', { length: 16 }).notNull().default('UNKNOWN'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true })
  },
  (table) => [
    index('alert_rules_user_idx').on(table.userId),
    index('alert_rules_status_idx').on(table.status),
    index('alert_rules_target_idx').on(table.targetType, table.targetId)
  ]
);

export const alertEvents = pgTable(
  'alert_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    alertRuleId: uuid('alert_rule_id')
      .notNull()
      .references(() => alertRules.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    triggerValue: numeric('trigger_value', { precision: 18, scale: 4 }),
    thresholdValue: numeric('threshold_value', { precision: 18, scale: 4 }),
    evaluationSnapshot: jsonb('evaluation_snapshot'),
    deduplicationKey: varchar('deduplication_key', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('alert_events_user_idx').on(table.userId),
    index('alert_events_rule_idx').on(table.alertRuleId),
    uniqueIndex('alert_events_dedup_idx').on(table.deduplicationKey)
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    alertEventId: uuid('alert_event_id')
      .notNull()
      .references(() => alertEvents.id, { onDelete: 'restrict' }),
    alertRuleId: uuid('alert_rule_id')
      .notNull()
      .references(() => alertRules.id, { onDelete: 'restrict' }),
    notificationType: varchar('notification_type', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('UNREAD'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_status_idx').on(table.status),
    index('notifications_created_idx').on(table.createdAt)
  ]
);
