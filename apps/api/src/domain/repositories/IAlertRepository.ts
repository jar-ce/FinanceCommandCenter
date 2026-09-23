import {
  AlertRuleRecord,
  AlertEventRecord,
  NotificationRecord,
  CreateAlertRuleDTO,
  UpdateAlertRuleDTO,
  AlertRuleStatus,
  NotificationStatus
} from '@finance-command-center/shared-types';

export interface IAlertRepository {
  // Alert Rules
  createRule(userId: string, dto: CreateAlertRuleDTO): Promise<AlertRuleRecord>;
  getRuleById(id: string, userId: string): Promise<AlertRuleRecord | null>;
  getRulesByUserId(userId: string, status?: AlertRuleStatus): Promise<AlertRuleRecord[]>;
  getActiveRulesForEvaluation(userId?: string): Promise<AlertRuleRecord[]>;
  updateRule(id: string, userId: string, dto: UpdateAlertRuleDTO): Promise<AlertRuleRecord | null>;
  updateRuleStatus(id: string, userId: string, status: AlertRuleStatus): Promise<AlertRuleRecord | null>;
  updateRuleEvaluationState(
    id: string,
    lastEvaluatedValue: string | null,
    lastEvaluatedState: string,
    lastTriggeredAt?: string | null
  ): Promise<void>;

  // Atomic Trigger Transaction
  executeTriggerTransaction(params: {
    ruleId: string;
    userId: string;
    triggerValue: string | null;
    thresholdValue: string | null;
    evaluationSnapshot?: Record<string, unknown>;
    deduplicationKey: string;
    notificationType: 'MARKET_ALERT' | 'PORTFOLIO_ALERT' | 'IPO_ALERT';
    title: string;
    message: string;
    lastEvaluatedValue: string | null;
    lastEvaluatedState: string;
  }): Promise<{ event: AlertEventRecord; notification: NotificationRecord }>;

  // Alert Events
  getEventById(id: string, userId: string): Promise<AlertEventRecord | null>;
  getEventsByRuleId(ruleId: string, userId: string): Promise<AlertEventRecord[]>;

  // Notifications
  getNotificationsByUserId(
    userId: string,
    status?: NotificationStatus,
    limit?: number,
    offset?: number
  ): Promise<{ items: NotificationRecord[]; total: number }>;
  getUnreadCount(userId: string): Promise<number>;
  getNotificationById(id: string, userId: string): Promise<NotificationRecord | null>;
  updateNotificationStatus(id: string, userId: string, status: NotificationStatus): Promise<NotificationRecord | null>;
  markAllNotificationsAsRead(userId: string): Promise<number>;
}
