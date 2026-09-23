import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleKhataTransactionRepository } from '../infrastructure/repositories/DrizzleKhataTransactionRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { KhataService } from '../domain/services/KhataService.js';

import { requireAuthentication } from '../infrastructure/auth/authMiddleware.js';

const createAccountSchema = z.object({
  displayName: z.string().min(2).max(255),
  phone: z.string().max(20).optional(),
  accountType: z.enum(['CUSTOMER', 'SUPPLIER', 'BUSINESS', 'PERSONAL']).default('CUSTOMER'),
  notes: z.string().max(1000).optional()
});

const updateAccountSchema = createAccountSchema.partial();

const createTransactionSchema = z.object({
  type: z.enum(['MONEY_IN', 'MONEY_OUT']),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid amount format. Must be positive numeric with up to 4 decimal places.'),
  transactionDate: z.string().datetime(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional()
});

export async function khataRoutes(fastify: FastifyInstance) {
  const accountRepo = new DrizzleKhataAccountRepository();
  const txRepo = new DrizzleKhataTransactionRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const khataService = new KhataService(accountRepo, txRepo, auditRepo);

  // Fail-closed Principal Identity preHandler Hook
  fastify.addHook('preHandler', requireAuthentication);

  // List Accounts with filters
  fastify.get('/accounts', async (request, reply) => {
    const userId = (request as any).userId;
    const query = request.query as { search?: string; accountType?: string; status?: string };
    const result = await khataService.listAccounts({
      userId,
      search: query.search,
      accountType: query.accountType,
      status: query.status || 'ACTIVE'
    });

    return reply.send({
      success: true,
      data: result.accounts,
      meta: {
        summary: result.summary,
        count: result.accounts.length
      }
    });
  });

  // Create Account
  fastify.post('/accounts', async (request, reply) => {
    const userId = (request as any).userId;
    const body = createAccountSchema.parse(request.body);
    const account = await khataService.createAccount(userId, body);
    return reply.status(201).send({
      success: true,
      data: account
    });
  });

  // Get Account Details
  fastify.get('/accounts/:id', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const account = await khataService.getAccount(id, userId);
    if (!account) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Khata account not found.' }
      });
    }
    return reply.send({ success: true, data: account });
  });

  // Update Account Details
  fastify.patch('/accounts/:id', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const body = updateAccountSchema.parse(request.body);
    const updated = await khataService.updateAccount(id, userId, body);
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Khata account not found.' }
      });
    }
    return reply.send({ success: true, data: updated });
  });

  // Archive Account
  fastify.post('/accounts/:id/archive', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const archived = await khataService.archiveAccount(id, userId);
    if (!archived) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Khata account not found.' }
      });
    }
    return reply.send({ success: true, data: archived });
  });

  // Get Account Transaction Ledger
  fastify.get('/accounts/:id/transactions', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const query = request.query as { type?: string; page?: string; limit?: string };

    try {
      const result = await khataService.getAccountLedger({
        accountId: id,
        userId,
        type: query.type,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 50
      });

      return reply.send({
        success: true,
        data: result.transactions,
        meta: { totalCount: result.totalCount }
      });
    } catch (err: any) {
      if (err.message === 'KHATA_ACCOUNT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Khata account not found.' }
        });
      }
      throw err;
    }
  });

  // Post Money In / Money Out Transaction
  fastify.post('/accounts/:id/transactions', async (request, reply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const body = createTransactionSchema.parse(request.body);

    try {
      const transaction = await khataService.postTransaction(userId, {
        accountId: id,
        type: body.type,
        amount: body.amount,
        transactionDate: new Date(body.transactionDate),
        description: body.description,
        reference: body.reference
      });

      return reply.status(201).send({
        success: true,
        data: transaction
      });
    } catch (err: any) {
      if (err.message === 'KHATA_ACCOUNT_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Khata account not found.' }
        });
      }
      if (err.message === 'KHATA_ACCOUNT_ARCHIVED') {
        return reply.status(400).send({
          success: false,
          error: { code: 'ACCOUNT_ARCHIVED', message: 'Cannot post transactions to an archived account.' }
        });
      }
      if (err.message === 'INVALID_TRANSACTION_AMOUNT') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Transaction amount must be strictly greater than 0.' }
        });
      }
      throw err;
    }
  });

  // Reverse Transaction
  fastify.delete('/accounts/:id/transactions/:txId', async (request, reply) => {
    const userId = (request as any).userId;
    const { txId } = request.params as { txId: string };
    const body = (request.body as { reason?: string }) || {};

    try {
      const reversed = await khataService.reverseTransaction(txId, userId, body.reason);
      return reply.send({ success: true, data: reversed });
    } catch (err: any) {
      if (err.message === 'KHATA_TRANSACTION_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transaction not found.' }
        });
      }
      if (err.message === 'KHATA_TRANSACTION_ALREADY_REVERSED') {
        return reply.status(400).send({
          success: false,
          error: { code: 'ALREADY_REVERSED', message: 'Transaction has already been reversed.' }
        });
      }
      throw err;
    }
  });
}
