import { Decimal } from 'decimal.js';
import { IPortfolioRepository } from '../repositories/IPortfolioRepository.js';
import { IMarketRepository } from '../repositories/IMarketRepository.js';
import {
  PnLSummaryRecord,
  HoldingPnLRecord,
  RealizedPnLRecord,
  ValuationCoverageRecord,
  ReturnMetricsRecord,
  MarketDataFreshness
} from '@finance-command-center/shared-types';

export class PnlService {
  constructor(
    private portfolioRepo: IPortfolioRepository,
    private marketRepo: IMarketRepository
  ) {}

  /**
   * Computes the complete chronological P&L state from the transaction ledger.
   */
  private async processLedger(portfolioId: string, userId: string) {
    const portfolio = await this.portfolioRepo.getPortfolioById(portfolioId, userId);
    if (!portfolio) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    // Retrieve transactions chronologically: transaction_date ASC, created_at ASC, id ASC
    const txs = await this.portfolioRepo.getTransactionsForHoldingCalculation(portfolioId);

    // Group transactions by instrumentId
    const grouped = new Map<string, typeof txs>();
    for (const tx of txs) {
      if (!grouped.has(tx.instrumentId)) {
        grouped.set(tx.instrumentId, []);
      }
      grouped.get(tx.instrumentId)!.push(tx);
    }

    const holdingStates: Array<{
      instrumentId: string;
      symbol: string;
      displayName: string;
      exchange: any;
      market: string;
      securityType: any;
      currency: string;
      quantity: Decimal;
      averageCost: Decimal;
      totalAcquisitionCost: Decimal;
      realizedPnL: Decimal;
    }> = [];

    const realizedRecords: RealizedPnLRecord[] = [];
    let portfolioTotalRealized = new Decimal(0);

    for (const [instId, instTxs] of grouped.entries()) {
      let qty = new Decimal(0);
      let costBasis = new Decimal(0);
      let instRealized = new Decimal(0);
      const sampleTx = instTxs[0];

      for (const tx of instTxs) {
        const txQty = new Decimal(tx.quantity);
        const txPrice = new Decimal(tx.price);
        const txCharges = new Decimal(tx.charges || '0');
        const txTaxes = new Decimal(tx.taxes || '0');
        const txGross = txQty.times(txPrice);

        if (tx.transactionType === 'BUY') {
          // BUY: total acquisition cost = gross + charges + taxes
          const txTotalCost = txGross.plus(txCharges).plus(txTaxes);
          costBasis = costBasis.plus(txTotalCost);
          qty = qty.plus(txQty);
        } else if (tx.transactionType === 'SELL') {
          // SELL: costRemoved = averageCostBeforeSell * soldQuantity
          const avgCostBeforeSell = qty.isZero() ? new Decimal(0) : costBasis.div(qty);
          const costRemoved = avgCostBeforeSell.times(txQty);
          const grossProceeds = txGross;
          const netProceeds = grossProceeds.minus(txCharges).minus(txTaxes);
          const txRealized = netProceeds.minus(costRemoved);

          instRealized = instRealized.plus(txRealized);
          portfolioTotalRealized = portfolioTotalRealized.plus(txRealized);

          costBasis = Decimal.max(0, costBasis.minus(costRemoved));
          qty = Decimal.max(0, qty.minus(txQty));

          realizedRecords.push({
            transactionId: tx.id,
            portfolioId: tx.portfolioId,
            instrumentId: tx.instrumentId,
            symbol: tx.symbol || sampleTx.symbol || 'UNKNOWN',
            displayName: tx.displayName || sampleTx.displayName || 'UNKNOWN',
            exchange: (tx.exchange || sampleTx.exchange || 'NSE') as any,
            transactionDate: tx.transactionDate,
            soldQuantity: txQty.toFixed(4),
            price: txPrice.toFixed(4),
            grossProceeds: grossProceeds.toFixed(4),
            charges: txCharges.toFixed(4),
            taxes: txTaxes.toFixed(4),
            netProceeds: netProceeds.toFixed(4),
            averageCostBeforeSell: avgCostBeforeSell.toFixed(4),
            costRemoved: costRemoved.toFixed(4),
            realizedPnL: txRealized.toFixed(4)
          });
        }
      }

      const avgCost = qty.isZero() ? new Decimal(0) : costBasis.div(qty);
      holdingStates.push({
        instrumentId: instId,
        symbol: sampleTx.symbol || 'UNKNOWN',
        displayName: sampleTx.displayName || 'UNKNOWN',
        exchange: sampleTx.exchange || 'NSE',
        market: (sampleTx as any).market || 'IN',
        securityType: (sampleTx as any).securityType || 'EQUITY',
        currency: (sampleTx as any).currency || 'INR',
        quantity: qty,
        averageCost: avgCost,
        totalAcquisitionCost: costBasis,
        realizedPnL: instRealized
      });
    }

    return {
      portfolio,
      txs,
      holdingStates,
      realizedRecords,
      portfolioTotalRealized
    };
  }

