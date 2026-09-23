import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { IIPOAllotmentRepository, IPOAllotmentSearchFilters, EnrichedIPOAllotmentResult } from '../repositories/IIPOAllotmentRepository.js';
import { IIPOApplicationRepository } from '../repositories/IIPOApplicationRepository.js';
import { IIPORepository } from '../repositories/IIPORepository.js';
import { IIPOAllotmentProvider } from '../providers/IIPOAllotmentProvider.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';

export const manualVerifyAllotmentSchema = z.object({
  allotmentStatus: z.enum(['UNKNOWN', 'PENDING', 'ALLOTTED', 'PARTIALLY_ALLOTTED', 'NOT_ALLOTTED', 'REJECTED']),
  allottedQuantity: z.number().int().min(0, 'Allotted quantity must be non-negative'),
  notes: z.string().max(1000).optional(),
  source: z.string().max(255).optional()
});

export class IPOAllotmentService {
  constructor(
    private readonly allotmentRepo: IIPOAllotmentRepository,
    private readonly appRepo: IIPOApplicationRepository,
    private readonly ipoRepo: IIPORepository,
    private readonly provider: IIPOAllotmentProvider,
    private readonly auditRepo?: IAuditLogRepository
  ) {}

  async listAllotments(filters: IPOAllotmentSearchFilters) {
    const result = await this.allotmentRepo.list(filters);
    const summary = await this.allotmentRepo.getSummary(filters.userId);

    return {
      allotments: result.allotments,
      summary,
      meta: {
        totalCount: result.totalCount,
        page: filters.page || 1,
        limit: filters.limit || 50
      }
    };
  }

  async getAllotment(id: string, userId: string): Promise<EnrichedIPOAllotmentResult | null> {
    return this.allotmentRepo.getById(id, userId);
  }

  async getAllotmentByApplicationId(applicationId: string, userId: string): Promise<EnrichedIPOAllotmentResult | null> {
    return this.allotmentRepo.getByApplicationId(applicationId, userId);
  }

  async checkAllotment(applicationId: string, userId: string): Promise<EnrichedIPOAllotmentResult> {
    // 1. Verify application exists and belongs to requesting user
    const application = await this.appRepo.getById(applicationId, userId);
    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND: Application does not exist or access denied.');
    }

    // 2. Fetch canonical IPO details
    const ipo = await this.ipoRepo.getById(application.ipoId);

