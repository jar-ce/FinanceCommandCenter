import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { khataTransactions, KhataTransactionRow, NewKhataTransactionRow } from '../../db/schema/khata-transactions.js';
import { IKhataTransactionRepository, TransactionFilter } from '../../domain/repositories/IKhataTransactionRepository.js';

export class DrizzleKhataTransactionRepository implements IKhataTransactionRepository {
  async create(data: NewKhataTransactionRow): Promise<KhataTransactionRow> {
    const db = await getDb();
    const [result] = await db.insert(khataTransactions).values(data).returning();
    return result;
  }

  async findById(id: string, userId: string): Promise<KhataTransactionRow | null> {
    const db = await getDb();
    const [result] = await db
      .select()
      .from(khataTransactions)
      .where(and(eq(khataTransactions.id, id), eq(khataTransactions.userId, userId)))
      .limit(1);
    return result || null;
  }

  async listByAccountId(filter: TransactionFilter): Promise<{ transactions: KhataTransactionRow[]; totalCount: number }> {
    const db = await getDb();
    const conditions = [
      eq(khataTransactions.accountId, filter.accountId),
      eq(khataTransactions.userId, filter.userId)
    ];

    if (filter.type) {
      conditions.push(eq(khataTransactions.type, filter.type));
    }
    if (filter.startDate) {
      conditions.push(gte(khataTransactions.transactionDate, filter.startDate));
    }
    if (filter.endDate) {
      conditions.push(lte(khataTransactions.transactionDate, filter.endDate));
    }

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(khataTransactions)
      .where(and(...conditions))
      .orderBy(desc(khataTransactions.transactionDate), desc(khataTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(khataTransactions)
      .where(and(...conditions));

    return {
      transactions: items,
      totalCount: countResult?.count || 0
    };
  }

  async markReversed(id: string, userId: string, reason?: string): Promise<KhataTransactionRow | null> {
    const db = await getDb();
    const [result] = await db
      .update(khataTransactions)
      .set({
        status: 'REVERSED',
        reversedAt: new Date(),
        reversedBy: userId,
        reversalReason: reason || 'Manual Reversal',
        updatedAt: new Date()
      })
      .where(and(eq(khataTransactions.id, id), eq(khataTransactions.userId, userId)))
      .returning();
    return result || null;
  }

  async getAccountTotals(accountId: string, userId: string): Promise<{ totalMoneyIn: string; totalMoneyOut: string }> {
    const db = await getDb();

    const [result] = await db
      .select({
        totalMoneyIn: sql<string>`COALESCE(SUM(CASE WHEN ${khataTransactions.type} = 'MONEY_IN' THEN ${khataTransactions.amount} ELSE 0 END), 0)::text`,
        totalMoneyOut: sql<string>`COALESCE(SUM(CASE WHEN ${khataTransactions.type} = 'MONEY_OUT' THEN ${khataTransactions.amount} ELSE 0 END), 0)::text`
      })
      .from(khataTransactions)
      .where(and(
        eq(khataTransactions.accountId, accountId),
        eq(khataTransactions.userId, userId),
        eq(khataTransactions.status, 'ACTIVE')
      ));

    return {
      totalMoneyIn: result?.totalMoneyIn || '0.0000',
      totalMoneyOut: result?.totalMoneyOut || '0.0000'
    };
  }
}