  /**
   * Summary P&L Overview (Portfolio Level)
   */
  async getPnLSummary(portfolioId: string, userId: string): Promise<PnLSummaryRecord> {
    const { portfolio, txs, holdingStates, portfolioTotalRealized } = await this.processLedger(portfolioId, userId);

    const activeHoldings = holdingStates.filter((h) => h.quantity.greaterThan(0));
    const instrumentIds = activeHoldings.map((h) => h.instrumentId);

    const batchQuotes = instrumentIds.length > 0
      ? await this.marketRepo.getBatchQuotes(instrumentIds)
      : [];
    const quoteMap = new Map(batchQuotes.map((q) => [q.instrumentId, q]));

    let totalCostBasis = new Decimal(0);
    let totalMarketValue = new Decimal(0);
    let portfolioUnrealized = new Decimal(0);

    let valuedCount = 0;
    let unvaluedCount = 0;
    let hasStale = false;
    let hasLive = false;

    for (const h of activeHoldings) {
      totalCostBasis = totalCostBasis.plus(h.totalAcquisitionCost);
      const quote = quoteMap.get(h.instrumentId);

      if (quote && quote.lastPrice) {
        valuedCount++;
        const currentPrice = new Decimal(quote.lastPrice);
        const mktVal = h.quantity.times(currentPrice);
        totalMarketValue = totalMarketValue.plus(mktVal);
        const holdingUnrealized = mktVal.minus(h.totalAcquisitionCost);
        portfolioUnrealized = portfolioUnrealized.plus(holdingUnrealized);

        if (quote.dataFreshness === 'LIVE') hasLive = true;
        if (quote.dataFreshness === 'STALE') hasStale = true;
      } else {
        unvaluedCount++;
      }
    }

    const totalHoldingsCount = activeHoldings.length;
    const isFullValuation = totalHoldingsCount === 0 || valuedCount === totalHoldingsCount;
    const coveragePercentage = totalHoldingsCount === 0
      ? '100.0000'
      : new Decimal(valuedCount).div(totalHoldingsCount).times(100).toFixed(4);

    let overallFreshness: MarketDataFreshness = 'UNAVAILABLE';
    if (valuedCount > 0) {
      overallFreshness = hasStale ? 'STALE' : (hasLive ? 'LIVE' : 'DELAYED');
    }

    const valuationCoverage: ValuationCoverageRecord = {
      totalHoldingsCount,
      valuedHoldingsCount: valuedCount,
      unvaluedHoldingsCount: unvaluedCount,
      coveragePercentage,
      overallFreshness
    };

    const totalPnL = portfolioTotalRealized.plus(portfolioUnrealized);

    // Latest quote timestamp across valued holdings
    let valuationAsOf: string | null = null;
    for (const quote of batchQuotes) {
      if (quote.lastPrice && quote.asOf) {
        if (!valuationAsOf || new Date(quote.asOf).getTime() > new Date(valuationAsOf).getTime()) {
          valuationAsOf = quote.asOf;
        }
      }
    }
    const calculatedAt = new Date().toISOString();

    // Return metrics calculation
    const returnMetrics = this.calculateReturnMetrics(
      txs,
      holdingStates,
      totalCostBasis,
      totalMarketValue,
      portfolioTotalRealized,
      portfolioUnrealized,
      totalPnL,
      isFullValuation,
      valuationAsOf,
      calculatedAt
    );

    return {
      portfolioId: portfolio.id,
      realizedPnL: portfolioTotalRealized.toFixed(4),
      unrealizedPnL: portfolioUnrealized.toFixed(4),
      totalPnL: totalPnL.toFixed(4),
      totalAcquisitionCost: totalCostBasis.toFixed(4),
      totalMarketValue: totalMarketValue.toFixed(4),
      valuationCoverage,
      returnMetrics,
      valuationAsOf,
      calculatedAt,
      asOf: calculatedAt
    };
  }

