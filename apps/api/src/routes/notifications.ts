import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DrizzleAlertRepository } from '../infrastructure/repositories/DrizzleAlertRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { NotificationService } from '../domain/services/NotificationService.js';

import { requireAuthentication, resolveDevelopmentIdentity } from '../infrastructure/auth/authMiddleware.js';

const alertRepo = new DrizzleAlertRepository();
const auditLogRepo = new DrizzleAuditLogRepository();
const notificationService = new NotificationService(alertRepo, auditLogRepo);

export const notificationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', requireAuthentication);

  // Paginated user notifications
  app.get('/', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { status, page = '1', limit = '20' } = request.query as {
      status?: string;
      page?: string;
      limit?: string;
    };

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;

    const { items, total } = await notificationService.getUserNotifications(userId, status as any, l, offset);

    return reply.send({
      success: true,
      data: {
        items,
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l)
      },
      timestamp: new Date().toISOString()
    });
  });

  // Unread notifications counter
  app.get('/unread-count', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const count = await notificationService.getUnreadCount(userId);
    return reply.send({ success: true, data: { unreadCount: count }, timestamp: new Date().toISOString() });
  });

  // Mark all unread notifications as read
  app.post('/read-all', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const countRead = await notificationService.markAllAsRead(userId);
    return reply.send({ success: true, data: { countRead }, timestamp: new Date().toISOString() });
  });

  // Get single notification
  app.get('/:id', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    const notification = await notificationService.getNotificationById(id, userId);
    if (!notification) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        timestamp: new Date().toISOString()
      });
    }

    return reply.send({ success: true, data: notification, timestamp: new Date().toISOString() });
  });

  // Mark notification read
  app.post('/:id/read', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const updated = await notificationService.markAsRead(id, userId);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Mark notification unread
  app.post('/:id/unread', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const updated = await notificationService.markAsUnread(id, userId);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Archive notification
  app.post('/:id/archive', async (request, reply) => {
    const userId = resolveDevelopmentIdentity(request);
    const { id } = request.params as { id: string };

    try {
      const updated = await notificationService.archiveNotification(id, userId);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        timestamp: new Date().toISOString()
      });
    }
  });
};
