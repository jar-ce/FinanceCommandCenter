import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { IIPORepository, IPOSearchFilters } from '../repositories/IIPORepository.js';
import { IIPODataProvider } from '../providers/IIPODataProvider.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import { IPOSelect, IPOInsert } from '../../db/schema/ipos.js';
import { withTransaction } from '../../db/index.js';

export const ipoProviderDtoSchema = z.object({
  externalId: z.string().min(1),
  provider: z.string().min(1),
  source: z.string().min(1),
  issuerName: z.string().min(1),
  ipoName: z.string().min(1),
  symbol: z.string().optional(),
  exchange: z.enum(['NSE', 'BSE', 'NSE_BSE', 'UNKNOWN']).default('UNKNOWN'),
  securityType: z.string().default('EQUITY'),
  issueType: z.enum(['MAINBOARD', 'SME', 'UNKNOWN']).default('MAINBOARD'),
  status: z.enum(['UPCOMING', 'OPEN', 'CLOSED', 'LISTED', 'CANCELLED', 'POSTPONED']).default('UPCOMING'),
  openDate: z.string().optional(),
  closeDate: z.string().optional(),
  listingDate: z.string().optional(),
  faceValue: z.string().optional(),
  priceBandLow: z.string().optional(),
  priceBandHigh: z.string().optional(),
  lotSize: z.number().int().positive().optional(),
  issueSize: z.string().optional(),
  freshIssueSize: z.string().optional(),
  offerForSaleSize: z.string().optional(),
  retrievedAt: z.string().optional()
});

export interface EnrichedIPORecord extends IPOSelect {
  maxLotCost: string | null;
}

export class IPOService {
  constructor(
    private readonly ipoRepo: IIPORepository,
    private readonly dataProvider: IIPODataProvider,
    private readonly auditRepo?: IAuditLogRepository
  ) {}

  private calculateMaxLotCost(priceBandHigh: string | null, lotSize: number | null): string | null {
    if (!priceBandHigh || !lotSize || lotSize <= 0) {
      return null;
    }
    try {
      const price = new Decimal(priceBandHigh);
      if (price.isNaN() || price.isNegative()) return null;
      return price.mul(lotSize).toFixed(4);
    } catch {
      return null;
    }
  }

  private enrichRecord(ipo: IPOSelect): EnrichedIPORecord {
    const maxLotCost = this.calculateMaxLotCost(ipo.priceBandHigh, ipo.lotSize);
    return {
      ...ipo,
      maxLotCost
    };
  }

  async listIPOs(filters: IPOSearchFilters) {
    const { ipos, totalCount } = await this.ipoRepo.list(filters);
    const summary = await this.ipoRepo.getPipelineSummary();
    const enriched = ipos.map(item => this.enrichRecord(item));

    return {
      ipos: enriched,
      pipeline: summary,
      meta: {
        totalCount,
        page: filters.page || 1,
        limit: filters.limit || 50
      }
    };
  }

  async getIPO(id: string): Promise<EnrichedIPORecord | null> {
    const record = await this.ipoRepo.getById(id);
    if (!record) return null;
    return this.enrichRecord(record);
  }

  async syncIPOs(customProvider?: IIPODataProvider, userId?: string) {
    const provider = customProvider || this.dataProvider;
    const now = new Date();

    try {
      const rawDtos = await provider.fetchIPOs();
      let syncedCount = 0;
      let malformedCount = 0;

      const validInserts: IPOInsert[] = [];

      for (const raw of rawDtos) {
        const parsed = ipoProviderDtoSchema.safeParse(raw);
        if (!parsed.success) {
          malformedCount++;
          continue; // Skip malformed provider items
        }

        const dto = parsed.data;
        validInserts.push({
          externalId: dto.externalId,
          provider: dto.provider,
          source: dto.source,
          issuerName: dto.issuerName,
          ipoName: dto.ipoName,
          symbol: dto.symbol || null,
          exchange: dto.exchange,
          securityType: dto.securityType,
          issueType: dto.issueType,
          status: dto.status,
          openDate: dto.openDate ? new Date(dto.openDate) : null,
          closeDate: dto.closeDate ? new Date(dto.closeDate) : null,
          listingDate: dto.listingDate ? new Date(dto.listingDate) : null,
          faceValue: dto.faceValue || null,
          priceBandLow: dto.priceBandLow || null,
          priceBandHigh: dto.priceBandHigh || null,
          lotSize: dto.lotSize || null,
          issueSize: dto.issueSize || null,
          freshIssueSize: dto.freshIssueSize || null,
          offerForSaleSize: dto.offerForSaleSize || null,
          retrievedAt: dto.retrievedAt ? new Date(dto.retrievedAt) : now,
          updatedAt: now
        });
      }

      if (validInserts.length > 0) {
        await withTransaction(async (tx) => {
          for (const insertData of validInserts) {
            await this.ipoRepo.upsert(insertData, tx);
          }
        });
        syncedCount = validInserts.length;
      }

      if (this.auditRepo && userId) {
        await this.auditRepo.create({
          userId,
          action: 'IPO_REFRESHED',
          entityType: 'IPO_MASTER',
          entityId: provider.providerId,
          details: { syncedCount, malformedCount, providerName: provider.providerName, timestamp: now.toISOString() }
        });
      }

      return {
        success: true,
        syncedCount,
        malformedCount,
        providerId: provider.providerId,
        providerName: provider.providerName,
        timestamp: now.toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        syncedCount: 0,
        malformedCount: 0,
        providerId: provider.providerId,
        providerName: provider.providerName,
        error: err.message || 'Provider synchronization failed',
        timestamp: now.toISOString()
      };
    }
  }
}
