import { eq, and, ilike, sql } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { khataAccounts, KhataAccountRow, NewKhataAccountRow } from '../../db/schema/khata-accounts.js';
import { IKhataAccountRepository, AccountFilter } from '../../domain/repositories/IKhataAccountRepository.js';

export class DrizzleKhataAccountRepository implements IKhataAccountRepository {
  async create(data: NewKhataAccountRow): Promise<KhataAccountRow> {
    const db = await getDb();
    const [result] = await db.insert(khataAccounts).values(data).returning();
    return result;
  }

  async findById(id: string, userId: string): Promise<KhataAccountRow | null> {
    const db = await getDb();
    const [result] = await db
      .select()
      .from(khataAccounts)
      .where(and(eq(khataAccounts.id, id), eq(khataAccounts.userId, userId)))
      .limit(1);
    return result || null;
  }

  async list(filter: AccountFilter): Promise<KhataAccountRow[]> {
    const db = await getDb();
    const conditions = [eq(khataAccounts.userId, filter.userId)];

    if (filter.status) {
      conditions.push(eq(khataAccounts.status, filter.status));
    }
    if (filter.accountType) {
      conditions.push(eq(khataAccounts.accountType, filter.accountType));
    }
    if (filter.search) {
      conditions.push(ilike(khataAccounts.displayName, `%${filter.search}%`));
    }

    return await db
      .select()
      .from(khataAccounts)
      .where(and(...conditions))
      .orderBy(sql`${khataAccounts.displayName} ASC`);
  }

  async update(id: string, userId: string, data: Partial<NewKhataAccountRow>): Promise<KhataAccountRow | null> {
    const db = await getDb();
    const [updated] = await db
      .update(khataAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(khataAccounts.id, id), eq(khataAccounts.userId, userId)))
      .returning();
    return updated || null;
  }

  async archive(id: string, userId: string): Promise<KhataAccountRow | null> {
    const db = await getDb();
    const [archived] = await db
      .update(khataAccounts)
      .set({ status: 'ARCHIVED', archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(khataAccounts.id, id), eq(khataAccounts.userId, userId)))
      .returning();
    return archived || null;
  }
}
