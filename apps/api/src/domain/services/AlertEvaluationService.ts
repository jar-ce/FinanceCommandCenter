import { Decimal } from 'decimal.js';
import { IAlertRepository } from '../repositories/IAlertRepository.js';
import { IMarketRepository } from '../repositories/IMarketRepository.js';
import { IIPORepository } from '../repositories/IIPORepository.js';
import { PnlService } from './PnlService.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import {
  AlertRuleRecord,
  AlertEvaluationResult,
  AlertEvaluationState,
  NotificationType
} from '@finance-command-center/shared-types';

export class AlertEvaluationService {
  constructor(
    private alertRepo: IAlertRepository,
    private marketRepo: IMarketRepository,
    private ipoRepo: IIPORepository,
    private pnlService: PnlService,
    private auditLogRepo: IAuditLogRepository
  ) {}

  /**
   * Evaluate a single alert rule against current market/portfolio/IPO data.
   */
  async evaluateRule(ruleId: string, userId: string): Promise<AlertEvaluationResult> {
    const rule = await this.alertRepo.getRuleById(ruleId, userId);
    if (!rule || rule.status !== 'ACTIVE') {
      return { ruleId, triggered: false, reason: 'RULE_INACTIVE_OR_NOT_FOUND' };
    }

    return this.processRuleEvaluation(rule);
  }

  /**
   * Evaluate all active rules belonging to the authenticated user.
   */
  async evaluateAllUserRules(userId: string): Promise<AlertEvaluationResult[]> {
    const activeRules = await this.alertRepo.getActiveRulesForEvaluation(userId);
    const results: AlertEvaluationResult[] = [];

    for (const rule of activeRules) {
      const res = await this.processRuleEvaluation(rule);
      results.push(res);
    }

    return results;
  }

