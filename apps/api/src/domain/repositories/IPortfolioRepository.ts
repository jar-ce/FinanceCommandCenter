import {
  PortfolioRecord,
  PortfolioTransactionRecord
} from '@finance-command-center/shared-types';
import { PortfolioTransactionInsert } from '../../db/schema/portfolio-transactions.js';

export interface IPortfolioRepository {
  createPortfolio(data: { userId: string; name: string; description?: string }): Promise<PortfolioRecord>;
  getUserPortfolios(userId: string, includeArchived?: boolean): Promise<PortfolioRecord[]>;
  getPortfolioById(id: string, userId: string): Promise<PortfolioRecord | null>;
  updatePortfolio(id: string, userId: string, data: { name?: string; description?: string }): Promise<PortfolioRecord | null>;
  archivePortfolio(id: string, userId: string): Promise<PortfolioRecord | null>;
  restorePortfolio(id: string, userId: string): Promise<PortfolioRecord | null>;
  
  // Row locking for concurrent SELL protection
  lockPortfolioForUpdate(tx: any, id: string, userId: string): Promise<PortfolioRecord | null>;
  
  // Transactions
  addTransaction(tx: any, record: PortfolioTransactionInsert): Promise<PortfolioTransactionRecord>;
  getTransactionsByPortfolioId(portfolioId: string, userId: string): Promise<PortfolioTransactionRecord[]>;
  getTransactionsForHoldingCalculation(portfolioId: string, tx?: any): Promise<PortfolioTransactionRecord[]>;
}