    // 3. Audit check request
    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'IPO_ALLOTMENT_CHECK_REQUESTED',
        entityType: 'IPO_APPLICATION',
        entityId: applicationId,
        details: { providerId: this.provider.providerId }
      });
    }

    // 4. Request provider check
    const providerDto = await this.provider.checkAllotment({
      applicationId: application.id,
      ipoSymbol: ipo?.symbol,
      issuerName: ipo?.issuerName,
      applicationNumber: application.paymentReference || undefined,
      appliedQuantity: application.quantityApplied
    });

    const isProviderUnavailable =
      providerDto.verificationStatus === 'MANUAL_REQUIRED' ||
      providerDto.verificationStatus === 'UNAVAILABLE' ||
      providerDto.allotmentStatus === 'UNKNOWN';

    // Protect VERIFIED results from being overwritten/downgraded by unavailable provider responses
    const existing = await this.allotmentRepo.getByApplicationId(applicationId, userId);
    if (existing && existing.verificationStatus === 'VERIFIED' && isProviderUnavailable) {
      if (this.auditRepo) {
        await this.auditRepo.create({
          userId,
          action: 'IPO_ALLOTMENT_CHECK_UNAVAILABLE',
          entityType: 'IPO_ALLOTMENT_RESULT',
          entityId: existing.id,
          details: {
            reason: 'Provider returned MANUAL_REQUIRED/UNAVAILABLE; preserved existing VERIFIED result.',
            preservedStatus: existing.allotmentStatus
          }
        });
      }
      return existing;
    }

    // 5. Strict Quantity Validation
    this.validateQuantities(providerDto.appliedQuantity, providerDto.allottedQuantity, providerDto.allotmentStatus);

    // 6. Calculate ratio via Decimal.js
    const ratioStr = new Decimal(providerDto.allottedQuantity).div(providerDto.appliedQuantity).toFixed(4);

    // 7. Upsert canonical single current allotment result
    const upserted = await this.allotmentRepo.upsert({
      userId,
      applicationId,
      allotmentStatus: providerDto.allotmentStatus,
      verificationStatus: providerDto.verificationStatus,
      verificationMethod: providerDto.verificationMethod,
      appliedQuantity: providerDto.appliedQuantity,
      allottedQuantity: providerDto.allottedQuantity,
      allotmentRatio: ratioStr,
      provider: providerDto.provider,
      source: providerDto.source,
      externalReference: providerDto.externalReference || null,
      retrievedAt: providerDto.retrievedAt || new Date(),
      verifiedAt: providerDto.verifiedAt || null,
      notes: providerDto.notes || null
    });

    // 8. Audit result retrieval or unavailable check
    if (this.auditRepo) {
      if (isProviderUnavailable) {
        await this.auditRepo.create({
          userId,
          action: 'IPO_ALLOTMENT_CHECK_UNAVAILABLE',
          entityType: 'IPO_ALLOTMENT_RESULT',
          entityId: upserted.id,
          details: {
            providerId: this.provider.providerId,
            verificationStatus: providerDto.verificationStatus,
            allotmentStatus: providerDto.allotmentStatus
          }
        });
      } else {
        await this.auditRepo.create({
          userId,
          action: 'IPO_ALLOTMENT_RESULT_RETRIEVED',
          entityType: 'IPO_ALLOTMENT_RESULT',
          entityId: upserted.id,
          details: {
            allotmentStatus: providerDto.allotmentStatus,
            verificationStatus: providerDto.verificationStatus,
            allottedQuantity: providerDto.allottedQuantity
          }
        });
      }
    }

    const result = await this.allotmentRepo.getById(upserted.id, userId);
    return result!;
  }

  async recordManualVerification(
    applicationId: string,
    userId: string,
    input: z.infer<typeof manualVerifyAllotmentSchema>
  ): Promise<EnrichedIPOAllotmentResult> {
    // 1. Verify application ownership
    const application = await this.appRepo.getById(applicationId, userId);
    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND: Application does not exist or access denied.');
    }

    const appliedQuantity = application.quantityApplied;
    const allottedQuantity = input.allottedQuantity;

    // 2. Strict Quantity & Status Validation
    this.validateQuantities(appliedQuantity, allottedQuantity, input.allotmentStatus);

    // 3. Compute ratio via Decimal.js
    const ratioStr = new Decimal(allottedQuantity).div(appliedQuantity).toFixed(4);

    const now = new Date();
    const sourceText = input.source && input.source.trim()
      ? input.source.trim()
      : 'User Manual Confirmation (Official Registrar Portal)';

    // 4. Upsert single canonical result with verificationMethod = MANUAL and verificationStatus = VERIFIED
    const upserted = await this.allotmentRepo.upsert({
      userId,
      applicationId,
      allotmentStatus: input.allotmentStatus,
      verificationStatus: 'VERIFIED',
      verificationMethod: 'MANUAL',
      appliedQuantity,
      allottedQuantity,
      allotmentRatio: ratioStr,
      provider: 'MANUAL_VERIFICATION',
      source: sourceText,
      externalReference: null,
      retrievedAt: now,
      verifiedAt: now,
      notes: input.notes || 'Manually verified by user with explicit confirmation.'
    });

    // 5. Audit manual verification
    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'IPO_ALLOTMENT_MANUAL_VERIFICATION',
        entityType: 'IPO_ALLOTMENT_RESULT',
        entityId: upserted.id,
        details: {
          allotmentStatus: input.allotmentStatus,
          allottedQuantity,
          verificationMethod: 'MANUAL'
        }
      });
    }

    const result = await this.allotmentRepo.getById(upserted.id, userId);
    return result!;
  }

  private validateQuantities(appliedQty: number, allottedQty: number, status: string) {
    if (appliedQty <= 0) {
      throw new Error('INVALID_QUANTITY: Applied quantity must be strictly greater than 0.');
    }
    if (allottedQty < 0) {
      throw new Error('INVALID_QUANTITY: Allotted quantity cannot be negative.');
    }
    if (allottedQty > appliedQty) {
      throw new Error('INVALID_QUANTITY: Allotted quantity cannot exceed applied quantity.');
    }

    if (status === 'ALLOTTED') {
      if (allottedQty !== appliedQty) {
        throw new Error('INVALID_ALLOTMENT_STATUS: ALLOTTED status requires allotted quantity to equal applied quantity.');
      }
    }
    if (status === 'PARTIALLY_ALLOTTED') {
      if (allottedQty <= 0 || allottedQty >= appliedQty) {
        throw new Error('INVALID_ALLOTMENT_STATUS: PARTIALLY_ALLOTTED requires allotted quantity strictly between 0 and applied quantity.');
      }
    }
    if (status === 'NOT_ALLOTTED' || status === 'REJECTED') {
      if (allottedQty !== 0) {
        throw new Error('INVALID_ALLOTMENT_STATUS: NOT_ALLOTTED or REJECTED status requires allotted quantity to be 0.');
      }
    }
  }
}
