import { Decimal } from 'decimal.js';
import { IPortfolioRepository } from '../repositories/IPortfolioRepository.js';
import { IMarketRepository } from '../repositories/IMarketRepository.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import { withTransaction } from '../../db/index.js';
import {
  PortfolioRecord,
  PortfolioTransactionRecord,
  PortfolioHoldingRecord,
  PortfolioWithHoldingsRecord,
  PortfolioTransactionType
} from '@finance-command-center/shared-types';

export class PortfolioService {
  constructor(
    private portfolioRepo: IPortfolioRepository,
    private marketRepo: IMarketRepository,
    private auditRepo?: IAuditLogRepository
  ) {}

  async createPortfolio(userId: string, name: string, description?: string): Promise<PortfolioRecord> {
    const trimmedName = name ? name.trim() : '';
    if (!trimmedName) {
      throw new Error('Portfolio name is required and cannot be empty.');
    }

    const created = await this.portfolioRepo.createPortfolio({
      userId,
      name: trimmedName,
      description: description ? description.trim() : undefined
    });

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'PORTFOLIO_CREATED',
        entityType: 'PORTFOLIO',
        entityId: created.id,
        details: { name: created.name }
      }).catch(() => {});
    }

    return created;
  }

  async getUserPortfolios(userId: string, includeArchived: boolean = false): Promise<PortfolioRecord[]> {
    const lists = await this.portfolioRepo.getUserPortfolios(userId, includeArchived);

    // Attach derived active holding counts for each portfolio
    return Promise.all(
      lists.map(async (p) => {
        const holdings = await this.getPortfolioHoldings(p.id, userId);
        return {
          ...p,
          holdingCount: holdings.length
        };
      })
    );
  }

  async getPortfolioDetails(id: string, userId: string): Promise<PortfolioWithHoldingsRecord> {
    const portfolio = await this.portfolioRepo.getPortfolioById(id, userId);
    if (!portfolio) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    const holdings = await this.getPortfolioHoldings(id, userId);

    return {
      ...portfolio,
      holdingCount: holdings.length,
      holdings
    };
  }

  async getPortfolioHoldings(portfolioId: string, userId: string, tx?: any): Promise<PortfolioHoldingRecord[]> {
    const portfolio = tx
      ? await this.portfolioRepo.lockPortfolioForUpdate(tx, portfolioId, userId)
      : await this.portfolioRepo.getPortfolioById(portfolioId, userId);
    if (!portfolio) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    // Retrieve transactions chronologically: transaction_date ASC, created_at ASC, id ASC
    const txs = await this.portfolioRepo.getTransactionsForHoldingCalculation(portfolioId, tx);

    // Group transactions by instrumentId
    const grouped = new Map<string, PortfolioTransactionRecord[]>();
    for (const tx of txs) {
      if (!grouped.has(tx.instrumentId)) {
        grouped.set(tx.instrumentId, []);
      }
      grouped.get(tx.instrumentId)!.push(tx);
    }

    const rawHoldings: Array<{
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
    }> = [];

    // Calculate cost basis and quantity per instrument using Decimal.js
    for (const [instId, instTxs] of grouped.entries()) {
      let qty = new Decimal(0);
      let costBasis = new Decimal(0);
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
          // SELL: costRemoved = averageCost * soldQuantity
          const avgCost = qty.isZero() ? new Decimal(0) : costBasis.div(qty);
          const costRemoved = avgCost.times(txQty);
          costBasis = Decimal.max(0, costBasis.minus(costRemoved));
          qty = Decimal.max(0, qty.minus(txQty));
        }
      }

      // Only active holdings (quantity > 0) are returned
      if (qty.greaterThan(0)) {
        const avgCost = qty.isZero() ? new Decimal(0) : costBasis.div(qty);
        rawHoldings.push({
          instrumentId: instId,
          symbol: sampleTx.symbol || 'UNKNOWN',
          displayName: sampleTx.displayName || 'UNKNOWN',
          exchange: sampleTx.exchange || 'NSE',
          market: 'IN',
          securityType: 'EQUITY',
          currency: 'INR',
          quantity: qty,
          averageCost: avgCost,
          totalAcquisitionCost: costBasis
        });
      }
    }

    if (rawHoldings.length === 0) {
      return [];
    }

    // Batch quote lookup from Phase 9 Market Repository
    const instrumentIds = rawHoldings.map((h) => h.instrumentId);
    const batchQuotes = await this.marketRepo.getBatchQuotes(instrumentIds, tx);
    const quoteMap = new Map(batchQuotes.map((q) => [q.instrumentId, q]));

    // Construct enriched holding records
    return rawHoldings.map((h) => {
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
        unrealizedGainLoss: unrealizedGainLoss ? unrealizedGainLoss.toFixed(4) : null,
        unrealizedGainLossPercent: unrealizedGainLossPercent ? unrealizedGainLossPercent.toFixed(4) : null,
        marketStatus: quote?.marketStatus || 'CLOSED',
        dataFreshness: quote?.dataFreshness || 'UNAVAILABLE',
        asOf: quote?.asOf || null
      };
    });
  }

  async updatePortfolio(id: string, userId: string, data: { name?: string; description?: string }): Promise<PortfolioRecord> {
    if (data.name !== undefined && (!data.name || !data.name.trim())) {
      throw new Error('Portfolio name cannot be empty.');
    }

    const updated = await this.portfolioRepo.updatePortfolio(id, userId, {
      name: data.name ? data.name.trim() : undefined,
      description: data.description !== undefined ? data.description.trim() : undefined
    });

    if (!updated) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'PORTFOLIO_UPDATED',
        entityType: 'PORTFOLIO',
        entityId: updated.id,
        details: { name: updated.name }
      }).catch(() => {});
    }

    return updated;
  }

  async archivePortfolio(id: string, userId: string): Promise<PortfolioRecord> {
    const archived = await this.portfolioRepo.archivePortfolio(id, userId);
    if (!archived) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'PORTFOLIO_ARCHIVED',
        entityType: 'PORTFOLIO',
        entityId: archived.id,
        details: { name: archived.name }
      }).catch(() => {});
    }

    return archived;
  }

  async restorePortfolio(id: string, userId: string): Promise<PortfolioRecord> {
    const restored = await this.portfolioRepo.restorePortfolio(id, userId);
    if (!restored) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'PORTFOLIO_RESTORED',
        entityType: 'PORTFOLIO',
        entityId: restored.id,
        details: { name: restored.name }
      }).catch(() => {});
    }

    return restored;
  }

  async addTransaction(
    portfolioId: string,
    userId: string,
    data: {
      instrumentId: string;
      transactionType: PortfolioTransactionType;
      transactionDate: string;
      quantity: string;
      price: string;
      charges?: string;
      taxes?: string;
      externalReference?: string;
      notes?: string;
    }
  ): Promise<PortfolioTransactionRecord> {
    // Execute inside atomic withTransaction boundary with row locking
    const txResult = await withTransaction(async (tx) => {
      // 1. Lock portfolio row for update to prevent race conditions during concurrent SELL requests
      const portfolio = await this.portfolioRepo.lockPortfolioForUpdate(tx, portfolioId, userId);
      if (!portfolio) {
        throw new Error('PORTFOLIO_NOT_FOUND');
      }

      // 2. Reject mutations on archived portfolios
      if (portfolio.status === 'ARCHIVED') {
        throw new Error('ARCHIVED_PORTFOLIO_MUTATION_MUTED');
      }

      // 3. Verify target market instrument exists
      const instrument = await this.marketRepo.getInstrumentById(data.instrumentId, tx);
      if (!instrument) {
        throw new Error('INSTRUMENT_NOT_FOUND');
      }

      // 4. Validate transaction date (no future-dated transactions allowed)
      const txDate = new Date(data.transactionDate);
      if (isNaN(txDate.getTime())) {
        throw new Error('INVALID_TRANSACTION_DATE');
      }
      if (txDate.getTime() > Date.now() + 60000) { // 1 min margin for clock skew
        throw new Error('FUTURE_TRANSACTION_DATE');
      }

      // 5. Validate numbers via Decimal.js
      const qty = new Decimal(data.quantity);
      const price = new Decimal(data.price);
      const charges = new Decimal(data.charges || '0');
      const taxes = new Decimal(data.taxes || '0');

      if (!qty.isPositive() || qty.isZero()) {
        throw new Error('INVALID_QUANTITY');
      }
      if (price.isNegative()) {
        throw new Error('INVALID_PRICE');
      }
      if (charges.isNegative() || taxes.isNegative()) {
        throw new Error('INVALID_FEES');
      }

      const grossAmount = qty.times(price);
      let totalAmount: Decimal;

      if (data.transactionType === 'BUY') {
        totalAmount = grossAmount.plus(charges).plus(taxes);
      } else if (data.transactionType === 'SELL') {
        totalAmount = grossAmount.minus(charges).minus(taxes);
        if (totalAmount.isNegative()) {
          throw new Error('INVALID_TOTAL_AMOUNT');
        }
      } else {
        throw new Error('INVALID_TRANSACTION_TYPE');
      }

      // 6. SELL Oversell Validation: Calculate current available quantity from transaction history
      if (data.transactionType === 'SELL') {
        const existingHoldings = await this.getPortfolioHoldings(portfolioId, userId, tx);
        const holding = existingHoldings.find((h) => h.instrumentId === data.instrumentId);
        const availableQty = holding ? new Decimal(holding.quantity) : new Decimal(0);

        if (qty.greaterThan(availableQty)) {
          throw new Error('OVERSELL_ERROR');
        }
      }

      // 7. Insert transaction
      const added = await this.portfolioRepo.addTransaction(tx, {
        portfolioId,
        instrumentId: data.instrumentId,
        transactionType: data.transactionType,
        transactionDate: txDate,
        quantity: qty.toFixed(4),
        price: price.toFixed(4),
        grossAmount: grossAmount.toFixed(4),
        charges: charges.toFixed(4),
        taxes: taxes.toFixed(4),
        totalAmount: totalAmount.toFixed(4),
        externalReference: data.externalReference || null,
        notes: data.notes || null
      });

      return {
        added,
        symbol: instrument.symbol,
        displayName: instrument.displayName,
        exchange: instrument.exchange
      };
    });

    // 8. Log audit event outside transaction boundary
    if (this.auditRepo) {
      await this.auditRepo.create({
        userId,
        action: 'PORTFOLIO_TRANSACTION_CREATED',
        entityType: 'PORTFOLIO_TRANSACTION',
        entityId: txResult.added.id,
        details: {
          portfolioId,
          instrumentId: data.instrumentId,
          symbol: txResult.symbol,
          type: data.transactionType,
          quantity: txResult.added.quantity,
          price: txResult.added.price,
          totalAmount: txResult.added.totalAmount
        }
      }).catch(() => {});
    }

    return {
      ...txResult.added,
      symbol: txResult.symbol,
      displayName: txResult.displayName,
      exchange: txResult.exchange
    };
  }

  async getTransactionHistory(portfolioId: string, userId: string): Promise<PortfolioTransactionRecord[]> {
    const portfolio = await this.portfolioRepo.getPortfolioById(portfolioId, userId);
    if (!portfolio) {
      throw new Error('PORTFOLIO_NOT_FOUND');
    }

    return this.portfolioRepo.getTransactionsByPortfolioId(portfolioId, userId);
  }
}
