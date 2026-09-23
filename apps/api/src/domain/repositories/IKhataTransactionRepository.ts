import { KhataTransactionRow, NewKhataTransactionRow } from '../../db/schema/khata-transactions.js';

export interface TransactionFilter {
  accountId: string;
  userId: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IKhataTransactionRepository {
  create(data: NewKhataTransactionRow): Promise<KhataTransactionRow>;
  findById(id: string, userId: string): Promise<KhataTransactionRow | null>;
  listByAccountId(filter: TransactionFilter): Promise<{ transactions: KhataTransactionRow[]; totalCount: number }>;
  markReversed(id: string, userId: string, reason?: string): Promise<KhataTransactionRow | null>;
  getAccountTotals(accountId: string, userId: string): Promise<{ totalMoneyIn: string; totalMoneyOut: string }>;
}
