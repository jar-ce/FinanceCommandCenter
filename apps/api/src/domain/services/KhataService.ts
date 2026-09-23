import { FinancialAmount } from '../value-objects/FinancialAmount.js';
import { IKhataAccountRepository, AccountFilter } from '../repositories/IKhataAccountRepository.js';
import { IKhataTransactionRepository, TransactionFilter } from '../repositories/IKhataTransactionRepository.js';
import { IAuditLogRepository } from '../repositories/IAuditLogRepository.js';
import { KhataAccountRow, NewKhataAccountRow } from '../../db/schema/khata-accounts.js';
import { KhataTransactionRow } from '../../db/schema/khata-transactions.js';

export interface CreateTransactionDTO {
  accountId: string;
  type: 'MONEY_IN' | 'MONEY_OUT';
  amount: string;
  transactionDate: Date;
  description: string;
  reference?: string;
}

export interface AccountWithBalance extends KhataAccountRow {
  netBalance: string;
  totalMoneyIn: string;
  totalMoneyOut: string;
  statusText: 'RECEIVABLE' | 'PAYABLE' | 'SETTLED';
}

export class KhataService {
  constructor(
    private accountRepo: IKhataAccountRepository,
    private txRepo: IKhataTransactionRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async createAccount(userId: string, data: Omit<NewKhataAccountRow, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<KhataAccountRow> {
    const account = await this.accountRepo.create({
      ...data,
      userId
    });

    await this.auditRepo.create({
      userId,
      action: 'KHATA_ACCOUNT_CREATED',
      entityType: 'KHATA_ACCOUNT',
      entityId: account.id,
      details: { displayName: account.displayName, accountType: account.accountType }
    });

    return account;
  }

  async getAccount(id: string, userId: string): Promise<AccountWithBalance | null> {
    const account = await this.accountRepo.findById(id, userId);
    if (!account) return null;

    const totals = await this.txRepo.getAccountTotals(id, userId);
    const moneyIn = new FinancialAmount(totals.totalMoneyIn);
    const moneyOut = new FinancialAmount(totals.totalMoneyOut);
    const balance = moneyIn.subtract(moneyOut);

    let statusText: 'RECEIVABLE' | 'PAYABLE' | 'SETTLED' = 'SETTLED';
    if (balance.toDecimal().greaterThan(0)) {
      statusText = 'RECEIVABLE';
    } else if (balance.toDecimal().lessThan(0)) {
      statusText = 'PAYABLE';
    }

    return {
      ...account,
      netBalance: balance.toDatabaseString(),
      totalMoneyIn: moneyIn.toDatabaseString(),
      totalMoneyOut: moneyOut.toDatabaseString(),
      statusText
    };
  }

  async listAccounts(filter: AccountFilter): Promise<{ accounts: AccountWithBalance[]; summary: { totalReceivable: string; totalPayable: string; netBalance: string } }> {
    const accounts = await this.accountRepo.list(filter);
    const result: AccountWithBalance[] = [];

    let totalReceivableDec = new FinancialAmount('0.0000');
    let totalPayableDec = new FinancialAmount('0.0000');

    for (const acc of accounts) {
      const totals = await this.txRepo.getAccountTotals(acc.id, filter.userId);
      const moneyIn = new FinancialAmount(totals.totalMoneyIn);
      const moneyOut = new FinancialAmount(totals.totalMoneyOut);
      const balance = moneyIn.subtract(moneyOut);

      let statusText: 'RECEIVABLE' | 'PAYABLE' | 'SETTLED' = 'SETTLED';
      if (balance.toDecimal().greaterThan(0)) {
        statusText = 'RECEIVABLE';
        totalReceivableDec = totalReceivableDec.add(balance);
      } else if (balance.toDecimal().lessThan(0)) {
        statusText = 'PAYABLE';
        totalPayableDec = totalPayableDec.add(new FinancialAmount(balance.toDecimal().abs()));
      }

      result.push({
        ...acc,
        netBalance: balance.toDatabaseString(),
        totalMoneyIn: moneyIn.toDatabaseString(),
        totalMoneyOut: moneyOut.toDatabaseString(),
        statusText
      });
    }

    const netOverall = totalReceivableDec.subtract(totalPayableDec);

    return {
      accounts: result,
      summary: {
        totalReceivable: totalReceivableDec.toDatabaseString(),
        totalPayable: totalPayableDec.toDatabaseString(),
        netBalance: netOverall.toDatabaseString()
      }
    };
  }

  async updateAccount(id: string, userId: string, data: Partial<NewKhataAccountRow>): Promise<KhataAccountRow | null> {
    const updated = await this.accountRepo.update(id, userId, data);
    if (updated) {
      await this.auditRepo.create({
        userId,
        action: 'KHATA_ACCOUNT_UPDATED',
        entityType: 'KHATA_ACCOUNT',
        entityId: id,
        details: { fields: Object.keys(data) }
      });
    }
    return updated;
  }

  async archiveAccount(id: string, userId: string): Promise<KhataAccountRow | null> {
    const archived = await this.accountRepo.archive(id, userId);
    if (archived) {
      await this.auditRepo.create({
        userId,
        action: 'KHATA_ACCOUNT_ARCHIVED',
        entityType: 'KHATA_ACCOUNT',
        entityId: id
      });
    }
    return archived;
  }

  async postTransaction(userId: string, dto: CreateTransactionDTO): Promise<KhataTransactionRow> {
    const account = await this.accountRepo.findById(dto.accountId, userId);
    if (!account) {
      throw new Error('KHATA_ACCOUNT_NOT_FOUND');
    }

    if (account.status === 'ARCHIVED') {
      throw new Error('KHATA_ACCOUNT_ARCHIVED');
    }

    const inputAmount = new FinancialAmount(dto.amount);
    if (inputAmount.toDecimal().lessThanOrEqualTo(0)) {
      throw new Error('INVALID_TRANSACTION_AMOUNT');
    }

    const currentTotals = await this.txRepo.getAccountTotals(dto.accountId, userId);
    const currentMoneyIn = new FinancialAmount(currentTotals.totalMoneyIn);
    const currentMoneyOut = new FinancialAmount(currentTotals.totalMoneyOut);

    let newMoneyIn = currentMoneyIn;
    let newMoneyOut = currentMoneyOut;

    if (dto.type === 'MONEY_IN') {
      newMoneyIn = currentMoneyIn.add(inputAmount);
    } else {
      newMoneyOut = currentMoneyOut.add(inputAmount);
    }

    const newBalance = newMoneyIn.subtract(newMoneyOut);

    const transaction = await this.txRepo.create({
      accountId: dto.accountId,
      userId,
      type: dto.type,
      amount: inputAmount.toDatabaseString(),
      runningBalance: newBalance.toDatabaseString(),
      transactionDate: dto.transactionDate,
      description: dto.description,
      reference: dto.reference || null,
      status: 'ACTIVE'
    });

    await this.auditRepo.create({
      userId,
      action: 'KHATA_TRANSACTION_CREATED',
      entityType: 'KHATA_TRANSACTION',
      entityId: transaction.id,
      details: {
        accountId: dto.accountId,
        type: dto.type,
        amount: inputAmount.toDatabaseString(),
        newBalance: newBalance.toDatabaseString()
      }
    });

    return transaction;
  }

  async getAccountLedger(filter: TransactionFilter): Promise<{ transactions: KhataTransactionRow[]; totalCount: number }> {
    const account = await this.accountRepo.findById(filter.accountId, filter.userId);
    if (!account) {
      throw new Error('KHATA_ACCOUNT_NOT_FOUND');
    }
    return await this.txRepo.listByAccountId(filter);
  }

  async reverseTransaction(txId: string, userId: string, reason?: string): Promise<KhataTransactionRow> {
    const tx = await this.txRepo.findById(txId, userId);
    if (!tx) {
      throw new Error('KHATA_TRANSACTION_NOT_FOUND');
    }

    if (tx.status === 'REVERSED') {
      throw new Error('KHATA_TRANSACTION_ALREADY_REVERSED');
    }

    const reversed = await this.txRepo.markReversed(txId, userId, reason);
    if (!reversed) {
      throw new Error('KHATA_TRANSACTION_REVERSAL_FAILED');
    }

    await this.auditRepo.create({
      userId,
      action: 'KHATA_TRANSACTION_REVERSED',
      entityType: 'KHATA_TRANSACTION',
      entityId: txId,
      details: { accountId: tx.accountId, amount: tx.amount, type: tx.type, reason: reason || 'Manual Reversal' }
    });

    return reversed;
  }
}