  private async processRuleEvaluation(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    const now = new Date();

    // ----------------------------------------------------
    // 1. DATA FETCHING & FRESHNESS POLICY GUARD
    // ----------------------------------------------------
    let currentValueDec: Decimal | null = null;
    let currentValStr: string | null = null;
    let targetSnapshot: Record<string, unknown> = {};
    let isStateAlert = false;
    let stateConditionMet = false;
    let nextEvaluatedState: AlertEvaluationState = rule.lastEvaluatedState;

    if (rule.targetType === 'MARKET_INSTRUMENT') {
      const quote = await this.marketRepo.getQuoteByInstrumentId(rule.targetId);
      if (!quote || quote.dataFreshness === 'STALE' || quote.dataFreshness === 'UNAVAILABLE' || !quote.lastPrice) {
        return {
          ruleId: rule.id,
          triggered: false,
          reason: 'QUOTE_STALE_OR_UNAVAILABLE'
        };
      }

      targetSnapshot = {
        symbol: quote.symbol,
        displayName: quote.displayName,
        lastPrice: quote.lastPrice,
        changePercent: quote.changePercent,
        volume: quote.volume,
        dataFreshness: quote.dataFreshness,
        asOf: quote.asOf || quote.retrievedAt
      };

      if (rule.alertType === 'PRICE_ABOVE' || rule.alertType === 'PRICE_BELOW') {
        currentValueDec = new Decimal(quote.lastPrice);
        currentValStr = currentValueDec.toFixed(4);
      } else if (rule.alertType === 'PRICE_CHANGE_PERCENT_ABOVE' || rule.alertType === 'PRICE_CHANGE_PERCENT_BELOW') {
        currentValueDec = new Decimal(quote.changePercent);
        currentValStr = currentValueDec.toFixed(4);
      } else if (rule.alertType === 'VOLUME_ABOVE') {
        currentValueDec = new Decimal(quote.volume);
        currentValStr = currentValueDec.toFixed(4);
      }
    } else if (rule.targetType === 'PORTFOLIO') {
      try {
        const pnlSummary = await this.pnlService.getPnLSummary(rule.targetId, rule.userId);
        if (pnlSummary.valuationCoverage.coveragePercentage !== '100.0000') {
          return {
            ruleId: rule.id,
            triggered: false,
            reason: 'PORTFOLIO_VALUATION_INCOMPLETE'
          };
        }

        targetSnapshot = {
          portfolioId: pnlSummary.portfolioId,
          totalPnL: pnlSummary.totalPnL,
          unrealizedPnL: pnlSummary.unrealizedPnL,
          realizedPnL: pnlSummary.realizedPnL,
          coverage: pnlSummary.valuationCoverage,
          calculatedAt: pnlSummary.calculatedAt
        };

        if (rule.alertType === 'PORTFOLIO_TOTAL_PNL_ABOVE' || rule.alertType === 'PORTFOLIO_TOTAL_PNL_BELOW') {
          currentValueDec = new Decimal(pnlSummary.totalPnL);
          currentValStr = currentValueDec.toFixed(4);
        } else if (
          rule.alertType === 'PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE' ||
          rule.alertType === 'PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW'
        ) {
          const simpleReturn = pnlSummary.returnMetrics.simpleReturnPercent;
          if (simpleReturn === null) {
            return {
              ruleId: rule.id,
              triggered: false,
              reason: 'PORTFOLIO_RETURN_METRIC_UNAVAILABLE'
            };
          }
          currentValueDec = new Decimal(simpleReturn);
          currentValStr = currentValueDec.toFixed(4);
        }
      } catch (err) {
        return {
          ruleId: rule.id,
          triggered: false,
          reason: 'PORTFOLIO_NOT_FOUND'
        };
      }
    } else if (rule.targetType === 'IPO') {
      const ipo = await this.ipoRepo.getById(rule.targetId);
      if (!ipo) {
        return {
          ruleId: rule.id,
          triggered: false,
          reason: 'IPO_NOT_FOUND'
        };
      }

      isStateAlert = true;
      targetSnapshot = {
        ipoName: ipo.ipoName,
        issuerName: ipo.issuerName,
        status: ipo.status,
        openDate: ipo.openDate,
        closeDate: ipo.closeDate
      };

      if (rule.alertType === 'IPO_OPENING') {
        stateConditionMet = ipo.status === 'OPEN';
        nextEvaluatedState = ipo.status === 'OPEN' ? 'ABOVE' : 'BELOW';
      } else if (rule.alertType === 'IPO_CLOSING_SOON') {
        if (ipo.closeDate && ipo.status === 'OPEN') {
          const closeTime = new Date(ipo.closeDate).getTime();
          const thresholdHours = rule.thresholdValue ? new Decimal(rule.thresholdValue).toNumber() : 24;
          const diffHours = (closeTime - now.getTime()) / (1000 * 3600);
          stateConditionMet = diffHours > 0 && diffHours <= thresholdHours;
          nextEvaluatedState = stateConditionMet ? 'ABOVE' : 'BELOW';
        }
      }
    }

    // ----------------------------------------------------
    // 2. THRESHOLD CROSSING & STATE TRANSITION LOGIC
    // ----------------------------------------------------
    let isCrossingTrigger = false;
    let thresholdDec: Decimal | null = null;

    if (!isStateAlert && currentValueDec !== null) {
      const thresholdStr = rule.thresholdValue || rule.thresholdPercent;
      if (!thresholdStr) {
        return { ruleId: rule.id, triggered: false, reason: 'MISSING_THRESHOLD' };
      }
      thresholdDec = new Decimal(thresholdStr);

      const isAboveCondition =
        rule.alertType === 'PRICE_ABOVE' ||
        rule.alertType === 'PRICE_CHANGE_PERCENT_ABOVE' ||
        rule.alertType === 'VOLUME_ABOVE' ||
        rule.alertType === 'PORTFOLIO_TOTAL_PNL_ABOVE' ||
        rule.alertType === 'PORTFOLIO_UNREALIZED_PNL_PERCENT_ABOVE';

      const isBelowCondition =
        rule.alertType === 'PRICE_BELOW' ||
        rule.alertType === 'PRICE_CHANGE_PERCENT_BELOW' ||
        rule.alertType === 'PORTFOLIO_TOTAL_PNL_BELOW' ||
        rule.alertType === 'PORTFOLIO_UNREALIZED_PNL_PERCENT_BELOW';

      if (isAboveCondition) {
        const isCurrentlyAbove = currentValueDec.greaterThanOrEqualTo(thresholdDec);
        if (isCurrentlyAbove) {
          nextEvaluatedState = 'ABOVE';
          // Trigger ONLY if previous state was NOT ABOVE (state transition BELOW -> ABOVE)
          if (rule.lastEvaluatedState !== 'ABOVE') {
            isCrossingTrigger = true;
          }
        } else {
          nextEvaluatedState = 'BELOW'; // State reset when dropping back below!
        }
      } else if (isBelowCondition) {
        const isCurrentlyBelow = currentValueDec.lessThanOrEqualTo(thresholdDec);
        if (isCurrentlyBelow) {
          nextEvaluatedState = 'BELOW';
          // Trigger ONLY if previous state was NOT BELOW (state transition ABOVE -> BELOW)
          if (rule.lastEvaluatedState !== 'BELOW') {
            isCrossingTrigger = true;
          }
        } else {
          nextEvaluatedState = 'ABOVE'; // State reset when rising back above!
        }
      }
    } else if (isStateAlert) {
      if (stateConditionMet && rule.lastEvaluatedState !== 'ABOVE') {
        isCrossingTrigger = true;
      }
    }

    // ----------------------------------------------------
    // 3. STATE UPDATE WITHOUT TRIGGER IF NO CROSSING
    // ----------------------------------------------------
    if (!isCrossingTrigger) {
      // Persist updated evaluation value/state without creating notification event
      await this.alertRepo.updateRuleEvaluationState(
        rule.id,
        currentValStr,
        nextEvaluatedState
      );

      return {
        ruleId: rule.id,
        triggered: false,
        reason: 'CONDITION_NOT_MET_OR_NO_STATE_TRANSITION'
      };
    }

    // ----------------------------------------------------
    // 4. SERVER-SIDE COOLDOWN ENFORCEMENT
    // ----------------------------------------------------
    if (rule.lastTriggeredAt) {
      const lastTrigTime = new Date(rule.lastTriggeredAt).getTime();
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (now.getTime() - lastTrigTime < cooldownMs) {
        // Cooldown active -> update evaluated state, suppress trigger event
        await this.alertRepo.updateRuleEvaluationState(
          rule.id,
          currentValStr,
          nextEvaluatedState
        );
        return {
          ruleId: rule.id,
          triggered: false,
          reason: 'COOLDOWN_ACTIVE'
        };
      }
    }

    // ----------------------------------------------------
    // 5. ATOMIC TRIGGER TRANSACTION & NOTIFICATION CREATION
    // ----------------------------------------------------
    const timestampWindow = Math.floor(now.getTime() / 1000);
    const dedupKey = `${rule.id}_${timestampWindow}`;

    let notificationType: NotificationType = 'MARKET_ALERT';
    let title = `Alert Triggered: ${rule.name}`;
    let message = `Rule condition met for ${rule.name}. Current value: ${currentValStr || 'State Transition'}.`;

    if (rule.targetType === 'PORTFOLIO') {
      notificationType = 'PORTFOLIO_ALERT';
      title = `Portfolio Alert: ${rule.name}`;
      message = `Portfolio condition met. Value: ${currentValStr}.`;
    } else if (rule.targetType === 'IPO') {
      notificationType = 'IPO_ALERT';
      title = `IPO Alert: ${rule.name}`;
      message = `IPO state update: ${rule.alertType === 'IPO_OPENING' ? 'IPO is now OPEN for bidding' : 'IPO is CLOSING SOON'}.`;
    }

    try {
      const { event, notification } = await this.alertRepo.executeTriggerTransaction({
        ruleId: rule.id,
        userId: rule.userId,
        triggerValue: currentValStr,
        thresholdValue: thresholdDec ? thresholdDec.toFixed(4) : null,
        evaluationSnapshot: targetSnapshot,
        deduplicationKey: dedupKey,
        notificationType,
        title,
        message,
        lastEvaluatedValue: currentValStr,
        lastEvaluatedState: nextEvaluatedState
      });

      // Audit Log
      await this.auditLogRepo.create({
        userId: rule.userId,
        action: 'ALERT_TRIGGERED',
        entityType: 'ALERT_RULE',
        entityId: rule.id,
        details: {
          eventId: event.id,
          notificationId: notification.id,
          alertType: rule.alertType,
          triggerValue: currentValStr,
          deduplicationKey: dedupKey
        }
      });

      return {
        ruleId: rule.id,
        triggered: true,
        event,
        notification
      };
    } catch (err: any) {
      // PostgreSQL unique constraint error on deduplicationKey
      if (err.message && err.message.includes('unique constraint')) {
        return {
          ruleId: rule.id,
          triggered: false,
          reason: 'DUPLICATE_DEDUPLICATION_KEY'
        };
      }
      throw err;
    }
  }
}
