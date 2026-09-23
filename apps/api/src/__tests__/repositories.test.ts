import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DrizzleUserRepository } from '../infrastructure/repositories/DrizzleUserRepository.js';
import { DrizzleAuditLogRepository } from '../infrastructure/repositories/DrizzleAuditLogRepository.js';
import { closeDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';

describe('Drizzle Clean Architecture Repositories', () => {
  const userRepo = new DrizzleUserRepository();
  const auditRepo = new DrizzleAuditLogRepository();

  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates and finds a user by ID and email', async () => {
    const newUser = await userRepo.create({
      email: 'repo-test@example.com',
      name: 'Repo User'
    });

    expect(newUser.id).toBeDefined();
    // Validate empirical UUID v4 format: 8-4-4-4-12 hex chars with '4' at version position
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(newUser.id).toMatch(uuidV4Regex);
    expect(newUser.email).toBe('repo-test@example.com');

    const foundById = await userRepo.findById(newUser.id);
    expect(foundById?.name).toBe('Repo User');
    expect(foundById?.id).toMatch(uuidV4Regex);

    const foundByEmail = await userRepo.findByEmail('repo-test@example.com');
    expect(foundByEmail?.id).toBe(newUser.id);
  });

  it('creates and lists audit logs associated with a user with verified UUID v4 FKs', async () => {
    const user = await userRepo.create({
      email: 'audit-test@example.com',
      name: 'Audit User'
    });

    const audit = await auditRepo.create({
      userId: user.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      details: { role: 'ADMIN' },
      ipAddress: '127.0.0.1'
    });

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(audit.id).toBeDefined();
    expect(audit.id).toMatch(uuidV4Regex);
    expect(audit.userId).toBe(user.id);

    const logs = await auditRepo.listByUserId(user.id);
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('USER_CREATED');
  });
});
