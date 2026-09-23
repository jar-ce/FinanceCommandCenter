import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { closeDb, getDb } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { DrizzleKhataAccountRepository } from '../infrastructure/repositories/DrizzleKhataAccountRepository.js';
import { DrizzleKhataTransactionRepository } from '../infrastructure/repositories/DrizzleKhataTransactionRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { KhataService } from '../domain/services/KhataService.js';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Digital Khata Domain, Service & HTTP Identity Boundary Suite', () => {
  const accountRepo = new DrizzleKhataAccountRepository();
  const txRepo = new DrizzleKhataTransactionRepository();
  const auditRepo = new DrizzleAuditLogRepository();
  const khataService = new KhataService(accountRepo, txRepo, auditRepo);

  const testUserId = '00000000-0000-4000-a000-000000000001';
  const userBId = '00000000-0000-4000-a000-000000000002';
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations();
    const db = await getDb();
    // Seed users in database for foreign key constraints
    await db.insert(users).values([
      {
        id: testUserId,
        email: 'khata-test-user@apexos.dev',
        name: 'Khata Test User'
      },
      {
        id: userBId,
        email: 'user-b@apexos.dev',
        name: 'User B'
      }
    ]).onConflictDoNothing();

    app = buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates a new Khata Account and verifies default zero balance', async () => {
    const account = await khataService.createAccount(testUserId, {
      displayName: 'Acme Traders',
      phone: '+91 9876543210',
      accountType: 'CUSTOMER',
      notes: 'Regular wholesale customer'
    });

    expect(account.id).toBeDefined();
    expect(account.displayName).toBe('Acme Traders');

    const details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('0.0000');
    expect(details?.statusText).toBe('SETTLED');
  });

  it('posts MONEY_IN and MONEY_OUT transactions and calculates deterministic balances', async () => {
    const account = await khataService.createAccount(testUserId, {
      displayName: 'Zenith Tech',
      accountType: 'CUSTOMER'
    });

    // 1. Post MONEY_IN (You Gave / Credit = 5000.0000)
    const tx1 = await khataService.postTransaction(testUserId, {
      accountId: account.id,
      type: 'MONEY_IN',
      amount: '5000.0000',
      transactionDate: new Date(),
      description: 'Goods delivered on credit'
    });

    expect(tx1.runningBalance).toBe('5000.0000');

    let details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('5000.0000');
    expect(details?.statusText).toBe('RECEIVABLE');

    // 2. Post MONEY_OUT (You Got / Debit = 1500.0000)
    const tx2 = await khataService.postTransaction(testUserId, {
      accountId: account.id,
      type: 'MONEY_OUT',
      amount: '1500.0000',
      transactionDate: new Date(),
      description: 'Part payment via UPI'
    });

    expect(tx2.runningBalance).toBe('3500.0000');

    details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('3500.0000');
    expect(details?.statusText).toBe('RECEIVABLE');

    // 3. Post MONEY_OUT exceeding balance (4000.0000) -> Net balance becomes -500.0000 (PAYABLE)
    const tx3 = await khataService.postTransaction(testUserId, {
      accountId: account.id,
      type: 'MONEY_OUT',
      amount: '4000.0000',
      transactionDate: new Date(),
      description: 'Advance received for next order'
    });

    expect(tx3.runningBalance).toBe('-500.0000');

    details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('-500.0000');
    expect(details?.statusText).toBe('PAYABLE');
  });

  it('reverses a transaction non-destructively, updates balance, and rejects double reversals', async () => {
    const account = await khataService.createAccount(testUserId, {
      displayName: 'Delta Corp',
      accountType: 'SUPPLIER'
    });

    const tx = await khataService.postTransaction(testUserId, {
      accountId: account.id,
      type: 'MONEY_IN',
      amount: '2000.0000',
      transactionDate: new Date(),
      description: 'Test transaction'
    });

    let details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('2000.0000');

    // Reverse transaction non-destructively
    const reversedTx = await khataService.reverseTransaction(tx.id, testUserId, 'Order cancelled by client');
    expect(reversedTx.status).toBe('REVERSED');
    expect(reversedTx.reversedAt).toBeDefined();

    // Verify transaction remains present in ledger query for auditability
    const ledger = await khataService.getAccountLedger({ accountId: account.id, userId: testUserId });
    expect(ledger.transactions.length).toBe(1);
    expect(ledger.transactions[0].status).toBe('REVERSED');

    // Balance recalculation excludes reversed transaction
    details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('0.0000');

    // Second reversal attempt must be rejected (idempotency check)
    await expect(
      khataService.reverseTransaction(tx.id, testUserId)
    ).rejects.toThrow('KHATA_TRANSACTION_ALREADY_REVERSED');
  });

  it('enforces archived account rules: viewable but rejects new transaction posting', async () => {
    const account = await khataService.createAccount(testUserId, {
      displayName: 'Archived Client',
      accountType: 'CUSTOMER'
    });

    // Post valid transaction while active
    await khataService.postTransaction(testUserId, {
      accountId: account.id,
      type: 'MONEY_IN',
      amount: '1000.0000',
      transactionDate: new Date(),
      description: 'Pre-archive bill'
    });

    // Archive account
    const archivedAcc = await khataService.archiveAccount(account.id, testUserId);
    expect(archivedAcc?.status).toBe('ARCHIVED');
    expect(archivedAcc?.archivedAt).toBeDefined();

    // Verify account and transaction history remain queryable
    const details = await khataService.getAccount(account.id, testUserId);
    expect(details?.netBalance).toBe('1000.0000');

    const ledger = await khataService.getAccountLedger({ accountId: account.id, userId: testUserId });
    expect(ledger.transactions.length).toBe(1);

    // Attempting to post new transaction to archived account MUST be rejected
    await expect(
      khataService.postTransaction(testUserId, {
        accountId: account.id,
        type: 'MONEY_IN',
        amount: '500.0000',
        transactionDate: new Date(),
        description: 'Post-archive attempt'
      })
    ).rejects.toThrow('KHATA_ACCOUNT_ARCHIVED');
  });

  it('enforces multi-user ownership security boundaries server-side', async () => {
    const userA = testUserId;
    const userB = userBId;

    // User A creates Account A
    const accountA = await khataService.createAccount(userA, {
      displayName: 'User A Private Ledger',
      accountType: 'CUSTOMER'
    });

    const txA = await khataService.postTransaction(userA, {
      accountId: accountA.id,
      type: 'MONEY_IN',
      amount: '3000.0000',
      transactionDate: new Date(),
      description: 'Private funds'
    });

    // User B MUST NOT be able to read Account A
    const userBRead = await khataService.getAccount(accountA.id, userB);
    expect(userBRead).toBeNull();

    // User B MUST NOT be able to update Account A
    const userBUpdate = await khataService.updateAccount(accountA.id, userB, { displayName: 'Hacked Name' });
    expect(userBUpdate).toBeNull();

    // User B MUST NOT be able to archive Account A
    const userBArchive = await khataService.archiveAccount(accountA.id, userB);
    expect(userBArchive).toBeNull();

    // User B MUST NOT be able to post transaction to Account A
    await expect(
      khataService.postTransaction(userB, {
        accountId: accountA.id,
        type: 'MONEY_IN',
        amount: '100.0000',
        transactionDate: new Date(),
        description: 'Unauthorized post'
      })
    ).rejects.toThrow('KHATA_ACCOUNT_NOT_FOUND');

    // User B MUST NOT be able to read Account A transactions
    await expect(
      khataService.getAccountLedger({ accountId: accountA.id, userId: userB })
    ).rejects.toThrow('KHATA_ACCOUNT_NOT_FOUND');

    // User B MUST NOT be able to reverse User A transaction
    await expect(
      khataService.reverseTransaction(txA.id, userB)
    ).rejects.toThrow('KHATA_TRANSACTION_NOT_FOUND');
  });

  it('rejects invalid transaction amounts (<= 0)', async () => {
    const account = await khataService.createAccount(testUserId, {
      displayName: 'Err Account'
    });

    await expect(
      khataService.postTransaction(testUserId, {
        accountId: account.id,
        type: 'MONEY_IN',
        amount: '0.0000',
        transactionDate: new Date(),
        description: 'Zero amount'
      })
    ).rejects.toThrow('INVALID_TRANSACTION_AMOUNT');
  });

  // --- HTTP API Security & Development Identity Boundary Tests ---

  it('rejects HTTP request with 401 Unauthorized when x-user-id header is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/khata/accounts'
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBeDefined();
  });

  it('rejects HTTP request with 401 Unauthorized when x-user-id is malformed', async () => {
    const invalidIds = ['abc', '123', 'hello', '', 'not-a-uuid'];
    for (const invalidId of invalidIds) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/khata/accounts',
        headers: { 'x-user-id': invalidId }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('allows HTTP access when valid UUID x-user-id header is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/khata/accounts',
      headers: { 'x-user-id': testUserId }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('enforces User B isolation over User A resource via HTTP API (returns 404)', async () => {
    // Create account for User A via HTTP API
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/khata/accounts',
      headers: { 'x-user-id': testUserId },
      payload: {
        displayName: 'User A API Confidential Account',
        accountType: 'CUSTOMER'
      }
    });
    expect(createRes.statusCode).toBe(201);
    const createdAccount = JSON.parse(createRes.body).data;

    // User B attempts to access User A's account via HTTP API
    const accessRes = await app.inject({
      method: 'GET',
      url: `/api/v1/khata/accounts/${createdAccount.id}`,
      headers: { 'x-user-id': userBId }
    });
    expect(accessRes.statusCode).toBe(404);
  });

  it('explicitly verifies missing x-user-id does NOT fall back to default user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/khata/accounts'
    });
    expect(res.statusCode).toBe(401);
  });
});


