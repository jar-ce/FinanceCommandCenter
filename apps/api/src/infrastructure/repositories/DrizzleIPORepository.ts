import { getDb } from '../../db/index.js';
import { ipos, IPOSelect, IPOInsert } from '../../db/schema/ipos.js';
import { IIPORepository, IPOSearchFilters, IPOListResult, IPOPipelineCountSummary } from '../../domain/repositories/IIPORepository.js';
import { eq, and, or, ilike, gte, lte, count, sql } from 'drizzle-orm';

export class DrizzleIPORepository implements IIPORepository {
  async list(filters: IPOSearchFilters): Promise<IPOListResult> {
    const db = await getDb();
    const conditions = [];

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(ipos.issuerName, term),
          ilike(ipos.ipoName, term),
          ilike(ipos.symbol, term)
        )
      );
    }

    if (filters.status && filters.status.trim()) {
      conditions.push(eq(ipos.status, filters.status.trim().toUpperCase()));
    }

    if (filters.exchange && filters.exchange.trim()) {
      conditions.push(eq(ipos.exchange, filters.exchange.trim().toUpperCase()));
    }

    if (filters.issueType && filters.issueType.trim()) {
      conditions.push(eq(ipos.issueType, filters.issueType.trim().toUpperCase()));
    }

    if (filters.dateFrom) {
      conditions.push(gte(ipos.openDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(ipos.closeDate, filters.dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = (page - 1) * limit;

    const [totalRecord] = await db
      .select({ total: count() })
      .from(ipos)
      .where(whereClause);

    const rows = await db
      .select()
      .from(ipos)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${ipos.openDate} DESC NULLS LAST`, sql`${ipos.createdAt} DESC`);

    return {
      ipos: rows,
      totalCount: Number(totalRecord?.total || 0)
    };
  }

  async getById(id: string): Promise<IPOSelect | null> {
    const db = await getDb();
    const [row] = await db.select().from(ipos).where(eq(ipos.id, id)).limit(1);
    return row || null;
  }

  async getByExternalId(provider: string, externalId: string): Promise<IPOSelect | null> {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(ipos)
      .where(and(eq(ipos.provider, provider), eq(ipos.externalId, externalId)))
      .limit(1);
    return row || null;
  }

  async upsert(ipoData: IPOInsert, txContext?: any): Promise<IPOSelect> {
    const db = txContext || (await getDb());
    const now = new Date();

    if (ipoData.externalId && ipoData.provider) {
      const [upserted] = await db
        .insert(ipos)
        .values({
          ...ipoData,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: [ipos.provider, ipos.externalId],
          set: {
            issuerName: ipoData.issuerName,
            ipoName: ipoData.ipoName,
            symbol: ipoData.symbol,
            exchange: ipoData.exchange,
            securityType: ipoData.securityType,
            issueType: ipoData.issueType,
            status: ipoData.status,
            openDate: ipoData.openDate,
            closeDate: ipoData.closeDate,
            listingDate: ipoData.listingDate,
            faceValue: ipoData.faceValue,
            priceBandLow: ipoData.priceBandLow,
            priceBandHigh: ipoData.priceBandHigh,
            lotSize: ipoData.lotSize,
            issueSize: ipoData.issueSize,
            freshIssueSize: ipoData.freshIssueSize,
            offerForSaleSize: ipoData.offerForSaleSize,
            retrievedAt: ipoData.retrievedAt || now,
            updatedAt: now
          }
        })
        .returning();

      return upserted;
    }

    const [inserted] = await db
      .insert(ipos)
      .values({
        ...ipoData,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return inserted;
  }

  async getPipelineSummary(): Promise<IPOPipelineCountSummary> {
    const db = await getDb();
    const summaryRows = await db
      .select({
        status: ipos.status,
        count: count()
      })
      .from(ipos)
      .groupBy(ipos.status);

    let upcoming = 0;
    let open = 0;
    let closed = 0;
    let listed = 0;
    let total = 0;

    for (const row of summaryRows) {
      const c = Number(row.count || 0);
      total += c;
      switch (row.status) {
        case 'UPCOMING':
          upcoming += c;
          break;
        case 'OPEN':
          open += c;
          break;
        case 'CLOSED':
          closed += c;
          break;
        case 'LISTED':
          listed += c;
          break;
      }
    }

    return { upcoming, open, closed, listed, total };
  }
}
