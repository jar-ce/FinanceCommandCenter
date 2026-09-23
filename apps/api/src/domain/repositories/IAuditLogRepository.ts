import { AuditLogRow, NewAuditLogRow } from '../../db/schema/audit-logs.js';

export interface IAuditLogRepository {
  create(log: NewAuditLogRow): Promise<AuditLogRow>;
  listByUserId(userId: string): Promise<AuditLogRow[]>;
}