  /**
   * Holding-Level P&L Details
   */
  async getHoldingPnL(portfolioId: string, userId: string): Promise<HoldingPnLRecord[]> {
    const { holdingStates } = await this.processLedger(portfolioId, userId);
    const activeHoldings = holdingStates.filter((h) => h.quantity.greaterThan(0));

    if (activeHoldings.length === 0) {
      return [];
    }

    const instrumentIds = activeHoldings.map((h) => h.instrumentId);
    const batchQuotes = await this.marketRepo.getBatchQuotes(instrumentIds);
    const quoteMap = new Map(batchQuotes.map((q) => [q.instrumentId, q]));

    return activeHoldings.map((h) => {
      const quote = quoteMap.get(h.instrumentId);
      const currentPriceStr = quote?.lastPrice || null;

      let marketValue: Decimal | null = null;
      let unrealizedGainLoss: Decimal | null = null;
      let unrealizedGainLossPercent: Decimal | null = null;

      if (currentPriceStr) {
        const currentPrice = new Decimal(currentPriceStr);
        marketValue = h.quantity.times(currentPrice);
        unrealizedGainLoss = marketValue.minus(h.totalAcquisitionCost);
        unrealizedGainLossPercent = h.totalAcquisitionCost.isZero()
          ? new Decimal(0)
          : unrealizedGainLoss.div(h.totalAcquisitionCost).times(100);
      }

      const totalPnL = marketValue ? h.realizedPnL.plus(unrealizedGainLoss!) : null;

      return {
        instrumentId: h.instrumentId,
        symbol: h.symbol,
        displayName: h.displayName,
        exchange: h.exchange,
        market: h.market,
        securityType: h.securityType,
        currency: h.currency,
        quantity: h.quantity.toFixed(4),
        averageCost: h.averageCost.toFixed(4),
        totalAcquisitionCost: h.totalAcquisitionCost.toFixed(4),
        currentPrice: currentPriceStr ? new Decimal(currentPriceStr).toFixed(4) : null,
        marketValue: marketValue ? marketValue.toFixed(4) : null,
        unrealizedPnL: unrealizedGainLoss ? unrealizedGainLoss.toFixed(4) : null,
        unrealizedPnLPercent: unrealizedGainLossPercent ? unrealizedGainLossPercent.toFixed(4) : null,
        realizedPnL: h.realizedPnL.toFixed(4),
        totalPnL: totalPnL ? totalPnL.toFixed(4) : null,
        marketStatus: quote?.marketStatus || 'CLOSED',
        dataFreshness: quote?.dataFreshness || 'UNAVAILABLE',
        asOf: quote?.asOf || null
      };
    });
  }

