import { IAlertRepository } from '../repositories/IAlertRepository.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import { NotificationRecord, NotificationStatus } from '@finance-command-center/shared-types';

export class NotificationService {
  constructor(
    private alertRepo: IAlertRepository,
    private auditLogRepo: IAuditLogRepository
  ) {}

  async getUserNotifications(
    userId: string,
    status?: NotificationStatus,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    return this.alertRepo.getNotificationsByUserId(userId, status, limit, offset);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.alertRepo.getUnreadCount(userId);
  }

  async getNotificationById(id: string, userId: string): Promise<NotificationRecord | null> {
    return this.alertRepo.getNotificationById(id, userId);
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRecord> {
    const updated = await this.alertRepo.updateNotificationStatus(id, userId, 'READ');
    if (!updated) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'NOTIFICATION_READ',
      entityType: 'NOTIFICATION',
      entityId: updated.id,
      details: { status: 'READ' }
    });

    return updated;
  }

  async markAsUnread(id: string, userId: string): Promise<NotificationRecord> {
    const updated = await this.alertRepo.updateNotificationStatus(id, userId, 'UNREAD');
    if (!updated) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'NOTIFICATION_UNREAD',
      entityType: 'NOTIFICATION',
      entityId: updated.id,
      details: { status: 'UNREAD' }
    });

    return updated;
  }

  async archiveNotification(id: string, userId: string): Promise<NotificationRecord> {
    const updated = await this.alertRepo.updateNotificationStatus(id, userId, 'ARCHIVED');
    if (!updated) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'NOTIFICATION_ARCHIVED',
      entityType: 'NOTIFICATION',
      entityId: updated.id,
      details: { status: 'ARCHIVED' }
    });

    return updated;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.alertRepo.markAllNotificationsAsRead(userId);

    await this.auditLogRepo.create({
      userId,
      action: 'NOTIFICATION_READ_ALL',
      entityType: 'NOTIFICATION',
      details: { countRead: count }
    });

    return count;
  }
}
