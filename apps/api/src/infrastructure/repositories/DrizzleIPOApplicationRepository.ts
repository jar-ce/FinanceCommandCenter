import { getDb } from '../../db/index.js';
import { ipoApplications, IPOApplicationSelect, IPOApplicationInsert } from '../../db/schema/ipo-applications.js';
import { ipos } from '../../db/schema/ipos.js';
import { khataAccounts } from '../../db/schema/khata-accounts.js';
import {
  IIPOApplicationRepository,
  IPOApplicationSearchFilters,
  IPOApplicationListResult,
  EnrichedIPOApplication,
  IPOApplicationSummaryCounts
} from '../../domain/repositories/IIPOApplicationRepository.js';
import { eq, and, or, ilike, gte, lte, count, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

export class DrizzleIPOApplicationRepository implements IIPOApplicationRepository {
  private calculateEstimatedAmount(priceBandHigh: string | null | undefined, quantityApplied: number): string | null {
    if (!priceBandHigh || !quantityApplied || quantityApplied <= 0) return null;
    try {
      const price = new Decimal(priceBandHigh);
      if (price.isNaN() || price.isNegative()) return null;
      return price.mul(quantityApplied).toFixed(4);
    } catch {
      return null;
    }
  }

  async list(filters: IPOApplicationSearchFilters): Promise<IPOApplicationListResult> {
    const db = await getDb();
    const conditions = [eq(ipoApplications.userId, filters.userId)];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(ipos.issuerName, term),
          ilike(ipos.ipoName, term),
          ilike(ipos.symbol, term),
          ilike(khataAccounts.displayName, term),
          ilike(ipoApplications.paymentReference, term)
        )!
      );
    }

    if (filters.status && filters.status.trim()) {
      conditions.push(eq(ipoApplications.status, filters.status.trim().toUpperCase()));
    }

    if (filters.ipoId) {
      conditions.push(eq(ipoApplications.ipoId, filters.ipoId));
    }

    if (filters.accountId) {
      conditions.push(eq(ipoApplications.applicationAccountId, filters.accountId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(ipoApplications.applicationDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(ipoApplications.applicationDate, filters.dateTo));
    }

    const whereClause = and(...conditions);
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = (page - 1) * limit;

    const [totalRecord] = await db
      .select({ total: count() })
      .from(ipoApplications)
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(whereClause);

    const rows = await db
      .select({
        app: ipoApplications,
        ipoName: ipos.ipoName,
        issuerName: ipos.issuerName,
        symbol: ipos.symbol,
        priceBandHigh: ipos.priceBandHigh,
        accountDisplayName: khataAccounts.displayName
      })
      .from(ipoApplications)
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${ipoApplications.applicationDate} DESC`, sql`${ipoApplications.createdAt} DESC`);

    const applications: EnrichedIPOApplication[] = rows.map((r: any) => ({
      ...r.app,
      ipoName: r.ipoName || undefined,
      issuerName: r.issuerName || undefined,
      symbol: r.symbol || null,
      accountDisplayName: r.accountDisplayName || undefined,
      estimatedAmount: this.calculateEstimatedAmount(r.priceBandHigh, r.app.quantityApplied)
    }));

    return {
      applications,
      totalCount: Number(totalRecord?.total || 0)
    };
  }

  async getById(id: string, userId: string): Promise<EnrichedIPOApplication | null> {
    const db = await getDb();
    const [row] = await db
      .select({
        app: ipoApplications,
        ipoName: ipos.ipoName,
        issuerName: ipos.issuerName,
        symbol: ipos.symbol,
        priceBandHigh: ipos.priceBandHigh,
        accountDisplayName: khataAccounts.displayName
      })
      .from(ipoApplications)
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(and(eq(ipoApplications.id, id), eq(ipoApplications.userId, userId)))
      .limit(1);

    if (!row) return null;

    return {
      ...row.app,
      ipoName: row.ipoName || undefined,
      issuerName: row.issuerName || undefined,
      symbol: row.symbol || null,
      accountDisplayName: row.accountDisplayName || undefined,
      estimatedAmount: this.calculateEstimatedAmount(row.priceBandHigh, row.app.quantityApplied)
    };
  }

  async create(data: IPOApplicationInsert, txContext?: any): Promise<IPOApplicationSelect> {
    const db = txContext || (await getDb());
    const now = new Date();
    const [created] = await db
      .insert(ipoApplications)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return created;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<IPOApplicationInsert>,
    txContext?: any
  ): Promise<IPOApplicationSelect | null> {
    const db = txContext || (await getDb());
    const now = new Date();
    const [updated] = await db
      .update(ipoApplications)
      .set({
        ...data,
        updatedAt: now
      })
      .where(and(eq(ipoApplications.id, id), eq(ipoApplications.userId, userId)))
      .returning();

    return updated || null;
  }

  async updateStatus(
    id: string,
    userId: string,
    status: string,
    txContext?: any
  ): Promise<IPOApplicationSelect | null> {
    const db = txContext || (await getDb());
    const now = new Date();
    const [updated] = await db
      .update(ipoApplications)
      .set({
        status: status.toUpperCase(),
        updatedAt: now
      })
      .where(and(eq(ipoApplications.id, id), eq(ipoApplications.userId, userId)))
      .returning();

    return updated || null;
  }

  async getSummary(userId: string): Promise<IPOApplicationSummaryCounts> {
    const db = await getDb();
    const summaryRows = await db
      .select({
        status: ipoApplications.status,
        count: count()
      })
      .from(ipoApplications)
      .where(eq(ipoApplications.userId, userId))
      .groupBy(ipoApplications.status);

    let draft = 0;
    let submitted = 0;
    let paymentPending = 0;
    let paymentConfirmed = 0;
    let completed = 0;
    let cancelled = 0;
    let total = 0;

    for (const row of summaryRows) {
      const c = Number(row.count || 0);
      total += c;
      switch (row.status) {
        case 'DRAFT':
          draft += c;
          break;
        case 'SUBMITTED':
          submitted += c;
          break;
        case 'PAYMENT_PENDING':
          paymentPending += c;
          break;
        case 'PAYMENT_CONFIRMED':
          paymentConfirmed += c;
          break;
        case 'COMPLETED':
          completed += c;
          break;
        case 'CANCELLED':
          cancelled += c;
          break;
      }
    }

    return { total, draft, submitted, paymentPending, paymentConfirmed, completed, cancelled };
  }
}
