import { eq, and, desc, count } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { alertRules, alertEvents, notifications } from '../../db/schema/alerts.js';
import { IAlertRepository } from '../../domain/repositories/IAlertRepository.js';
import {
  AlertRuleRecord,
  AlertEventRecord,
  NotificationRecord,
  CreateAlertRuleDTO,
  UpdateAlertRuleDTO,
  AlertRuleStatus,
  NotificationStatus,
  AlertEvaluationState,
  AlertType,
  AlertTargetType,
  AlertConditionOperator,
  NotificationType
} from '@finance-command-center/shared-types';

export class DrizzleAlertRepository implements IAlertRepository {
  private mapRule(row: any): AlertRuleRecord {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      alertType: row.alertType as AlertType,
      targetType: row.targetType as AlertTargetType,
      targetId: row.targetId,
      conditionOperator: row.conditionOperator as AlertConditionOperator,
      thresholdValue: row.thresholdValue ? row.thresholdValue.toString() : null,
      thresholdPercent: row.thresholdPercent ? row.thresholdPercent.toString() : null,
      cooldownMinutes: row.cooldownMinutes,
      status: row.status as AlertRuleStatus,
      lastTriggeredAt: row.lastTriggeredAt ? new Date(row.lastTriggeredAt).toISOString() : null,
      lastEvaluatedAt: row.lastEvaluatedAt ? new Date(row.lastEvaluatedAt).toISOString() : null,
      lastEvaluatedValue: row.lastEvaluatedValue ? row.lastEvaluatedValue.toString() : null,
      lastEvaluatedState: (row.lastEvaluatedState || 'UNKNOWN') as AlertEvaluationState,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null
    };
  }

  private mapEvent(row: any): AlertEventRecord {
    return {
      id: row.id,
      alertRuleId: row.alertRuleId,
      userId: row.userId,
      triggeredAt: new Date(row.triggeredAt).toISOString(),
      triggerValue: row.triggerValue ? row.triggerValue.toString() : null,
      thresholdValue: row.thresholdValue ? row.thresholdValue.toString() : null,
      evaluationSnapshot: row.evaluationSnapshot || null,
      deduplicationKey: row.deduplicationKey,
      createdAt: new Date(row.createdAt).toISOString()
    };
  }

  private mapNotification(row: any): NotificationRecord {
    return {
      id: row.id,
      userId: row.userId,
      alertEventId: row.alertEventId,
      alertRuleId: row.alertRuleId,
      notificationType: row.notificationType as NotificationType,
      title: row.title,
      message: row.message,
      status: row.status as NotificationStatus,
      readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString()
    };
  }

  async createRule(userId: string, dto: CreateAlertRuleDTO): Promise<AlertRuleRecord> {
    const db = await getDb();
    const [row] = await db
      .insert(alertRules)
      .values({
        userId,
        name: dto.name,
        description: dto.description || null,
        alertType: dto.alertType,
        targetType: dto.targetType,
        targetId: dto.targetId,
        conditionOperator: dto.conditionOperator || 'GTE',
        thresholdValue: dto.thresholdValue || null,
        thresholdPercent: dto.thresholdPercent || null,
        cooldownMinutes: dto.cooldownMinutes ?? 60,
        status: 'ACTIVE',
        lastEvaluatedState: 'UNKNOWN'
      })
      .returning();

    return this.mapRule(row);
  }

  async getRuleById(id: string, userId: string): Promise<AlertRuleRecord | null> {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.userId, userId)));

    return row ? this.mapRule(row) : null;
  }

  async getRulesByUserId(userId: string, status?: AlertRuleStatus): Promise<AlertRuleRecord[]> {
    const db = await getDb();
    const conditions = [eq(alertRules.userId, userId)];
    if (status) {
      conditions.push(eq(alertRules.status, status));
    }

    const rows = await db
      .select()
      .from(alertRules)
      .where(and(...conditions))
      .orderBy(desc(alertRules.createdAt));

    return rows.map((r) => this.mapRule(r));
  }

  async getActiveRulesForEvaluation(userId?: string): Promise<AlertRuleRecord[]> {
    const db = await getDb();
    const conditions = [eq(alertRules.status, 'ACTIVE')];
    if (userId) {
      conditions.push(eq(alertRules.userId, userId));
    }

    const rows = await db
      .select()
      .from(alertRules)
      .where(and(...conditions))
      .orderBy(desc(alertRules.createdAt));

    return rows.map((r) => this.mapRule(r));
  }

  async updateRule(id: string, userId: string, dto: UpdateAlertRuleDTO): Promise<AlertRuleRecord | null> {
    const db = await getDb();
    const updates: Record<string, any> = {
      updatedAt: new Date()
    };

    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.cooldownMinutes !== undefined) updates.cooldownMinutes = dto.cooldownMinutes;

    // MANDATORY RULE: Material changes to threshold reset threshold crossing state
    if (dto.thresholdValue !== undefined || dto.thresholdPercent !== undefined) {
      if (dto.thresholdValue !== undefined) updates.thresholdValue = dto.thresholdValue;
      if (dto.thresholdPercent !== undefined) updates.thresholdPercent = dto.thresholdPercent;
      updates.lastEvaluatedValue = null;
      updates.lastEvaluatedState = 'UNKNOWN';
    }

    const [row] = await db
      .update(alertRules)
      .set(updates)
      .where(and(eq(alertRules.id, id), eq(alertRules.userId, userId)))
      .returning();

    return row ? this.mapRule(row) : null;
  }

  async updateRuleStatus(id: string, userId: string, status: AlertRuleStatus): Promise<AlertRuleRecord | null> {
    const db = await getDb();
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date()
    };

    if (status === 'ARCHIVED') {
      updates.archivedAt = new Date();
    }

    const [row] = await db
      .update(alertRules)
      .set(updates)
      .where(and(eq(alertRules.id, id), eq(alertRules.userId, userId)))
      .returning();

    return row ? this.mapRule(row) : null;
  }

  async updateRuleEvaluationState(
    id: string,
    lastEvaluatedValue: string | null,
    lastEvaluatedState: string,
    lastTriggeredAt?: string | null
  ): Promise<void> {
    const db = await getDb();
    const updates: Record<string, any> = {
      lastEvaluatedAt: new Date(),
      lastEvaluatedValue: lastEvaluatedValue || null,
      lastEvaluatedState: lastEvaluatedState,
      updatedAt: new Date()
    };

    if (lastTriggeredAt !== undefined) {
      updates.lastTriggeredAt = lastTriggeredAt ? new Date(lastTriggeredAt) : null;
    }

    await db
      .update(alertRules)
      .set(updates)
      .where(eq(alertRules.id, id));
  }

  async executeTriggerTransaction(params: {
    ruleId: string;
    userId: string;
    triggerValue: string | null;
    thresholdValue: string | null;
    evaluationSnapshot?: Record<string, unknown>;
    deduplicationKey: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    lastEvaluatedValue: string | null;
    lastEvaluatedState: string;
  }): Promise<{ event: AlertEventRecord; notification: NotificationRecord }> {
    const db = await getDb();

    return await db.transaction(async (tx) => {
      // 1. Row-level lock on alert_rules for update
      const [ruleRow] = await tx
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.id, params.ruleId), eq(alertRules.userId, params.userId)))
        .for('update');

      if (!ruleRow) {
        throw new Error('ALERT_RULE_NOT_FOUND');
      }

      const now = new Date();

      // 2. Insert alert_events (unique index on deduplication_key throws on duplicate concurrent inserts)
      const [eventRow] = await tx
        .insert(alertEvents)
        .values({
          alertRuleId: params.ruleId,
          userId: params.userId,
          triggeredAt: now,
          triggerValue: params.triggerValue || null,
          thresholdValue: params.thresholdValue || null,
          evaluationSnapshot: params.evaluationSnapshot || null,
          deduplicationKey: params.deduplicationKey,
          createdAt: now
        })
        .returning();

      // 3. Insert notification
      const [notifRow] = await tx
        .insert(notifications)
        .values({
          userId: params.userId,
          alertEventId: eventRow.id,
          alertRuleId: params.ruleId,
          notificationType: params.notificationType,
          title: params.title,
          message: params.message,
          status: 'UNREAD',
          createdAt: now
        })
        .returning();

      // 4. Update alert_rules trigger and evaluation state
      await tx
        .update(alertRules)
        .set({
          lastTriggeredAt: now,
          lastEvaluatedAt: now,
          lastEvaluatedValue: params.lastEvaluatedValue || null,
          lastEvaluatedState: params.lastEvaluatedState,
          updatedAt: now
        })
        .where(eq(alertRules.id, params.ruleId));

      return {
        event: this.mapEvent(eventRow),
        notification: this.mapNotification(notifRow)
      };
    });
  }

  async getEventById(id: string, userId: string): Promise<AlertEventRecord | null> {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(alertEvents)
      .where(and(eq(alertEvents.id, id), eq(alertEvents.userId, userId)));

    return row ? this.mapEvent(row) : null;
  }

  async getEventsByRuleId(ruleId: string, userId: string): Promise<AlertEventRecord[]> {
    const db = await getDb();
    const rows = await db
      .select()
      .from(alertEvents)
      .where(and(eq(alertEvents.alertRuleId, ruleId), eq(alertEvents.userId, userId)))
      .orderBy(desc(alertEvents.triggeredAt));

    return rows.map((r) => this.mapEvent(r));
  }

  async getNotificationsByUserId(
    userId: string,
    status?: NotificationStatus,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    const db = await getDb();
    const conditions = [eq(notifications.userId, userId)];
    if (status) {
      conditions.push(eq(notifications.status, status));
    }

    const [totalRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions));

    const total = totalRow ? Number(totalRow.count) : 0;

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map((r) => this.mapNotification(r)),
      total
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const db = await getDb();
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.status, 'UNREAD')));

    return row ? Number(row.count) : 0;
  }

  async getNotificationById(id: string, userId: string): Promise<NotificationRecord | null> {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

    return row ? this.mapNotification(row) : null;
  }

  async updateNotificationStatus(
    id: string,
    userId: string,
    status: NotificationStatus
  ): Promise<NotificationRecord | null> {
    const db = await getDb();
    const updates: Record<string, any> = { status };
    if (status === 'READ') {
      updates.readAt = new Date();
    }

    const [row] = await db
      .update(notifications)
      .set(updates)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return row ? this.mapNotification(row) : null;
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    const db = await getDb();
    const res = await db
      .update(notifications)
      .set({ status: 'READ', readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.status, 'UNREAD')))
      .returning();

    return res.length;
  }
}
