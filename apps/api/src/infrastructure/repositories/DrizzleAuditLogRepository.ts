import { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository.js';
import { auditLogs, AuditLogRow, NewAuditLogRow } from '../../db/schema/audit-logs.js';
import { getDb } from '../../db/index.js';
import { eq } from 'drizzle-orm';

export class DrizzleAuditLogRepository implements IAuditLogRepository {
  async create(log: NewAuditLogRow): Promise<AuditLogRow> {
    const db = await getDb();
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async listByUserId(userId: string): Promise<AuditLogRow[]> {
    const db = await getDb();
    return await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));
  }
}
