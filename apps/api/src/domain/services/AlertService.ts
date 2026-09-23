import { IAlertRepository } from '../repositories/IAlertRepository.js';
import { IMarketRepository } from '../repositories/IMarketRepository.js';
import { IPortfolioRepository } from '../repositories/IPortfolioRepository.js';
import { IIPORepository } from '../repositories/IIPORepository.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import {
  AlertRuleRecord,
  CreateAlertRuleDTO,
  UpdateAlertRuleDTO,
  AlertRuleStatus
} from '@finance-command-center/shared-types';

export class AlertService {
  constructor(
    private alertRepo: IAlertRepository,
    private marketRepo: IMarketRepository,
    private portfolioRepo: IPortfolioRepository,
    private ipoRepo: IIPORepository,
    private auditLogRepo: IAuditLogRepository
  ) {}

  /**
   * Create new alert rule after validating target existence and ownership.
   */
  async createAlertRule(userId: string, dto: CreateAlertRuleDTO): Promise<AlertRuleRecord> {
    // 1. Target Validation
    if (dto.targetType === 'MARKET_INSTRUMENT') {
      const inst = await this.marketRepo.getInstrumentById(dto.targetId);
      if (!inst) {
        throw new Error('TARGET_NOT_FOUND');
      }
    } else if (dto.targetType === 'PORTFOLIO') {
      const portfolio = await this.portfolioRepo.getPortfolioById(dto.targetId, userId);
      if (!portfolio) {
        throw new Error('TARGET_NOT_FOUND');
      }
    } else if (dto.targetType === 'IPO') {
      const ipo = await this.ipoRepo.getById(dto.targetId);
      if (!ipo) {
        throw new Error('TARGET_NOT_FOUND');
      }
    } else {
      throw new Error('UNSUPPORTED_TARGET_TYPE');
    }

    // 2. Numeric alert validation
    const isNumericAlert = dto.alertType !== 'IPO_OPENING' && dto.alertType !== 'IPO_CLOSING_SOON';
    if (isNumericAlert && !dto.thresholdValue && !dto.thresholdPercent) {
      throw new Error('THRESHOLD_REQUIRED_FOR_NUMERIC_ALERT');
    }

    const rule = await this.alertRepo.createRule(userId, dto);

    // 3. Audit Log Entry
    await this.auditLogRepo.create({
      userId,
      action: 'ALERT_CREATED',
      entityType: 'ALERT_RULE',
      entityId: rule.id,
      details: {
        name: rule.name,
        alertType: rule.alertType,
        targetType: rule.targetType,
        targetId: rule.targetId,
        thresholdValue: rule.thresholdValue,
        cooldownMinutes: rule.cooldownMinutes
      }
    });

    return rule;
  }

  async getAlertRuleById(id: string, userId: string): Promise<AlertRuleRecord | null> {
    return this.alertRepo.getRuleById(id, userId);
  }

  async getUserAlertRules(userId: string, status?: AlertRuleStatus): Promise<AlertRuleRecord[]> {
    return this.alertRepo.getRulesByUserId(userId, status);
  }

  async updateAlertRule(id: string, userId: string, dto: UpdateAlertRuleDTO): Promise<AlertRuleRecord> {
    const existing = await this.alertRepo.getRuleById(id, userId);
    if (!existing) {
      throw new Error('ALERT_RULE_NOT_FOUND');
    }

    const updated = await this.alertRepo.updateRule(id, userId, dto);
    if (!updated) {
      throw new Error('ALERT_RULE_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'ALERT_UPDATED',
      entityType: 'ALERT_RULE',
      entityId: updated.id,
      details: {
        name: updated.name,
        thresholdValue: updated.thresholdValue,
        thresholdPercent: updated.thresholdPercent,
        cooldownMinutes: updated.cooldownMinutes,
        stateReset: dto.thresholdValue !== undefined || dto.thresholdPercent !== undefined
      }
    });

    return updated;
  }

  async pauseAlertRule(id: string, userId: string): Promise<AlertRuleRecord> {
    const updated = await this.alertRepo.updateRuleStatus(id, userId, 'PAUSED');
    if (!updated) {
      throw new Error('ALERT_RULE_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'ALERT_PAUSED',
      entityType: 'ALERT_RULE',
      entityId: updated.id,
      details: { status: 'PAUSED' }
    });

    return updated;
  }

  async resumeAlertRule(id: string, userId: string): Promise<AlertRuleRecord> {
    const updated = await this.alertRepo.updateRuleStatus(id, userId, 'ACTIVE');
    if (!updated) {
      throw new Error('ALERT_RULE_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'ALERT_RESUMED',
      entityType: 'ALERT_RULE',
      entityId: updated.id,
      details: { status: 'ACTIVE' }
    });

    return updated;
  }

  async archiveAlertRule(id: string, userId: string): Promise<AlertRuleRecord> {
    const updated = await this.alertRepo.updateRuleStatus(id, userId, 'ARCHIVED');
    if (!updated) {
      throw new Error('ALERT_RULE_NOT_FOUND');
    }

    await this.auditLogRepo.create({
      userId,
      action: 'ALERT_ARCHIVED',
      entityType: 'ALERT_RULE',
      entityId: updated.id,
      details: { status: 'ARCHIVED' }
    });

    return updated;
  }
}
