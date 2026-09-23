import { Decimal } from 'decimal.js';
import { z } from 'zod';
import {
  IIPOApplicationRepository,
  IPOApplicationSearchFilters,
  EnrichedIPOApplication
} from '../repositories/IIPOApplicationRepository.js';
import { IIPORepository } from '../repositories/IIPORepository.js';
import { IKhataAccountRepository } from '../repositories/IKhataAccountRepository.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';

export const createIPOApplicationSchema = z.object({
  ipoId: z.string().uuid(),
  applicationAccountId: z.string().uuid(),
  applicationDate: z.string().datetime(),
  lotsApplied: z.number().int().positive('Lots applied must be at least 1'),
  quantityApplied: z.number().int().positive().optional(),
  applicationAmount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Application amount must be a positive number with up to 4 decimal places.').optional(),
  paymentReference: z.string().max(255).optional(),
  notes: z.string().max(1000).optional()
});

export const updateIPOApplicationSchema = z.object({
  paymentReference: z.string().max(255).optional(),
  notes: z.string().max(1000).optional()
});

export const transitionStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'COMPLETED', 'CANCELLED'])
});

export class IPOApplicationService {
  constructor(
    private readonly appRepo: IIPOApplicationRepository,
    private readonly ipoRepo: IIPORepository,
    private readonly accountRepo: IKhataAccountRepository,
    private readonly auditRepo?: IAuditLogRepository
  ) {}

  private validateStatusTransition(currentStatus: string, targetStatus: string) {
    if (currentStatus === targetStatus) return;

    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'COMPLETED', 'CANCELLED'],
      PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'COMPLETED', 'CANCELLED'],
      PAYMENT_CONFIRMED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], // Terminal application lifecycle state
      CANCELLED: []  // Terminal application lifecycle state
    };

    const validTargets = allowedTransitions[currentStatus] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new Error(`INVALID_STATUS_TRANSITION: Cannot transition from ${currentStatus} to ${targetStatus}`);
    }
  }

  async listApplications(filters: IPOApplicationSearchFilters) {
    const result = await this.appRepo.list(filters);
    const summary = await this.appRepo.getSummary(filters.userId);

    return {
      applications: result.applications,
      summary,
      meta: {
        totalCount: result.totalCount,
        page: filters.page || 1,
        limit: filters.limit || 50
      }
    };
  }

  async getApplication(id: string, userId: string): Promise<EnrichedIPOApplication | null> {
    return this.appRepo.getById(id, userId);
  }

  async createApplication(userId: string, input: z.infer<typeof createIPOApplicationSchema>) {
    // 1. Verify canonical IPO exists in Phase 6 IPO Master
    const ipo = await this.ipoRepo.getById(input.ipoId);
    if (!ipo) {
      throw new Error('IPO_NOT_FOUND: Referenced IPO master record does not exist.');
    }

    // 2. Verify application account exists, belongs to current user, and is active
    const account = await this.accountRepo.findById(input.applicationAccountId, userId);
    if (!account) {
      throw new Error('ACCOUNT_NOT_FOUND: Application account not found or access denied.');
    }
    if (account.status === 'ARCHIVED' || (account as any).archivedAt) {
      throw new Error('ACCOUNT_ARCHIVED: Cannot use an archived account for an IPO application.');
    }

    // 3. Compute quantity applied if not explicitly passed
    const lotSize = ipo.lotSize && ipo.lotSize > 0 ? ipo.lotSize : 1;
    const quantityApplied = input.quantityApplied && input.quantityApplied > 0
      ? input.quantityApplied
      : input.lotsApplied * lotSize;

    // 4. Compute recorded application amount (use input or fallback to estimated priceBandHigh * quantity)
    let finalAmount: string;
    if (input.applicationAmount && input.applicationAmount.trim()) {
      const decAmount = new Decimal(input.applicationAmount.trim());
      if (decAmount.isNaN() || decAmount.isZero() || decAmount.isNegative()) {
        throw new Error('INVALID_AMOUNT: Application amount must be strictly greater than 0.');
      }
      finalAmount = decAmount.toFixed(4);
    } else if (ipo.priceBandHigh) {
      const price = new Decimal(ipo.priceBandHigh);
      finalAmount = price.mul(quantityApplied).toFixed(4);
    } else {
      throw new Error('MISSING_AMOUNT: Provide explicit application amount when IPO price band is unavailable.');
    }

    // 5. Persist IPO application record
    const created = await this.appRepo.create({
      userId,
      ipoId: input.ipoId,
      applicationAccountId: input.applicationAccountId,
      applicationDate: new Date(input.applicationDate),
      lotsApplied: input.lotsApplied,
      quantityApplied,
      applicationAmount: finalAmount,
      status: 'SUBMITTED',
      paymentReference: input.paymentReference || null,
      notes: input.notes || null
    });

    // 6. Record audit log
    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'IPO_APPLICATION_CREATED',
        entityType: 'IPO_APPLICATION',
        entityId: created.id,
        details: {
          ipoId: input.ipoId,
          applicationAccountId: input.applicationAccountId,
          lotsApplied: input.lotsApplied,
          quantityApplied,
          applicationAmount: finalAmount,
          status: 'SUBMITTED'
        }
      });
    }

    return this.appRepo.getById(created.id, userId);
  }

  async updateApplication(id: string, userId: string, input: z.infer<typeof updateIPOApplicationSchema>) {
    const existing = await this.appRepo.getById(id, userId);
    if (!existing) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    const updated = await this.appRepo.update(id, userId, {
      paymentReference: input.paymentReference !== undefined ? input.paymentReference : existing.paymentReference,
      notes: input.notes !== undefined ? input.notes : existing.notes
    });

    if (updated && this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'IPO_APPLICATION_UPDATED',
        entityType: 'IPO_APPLICATION',
        entityId: id,
        details: {
          updatedFields: Object.keys(input)
        }
      });
    }

    return this.appRepo.getById(id, userId);
  }

  async transitionStatus(id: string, userId: string, targetStatus: string) {
    const existing = await this.appRepo.getById(id, userId);
    if (!existing) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    const upperTarget = targetStatus.toUpperCase();
    this.validateStatusTransition(existing.status, upperTarget);

    const updated = await this.appRepo.updateStatus(id, userId, upperTarget);
    if (updated && this.auditRepo) {
      const action = upperTarget === 'CANCELLED' ? 'IPO_APPLICATION_CANCELLED' : 'IPO_APPLICATION_STATUS_CHANGED';
      await this.auditRepo.create({
        userId,
        action,
        entityType: 'IPO_APPLICATION',
        entityId: id,
        details: {
          previousStatus: existing.status,
          newStatus: upperTarget
        }
      });
    }

    return this.appRepo.getById(id, userId);
  }
}
