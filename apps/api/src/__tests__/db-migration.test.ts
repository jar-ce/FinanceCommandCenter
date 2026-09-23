import { describe, it, expect, afterAll } from 'vitest';
import { getDb, closeDb, withTransaction } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { users } from '../db/schema/users.js';
import { eq } from 'drizzle-orm';

describe('Database Migration & Transaction Engine', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('runs migrations successfully against PostgreSQL development engine', async () => {
    await expect(runMigrations()).resolves.not.toThrow();
  });

  it('executes database operations inside atomic transaction boundaries and supports rollback', async () => {
    const db = await getDb();
    
    try {
      await withTransaction(async (tx: any) => {
        await tx.insert(users).values({
          email: 'rollback-test@example.com',
          name: 'Rollback User'
        });
        // Force intentional error inside transaction to verify rollback
        throw new Error('INTENTIONAL_ROLLBACK');
      });
    } catch (err: any) {
      expect(err.message).toBe('INTENTIONAL_ROLLBACK');
    }

    // Verify user was NOT inserted due to transaction rollback
    const user = await db.select().from(users).where(eq(users.email, 'rollback-test@example.com')).limit(1);
    expect(user.length).toBe(0);
  });
});
