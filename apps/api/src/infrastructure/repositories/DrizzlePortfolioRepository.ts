import { eq, and, asc, desc } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { portfolios } from '../../db/schema/portfolios.js';
import { portfolioTransactions, PortfolioTransactionInsert } from '../../db/schema/portfolio-transactions.js';
import { marketInstruments } from '../../db/schema/market-instruments.js';
import { IPortfolioRepository } from '../../domain/repositories/IPortfolioRepository.js';
import {
  PortfolioRecord,
  PortfolioTransactionRecord,
  PortfolioTransactionType
} from '@finance-command-center/shared-types';

export class DrizzlePortfolioRepository implements IPortfolioRepository {
  async createPortfolio(data: { userId: string; name: string; description?: string }): Promise<PortfolioRecord> {
    const db = await getDb();
    const [inserted] = await db
      .insert(portfolios)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description || null,
        status: 'ACTIVE'
      })
      .returning();

    return {
      id: inserted.id,
      userId: inserted.userId,
      name: inserted.name,
      description: inserted.description,
      status: inserted.status as any,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
      archivedAt: inserted.archivedAt ? inserted.archivedAt.toISOString() : null,
      holdingCount: 0
    };
  }

  async getUserPortfolios(userId: string, includeArchived: boolean = false): Promise<PortfolioRecord[]> {
    const db = await getDb();
    const conditions = [eq(portfolios.userId, userId)];
    if (!includeArchived) {
      conditions.push(eq(portfolios.status, 'ACTIVE'));
    }

    const rows = await db
      .select()
      .from(portfolios)
      .where(and(...conditions))
      .orderBy(desc(portfolios.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      description: r.description,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null
    }));
  }

  async getPortfolioById(id: string, userId: string): Promise<PortfolioRecord | null> {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      status: row.status as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null
    };
  }

  async updatePortfolio(id: string, userId: string, data: { name?: string; description?: string }): Promise<PortfolioRecord | null> {
    const db = await getDb();
    const updates: any = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description || null;

    const [updated] = await db
      .update(portfolios)
      .set(updates)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .returning();

    if (!updated) return null;

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      description: updated.description,
      status: updated.status as any,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      archivedAt: updated.archivedAt ? updated.archivedAt.toISOString() : null
    };
  }

  async archivePortfolio(id: string, userId: string): Promise<PortfolioRecord | null> {
    const db = await getDb();
    const [archived] = await db
      .update(portfolios)
      .set({
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .returning();

    if (!archived) return null;

    return {
      id: archived.id,
      userId: archived.userId,
      name: archived.name,
      description: archived.description,
      status: archived.status as any,
      createdAt: archived.createdAt.toISOString(),
      updatedAt: archived.updatedAt.toISOString(),
      archivedAt: archived.archivedAt ? archived.archivedAt.toISOString() : null
    };
  }

  async restorePortfolio(id: string, userId: string): Promise<PortfolioRecord | null> {
    const db = await getDb();
    const [restored] = await db
      .update(portfolios)
      .set({
        status: 'ACTIVE',
        archivedAt: null,
        updatedAt: new Date()
      })
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .returning();

    if (!restored) return null;

    return {
      id: restored.id,
      userId: restored.userId,
      name: restored.name,
      description: restored.description,
      status: restored.status as any,
      createdAt: restored.createdAt.toISOString(),
      updatedAt: restored.updatedAt.toISOString(),
      archivedAt: null
    };
  }

  async lockPortfolioForUpdate(tx: any, id: string, userId: string): Promise<PortfolioRecord | null> {
    const db = tx || (await getDb());
    const [row] = await db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .for('update')
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      status: row.status as any,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null
    };
  }

  async addTransaction(tx: any, record: PortfolioTransactionInsert): Promise<PortfolioTransactionRecord> {
    const db = tx || (await getDb());
    const [inserted] = await db
      .insert(portfolioTransactions)
      .values(record)
      .returning();

    return {
      id: inserted.id,
      portfolioId: inserted.portfolioId,
      instrumentId: inserted.instrumentId,
      transactionType: inserted.transactionType as PortfolioTransactionType,
      transactionDate: inserted.transactionDate.toISOString(),
      quantity: inserted.quantity,
      price: inserted.price,
      grossAmount: inserted.grossAmount,
      charges: inserted.charges,
      taxes: inserted.taxes,
      totalAmount: inserted.totalAmount,
      externalReference: inserted.externalReference || null,
      notes: inserted.notes || null,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString()
    };
  }

  async getTransactionsByPortfolioId(portfolioId: string, _userId: string): Promise<PortfolioTransactionRecord[]> {
    const db = await getDb();
    const rows = await db
      .select({
        id: portfolioTransactions.id,
        portfolioId: portfolioTransactions.portfolioId,
        instrumentId: portfolioTransactions.instrumentId,
        transactionType: portfolioTransactions.transactionType,
        transactionDate: portfolioTransactions.transactionDate,
        quantity: portfolioTransactions.quantity,
        price: portfolioTransactions.price,
        grossAmount: portfolioTransactions.grossAmount,
        charges: portfolioTransactions.charges,
        taxes: portfolioTransactions.taxes,
        totalAmount: portfolioTransactions.totalAmount,
        externalReference: portfolioTransactions.externalReference,
        notes: portfolioTransactions.notes,
        createdAt: portfolioTransactions.createdAt,
        updatedAt: portfolioTransactions.updatedAt,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange
      })
      .from(portfolioTransactions)
      .leftJoin(marketInstruments, eq(portfolioTransactions.instrumentId, marketInstruments.id))
      .where(eq(portfolioTransactions.portfolioId, portfolioId))
      .orderBy(desc(portfolioTransactions.transactionDate), desc(portfolioTransactions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      portfolioId: r.portfolioId,
      instrumentId: r.instrumentId,
      transactionType: r.transactionType as PortfolioTransactionType,
      transactionDate: r.transactionDate.toISOString(),
      quantity: r.quantity,
      price: r.price,
      grossAmount: r.grossAmount,
      charges: r.charges,
      taxes: r.taxes,
      totalAmount: r.totalAmount,
      externalReference: r.externalReference || null,
      notes: r.notes || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      symbol: r.symbol || undefined,
      displayName: r.displayName || undefined,
      exchange: r.exchange as any
    }));
  }

  async getTransactionsForHoldingCalculation(portfolioId: string, tx?: any): Promise<PortfolioTransactionRecord[]> {
    const db = tx || (await getDb());
    // Deterministic ledger ordering: transaction_date ASC, created_at ASC, id ASC
    const rows = await db
      .select({
        id: portfolioTransactions.id,
        portfolioId: portfolioTransactions.portfolioId,
        instrumentId: portfolioTransactions.instrumentId,
        transactionType: portfolioTransactions.transactionType,
        transactionDate: portfolioTransactions.transactionDate,
        quantity: portfolioTransactions.quantity,
        price: portfolioTransactions.price,
        grossAmount: portfolioTransactions.grossAmount,
        charges: portfolioTransactions.charges,
        taxes: portfolioTransactions.taxes,
        totalAmount: portfolioTransactions.totalAmount,
        externalReference: portfolioTransactions.externalReference,
        notes: portfolioTransactions.notes,
        createdAt: portfolioTransactions.createdAt,
        updatedAt: portfolioTransactions.updatedAt,
        symbol: marketInstruments.symbol,
        displayName: marketInstruments.displayName,
        exchange: marketInstruments.exchange,
        market: marketInstruments.market,
        securityType: marketInstruments.securityType,
        currency: marketInstruments.currency
      })
      .from(portfolioTransactions)
      .leftJoin(marketInstruments, eq(portfolioTransactions.instrumentId, marketInstruments.id))
      .where(eq(portfolioTransactions.portfolioId, portfolioId))
      .orderBy(
        asc(portfolioTransactions.transactionDate),
        asc(portfolioTransactions.createdAt),
        asc(portfolioTransactions.id)
      );

    return rows.map((r: any) => ({
      id: r.id,
      portfolioId: r.portfolioId,
      instrumentId: r.instrumentId,
      transactionType: r.transactionType as PortfolioTransactionType,
      transactionDate: r.transactionDate.toISOString(),
      quantity: r.quantity,
      price: r.price,
      grossAmount: r.grossAmount,
      charges: r.charges,
      taxes: r.taxes,
      totalAmount: r.totalAmount,
      externalReference: r.externalReference || null,
      notes: r.notes || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      symbol: r.symbol || undefined,
      displayName: r.displayName || undefined,
      exchange: r.exchange as any
    }));
  }
}
