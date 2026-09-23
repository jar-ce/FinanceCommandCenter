import { eq, and, or, ilike, count, desc } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { ipoAllotmentResults, IPOAllotmentResultSelect, IPOAllotmentResultInsert } from '../../db/schema/ipo-allotments.js';
import { ipoApplications } from '../../db/schema/ipo-applications.js';
import { ipos } from '../../db/schema/ipos.js';
import { khataAccounts } from '../../db/schema/khata-accounts.js';
import {
  IIPOAllotmentRepository,
  IPOAllotmentSearchFilters,
  EnrichedIPOAllotmentResult,
  IPOAllotmentSummaryData
} from '../../domain/repositories/IIPOAllotmentRepository.js';

export class DrizzleIPOAllotmentRepository implements IIPOAllotmentRepository {
  async list(filters: IPOAllotmentSearchFilters): Promise<{ allotments: EnrichedIPOAllotmentResult[]; totalCount: number }> {
    const db = await getDb();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(ipoAllotmentResults.userId, filters.userId)];

    if (filters.status) {
      conditions.push(eq(ipoAllotmentResults.allotmentStatus, filters.status));
    }
    if (filters.verificationStatus) {
      conditions.push(eq(ipoAllotmentResults.verificationStatus, filters.verificationStatus));
    }
    if (filters.applicationId) {
      conditions.push(eq(ipoAllotmentResults.applicationId, filters.applicationId));
    }
    if (filters.ipoId) {
      conditions.push(eq(ipoApplications.ipoId, filters.ipoId));
    }
    if (filters.search && filters.search.trim()) {
      const query = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(ipos.ipoName, query),
          ilike(ipos.issuerName, query),
          ilike(ipos.symbol, query),
          ilike(khataAccounts.displayName, query),
          ilike(ipoApplications.paymentReference, query)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(ipoAllotmentResults)
      .leftJoin(ipoApplications, eq(ipoAllotmentResults.applicationId, ipoApplications.id))
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: ipoAllotmentResults.id,
        userId: ipoAllotmentResults.userId,
        applicationId: ipoAllotmentResults.applicationId,
        allotmentStatus: ipoAllotmentResults.allotmentStatus,
        verificationStatus: ipoAllotmentResults.verificationStatus,
        verificationMethod: ipoAllotmentResults.verificationMethod,
        appliedQuantity: ipoAllotmentResults.appliedQuantity,
        allottedQuantity: ipoAllotmentResults.allottedQuantity,
        allotmentRatio: ipoAllotmentResults.allotmentRatio,
        provider: ipoAllotmentResults.provider,
        source: ipoAllotmentResults.source,
        externalReference: ipoAllotmentResults.externalReference,
        retrievedAt: ipoAllotmentResults.retrievedAt,
        verifiedAt: ipoAllotmentResults.verifiedAt,
        notes: ipoAllotmentResults.notes,
        createdAt: ipoAllotmentResults.createdAt,
        updatedAt: ipoAllotmentResults.updatedAt,
        ipoName: ipos.ipoName,
        issuerName: ipos.issuerName,
        symbol: ipos.symbol,
        applicationDate: ipoApplications.applicationDate,
        paymentReference: ipoApplications.paymentReference,
        accountDisplayName: khataAccounts.displayName
      })
      .from(ipoAllotmentResults)
      .leftJoin(ipoApplications, eq(ipoAllotmentResults.applicationId, ipoApplications.id))
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(whereClause)
      .orderBy(desc(ipoAllotmentResults.updatedAt))
      .limit(limit)
      .offset(offset);

    const allotments: EnrichedIPOAllotmentResult[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      applicationId: r.applicationId,
      allotmentStatus: r.allotmentStatus,
      verificationStatus: r.verificationStatus,
      verificationMethod: r.verificationMethod,
      appliedQuantity: r.appliedQuantity,
      allottedQuantity: r.allottedQuantity,
      allotmentRatio: r.allotmentRatio,
      provider: r.provider,
      source: r.source,
      externalReference: r.externalReference,
      retrievedAt: r.retrievedAt,
      verifiedAt: r.verifiedAt,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ipoName: r.ipoName || undefined,
      issuerName: r.issuerName || undefined,
      symbol: r.symbol,
      applicationDate: r.applicationDate || undefined,
      accountDisplayName: r.accountDisplayName || undefined,
      maskedApplicationNumber: r.paymentReference ? maskApplicationNumber(r.paymentReference) : null
    }));

    return { allotments, totalCount: Number(totalCount) };
  }

  async getById(id: string, userId: string): Promise<EnrichedIPOAllotmentResult | null> {
    const db = await getDb();
    const rows = await db
      .select({
        id: ipoAllotmentResults.id,
        userId: ipoAllotmentResults.userId,
        applicationId: ipoAllotmentResults.applicationId,
        allotmentStatus: ipoAllotmentResults.allotmentStatus,
        verificationStatus: ipoAllotmentResults.verificationStatus,
        verificationMethod: ipoAllotmentResults.verificationMethod,
        appliedQuantity: ipoAllotmentResults.appliedQuantity,
        allottedQuantity: ipoAllotmentResults.allottedQuantity,
        allotmentRatio: ipoAllotmentResults.allotmentRatio,
        provider: ipoAllotmentResults.provider,
        source: ipoAllotmentResults.source,
        externalReference: ipoAllotmentResults.externalReference,
        retrievedAt: ipoAllotmentResults.retrievedAt,
        verifiedAt: ipoAllotmentResults.verifiedAt,
        notes: ipoAllotmentResults.notes,
        createdAt: ipoAllotmentResults.createdAt,
        updatedAt: ipoAllotmentResults.updatedAt,
        ipoName: ipos.ipoName,
        issuerName: ipos.issuerName,
        symbol: ipos.symbol,
        applicationDate: ipoApplications.applicationDate,
        paymentReference: ipoApplications.paymentReference,
        accountDisplayName: khataAccounts.displayName
      })
      .from(ipoAllotmentResults)
      .leftJoin(ipoApplications, eq(ipoAllotmentResults.applicationId, ipoApplications.id))
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(and(eq(ipoAllotmentResults.id, id), eq(ipoAllotmentResults.userId, userId)))
      .limit(1);

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      applicationId: r.applicationId,
      allotmentStatus: r.allotmentStatus,
      verificationStatus: r.verificationStatus,
      verificationMethod: r.verificationMethod,
      appliedQuantity: r.appliedQuantity,
      allottedQuantity: r.allottedQuantity,
      allotmentRatio: r.allotmentRatio,
      provider: r.provider,
      source: r.source,
      externalReference: r.externalReference,
      retrievedAt: r.retrievedAt,
      verifiedAt: r.verifiedAt,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ipoName: r.ipoName || undefined,
      issuerName: r.issuerName || undefined,
      symbol: r.symbol,
      applicationDate: r.applicationDate || undefined,
      accountDisplayName: r.accountDisplayName || undefined,
      maskedApplicationNumber: r.paymentReference ? maskApplicationNumber(r.paymentReference) : null
    };
  }

  async getByApplicationId(applicationId: string, userId: string): Promise<EnrichedIPOAllotmentResult | null> {
    const db = await getDb();
    const rows = await db
      .select({
        id: ipoAllotmentResults.id,
        userId: ipoAllotmentResults.userId,
        applicationId: ipoAllotmentResults.applicationId,
        allotmentStatus: ipoAllotmentResults.allotmentStatus,
        verificationStatus: ipoAllotmentResults.verificationStatus,
        verificationMethod: ipoAllotmentResults.verificationMethod,
        appliedQuantity: ipoAllotmentResults.appliedQuantity,
        allottedQuantity: ipoAllotmentResults.allottedQuantity,
        allotmentRatio: ipoAllotmentResults.allotmentRatio,
        provider: ipoAllotmentResults.provider,
        source: ipoAllotmentResults.source,
        externalReference: ipoAllotmentResults.externalReference,
        retrievedAt: ipoAllotmentResults.retrievedAt,
        verifiedAt: ipoAllotmentResults.verifiedAt,
        notes: ipoAllotmentResults.notes,
        createdAt: ipoAllotmentResults.createdAt,
        updatedAt: ipoAllotmentResults.updatedAt,
        ipoName: ipos.ipoName,
        issuerName: ipos.issuerName,
        symbol: ipos.symbol,
        applicationDate: ipoApplications.applicationDate,
        paymentReference: ipoApplications.paymentReference,
        accountDisplayName: khataAccounts.displayName
      })
      .from(ipoAllotmentResults)
      .leftJoin(ipoApplications, eq(ipoAllotmentResults.applicationId, ipoApplications.id))
      .leftJoin(ipos, eq(ipoApplications.ipoId, ipos.id))
      .leftJoin(khataAccounts, eq(ipoApplications.applicationAccountId, khataAccounts.id))
      .where(and(eq(ipoAllotmentResults.applicationId, applicationId), eq(ipoAllotmentResults.userId, userId)))
      .limit(1);

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      applicationId: r.applicationId,
      allotmentStatus: r.allotmentStatus,
      verificationStatus: r.verificationStatus,
      verificationMethod: r.verificationMethod,
      appliedQuantity: r.appliedQuantity,
      allottedQuantity: r.allottedQuantity,
      allotmentRatio: r.allotmentRatio,
      provider: r.provider,
      source: r.source,
      externalReference: r.externalReference,
      retrievedAt: r.retrievedAt,
      verifiedAt: r.verifiedAt,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ipoName: r.ipoName || undefined,
      issuerName: r.issuerName || undefined,
      symbol: r.symbol,
      applicationDate: r.applicationDate || undefined,
      accountDisplayName: r.accountDisplayName || undefined,
      maskedApplicationNumber: r.paymentReference ? maskApplicationNumber(r.paymentReference) : null
    };
  }

  async upsert(record: IPOAllotmentResultInsert): Promise<IPOAllotmentResultSelect> {
    const db = await getDb();

    const sanitizedRecord = {
      userId: record.userId,
      applicationId: record.applicationId,
      allotmentStatus: record.allotmentStatus,
      verificationStatus: record.verificationStatus,
      verificationMethod: record.verificationMethod,
      appliedQuantity: record.appliedQuantity,
      allottedQuantity: record.allottedQuantity,
      allotmentRatio: record.allotmentRatio ?? null,
      provider: record.provider ?? 'DEVELOPMENT_STUB',
      source: record.source ?? 'Official Provider API',
      externalReference: record.externalReference ?? null,
      retrievedAt: record.retrievedAt ?? null,
      verifiedAt: record.verifiedAt ?? null,
      notes: record.notes ?? null,
      updatedAt: new Date()
    };

    const [result] = await db
      .insert(ipoAllotmentResults)
      .values(sanitizedRecord)
      .onConflictDoUpdate({
        target: [ipoAllotmentResults.applicationId],
        set: {
          allotmentStatus: sanitizedRecord.allotmentStatus,
          verificationStatus: sanitizedRecord.verificationStatus,
          verificationMethod: sanitizedRecord.verificationMethod,
          appliedQuantity: sanitizedRecord.appliedQuantity,
          allottedQuantity: sanitizedRecord.allottedQuantity,
          allotmentRatio: sanitizedRecord.allotmentRatio,
          provider: sanitizedRecord.provider,
          source: sanitizedRecord.source,
          externalReference: sanitizedRecord.externalReference,
          retrievedAt: sanitizedRecord.retrievedAt,
          verifiedAt: sanitizedRecord.verifiedAt,
          notes: sanitizedRecord.notes,
          updatedAt: new Date()
        }
      })
      .returning();

    return result;
  }

  async getSummary(userId: string): Promise<IPOAllotmentSummaryData> {
    const db = await getDb();
    const rows = await db
      .select({
        allotmentStatus: ipoAllotmentResults.allotmentStatus,
        verificationStatus: ipoAllotmentResults.verificationStatus,
        count: count()
      })
      .from(ipoAllotmentResults)
      .where(eq(ipoAllotmentResults.userId, userId))
      .groupBy(ipoAllotmentResults.allotmentStatus, ipoAllotmentResults.verificationStatus);

    let total = 0;
    let verified = 0;
    let unverified = 0;
    let stale = 0;
    let manualRequired = 0;
    let unavailable = 0;
    let allottedCount = 0;
    let partiallyAllottedCount = 0;
    let notAllottedCount = 0;

    for (const r of rows) {
      const c = Number(r.count);
      total += c;

      if (r.verificationStatus === 'VERIFIED') verified += c;
      if (r.verificationStatus === 'UNVERIFIED') unverified += c;
      if (r.verificationStatus === 'STALE') stale += c;
      if (r.verificationStatus === 'MANUAL_REQUIRED') manualRequired += c;
      if (r.verificationStatus === 'UNAVAILABLE') unavailable += c;

      if (r.allotmentStatus === 'ALLOTTED') allottedCount += c;
      if (r.allotmentStatus === 'PARTIALLY_ALLOTTED') partiallyAllottedCount += c;
      if (r.allotmentStatus === 'NOT_ALLOTTED') notAllottedCount += c;
    }

    return {
      total,
      verified,
      unverified,
      stale,
      manualRequired,
      unavailable,
      allottedCount,
      partiallyAllottedCount,
      notAllottedCount
    };
  }
}

function maskApplicationNumber(appNum: string): string {
  if (appNum.length <= 4) return '****';
  return '***' + appNum.slice(-4);
}