  /**
   * Realized P&L Ledger (with optional date range filtering)
   */
  async getRealizedPnL(
    portfolioId: string,
    userId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<RealizedPnLRecord[]> {
    const { realizedRecords } = await this.processLedger(portfolioId, userId);

    if (!fromDate && !toDate) {
      return realizedRecords;
    }

    const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toTime = toDate ? new Date(toDate).getTime() : Number.MAX_SAFE_INTEGER;

    return realizedRecords.filter((rec) => {
      const txTime = new Date(rec.transactionDate).getTime();
      return txTime >= fromTime && txTime <= toTime;
    });
  }

  /**
   * Helper: Calculates Return Metrics (Simple Return %, XIRR, CAGR) with numerical safety fallbacks.
   */
  private calculateReturnMetrics(
    txs: any[],
    _holdingStates: any[],
    totalCostBasis: Decimal,
    totalMarketValue: Decimal,
    _portfolioTotalRealized: Decimal,
    portfolioUnrealized: Decimal,
    _totalPnL: Decimal,
    isFullValuation: boolean,
    valuationAsOf: string | null,
    calculatedAt: string
  ): ReturnMetricsRecord {
    // 1. Simple Return %: Rigorously defined as unrealizedPnL / activeCostBasis * 100 when NO SELLs have occurred.
    // If SELL transactions exist, portfolioTotalRealized is non-zero, making simple return on active cost basis misleading (UNAVAILABLE).
    const hasSells = txs.some((tx) => tx.transactionType === 'SELL');
    let simpleReturnPercent: string | null = null;

    if (!hasSells && totalCostBasis.greaterThan(0)) {
      simpleReturnPercent = portfolioUnrealized.div(totalCostBasis).times(100).toFixed(4);
    }

    // 2. XIRR Cash Flows Construction
    // MANDATORY RULE: XIRR requires FULL valuation coverage (all active holdings valued).
    let xirrResult: { rate: number | null; status: 'CALCULATED' | 'UNAVAILABLE'; message?: string };

    if (!isFullValuation) {
      xirrResult = {
        rate: null,
        status: 'UNAVAILABLE',
        message: 'XIRR requires FULL valuation coverage (100% of active holdings valued).'
      };
    } else {
      const cashFlows: Array<{ date: Date; amount: number }> = [];

      for (const tx of txs) {
        const txDate = new Date(tx.transactionDate);
        const totalAmt = new Decimal(tx.totalAmount).toNumber();

        if (tx.transactionType === 'BUY') {
          cashFlows.push({ date: txDate, amount: -totalAmt });
        } else if (tx.transactionType === 'SELL') {
          cashFlows.push({ date: txDate, amount: totalAmt });
        }
      }

      // Terminal market value as current cash inflow
      if (totalMarketValue.greaterThan(0)) {
        cashFlows.push({ date: new Date(), amount: totalMarketValue.toNumber() });
      }

      xirrResult = this.computeXIRR(cashFlows);
    }

    // 3. CAGR Calculation
    // MANDATORY RULE: CAGR is invalid when intermediate cash flows exist, valuation coverage is partial, or period < 30 days.
    let cagrPercent: string | null = null;
    let cagrStatus: 'CALCULATED' | 'UNAVAILABLE' = 'UNAVAILABLE';
    let cagrMsg: string | null = null;

    const isSingleBuyLumpSum = txs.length === 1 && txs[0].transactionType === 'BUY';

    if (isSingleBuyLumpSum && isFullValuation && totalCostBasis.greaterThan(0) && totalMarketValue.greaterThan(0)) {
      const firstDate = new Date(txs[0].transactionDate).getTime();
      const now = Date.now();
      const diffDays = (now - firstDate) / (1000 * 3600 * 24);

      if (diffDays >= 30) {
        const years = diffDays / 365.25;
        const ratio = totalMarketValue.div(totalCostBasis).toNumber();
        if (ratio > 0) {
          const cagrVal = (Math.pow(ratio, 1 / years) - 1) * 100;
          if (!isNaN(cagrVal) && isFinite(cagrVal)) {
            cagrPercent = cagrVal.toFixed(4);
            cagrStatus = 'CALCULATED';
          }
        }
      } else {
        cagrMsg = 'CAGR requires a minimum holding period of 30 days.';
      }
    } else if (!isSingleBuyLumpSum) {
      cagrMsg = 'CAGR is unavailable when intermediate cash flows exist; use XIRR for multi-transaction performance.';
    }

    return {
      simpleReturnPercent,
      xirrPercent: xirrResult.rate !== null ? (xirrResult.rate * 100).toFixed(4) : null,
      xirrStatus: xirrResult.status,
      cagrPercent,
      cagrStatus,
      valuationAsOf,
      calculatedAt,
      message: xirrResult.message || cagrMsg || null
    };
  }

  /**
   * Newton-Raphson Bounded XIRR Numerical Algorithm
   */
  private computeXIRR(cashFlows: Array<{ date: Date; amount: number }>): {
    rate: number | null;
    status: 'CALCULATED' | 'UNAVAILABLE';
    message?: string;
  } {
    if (cashFlows.length < 2) {
      return { rate: null, status: 'UNAVAILABLE', message: 'Insufficient cash flows for XIRR calculation (minimum 2 events required).' };
    }

    // Check same-day cash flows
    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = 0;
    for (const cf of cashFlows) {
      const t = cf.date.getTime();
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }

    if (maxTime - minTime < 86400000) {
      return { rate: null, status: 'UNAVAILABLE', message: 'Same-day cash flows cannot yield an annualized XIRR rate.' };
    }

    let hasPositive = false;
    let hasNegative = false;
    for (const cf of cashFlows) {
      if (cf.amount > 0) hasPositive = true;
      if (cf.amount < 0) hasNegative = true;
    }

    if (!hasPositive || !hasNegative) {
      return { rate: null, status: 'UNAVAILABLE', message: 'Cash flows must contain both inflows (SELL/Value) and outflows (BUY).' };
    }

    const d0 = cashFlows[0].date.getTime();

    const npv = (r: number) => {
      let sum = 0;
      for (const cf of cashFlows) {
        const years = (cf.date.getTime() - d0) / (365.25 * 86400 * 1000);
        sum += cf.amount / Math.pow(1 + r, years);
      }
      return sum;
    };

    const dNpv = (r: number) => {
      let sum = 0;
      for (const cf of cashFlows) {
        const years = (cf.date.getTime() - d0) / (365.25 * 86400 * 1000);
        sum -= (years * cf.amount) / Math.pow(1 + r, years + 1);
      }
      return sum;
    };

    let rate = 0.1; // initial guess 10%
    const maxIter = 100;
    const tol = 1e-6;

    for (let i = 0; i < maxIter; i++) {
      const val = npv(rate);
      if (Math.abs(val) < tol) {
        return { rate, status: 'CALCULATED' };
      }
      const deriv = dNpv(rate);
      if (Math.abs(deriv) < 1e-12) break;

      const nextRate = rate - val / deriv;

      // Bound search between -99.99% (-0.9999) and +10000% (100)
      if (nextRate <= -0.9999 || nextRate > 100 || isNaN(nextRate) || !isFinite(nextRate)) {
        break;
      }

      if (Math.abs(nextRate - rate) < tol) {
        return { rate: nextRate, status: 'CALCULATED' };
      }

      rate = nextRate;
    }

    return { rate: null, status: 'UNAVAILABLE', message: 'XIRR failed to converge within valid numerical bounds.' };
  }
}
