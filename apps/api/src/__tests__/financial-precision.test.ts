import { describe, it, expect } from 'vitest';
import { FinancialAmount } from '../domain/value-objects/FinancialAmount.js';

describe('FinancialPrecision & Arithmetic Engine', () => {
  it('prevents floating-point rounding errors (0.1 + 0.2 = 0.3000)', () => {
    const a = new FinancialAmount('0.1');
    const b = new FinancialAmount('0.2');
    const sum = a.add(b);

    expect(sum.toDatabaseString()).toBe('0.3000');
    expect(sum.toDisplayString()).toBe('0.30');
  });

  it('correctly formats NUMERIC(18, 4) database strings', () => {
    const val = new FinancialAmount('123456.78901');
    expect(val.toDatabaseString()).toBe('123456.7890');
    expect(val.toDisplayString()).toBe('123456.79');
  });

  it('performs exact multiplication and division without precision loss', () => {
    const qty = new FinancialAmount('150.5000');
    const price = new FinancialAmount('425.2500');
    const total = qty.multiply(price.toDecimal());

    expect(total.toDatabaseString()).toBe('64000.1250');
    expect(total.toDisplayString()).toBe('64000.13');
  });

  it('empirically verifies PostgreSQL NUMERIC(18, 4) storage precision and scale behavior', async () => {
    const { getDb, closeDb } = await import('../db/index.js');
    const { sql } = await import('drizzle-orm');
    const db = await getDb();

    // Query PostgreSQL NUMERIC casting directly to test DB behavior
    const result = await db.execute<{
      v1: string;
      v2: string;
      v3: string;
      v_exceed: string;
    }>(sql`
      SELECT 
        CAST('123.4567' AS NUMERIC(18, 4)) as v1,
        CAST('0.0001' AS NUMERIC(18, 4)) as v2,
        CAST('999999999999.9999' AS NUMERIC(18, 4)) as v3,
        CAST('123.456789' AS NUMERIC(18, 4)) as v_exceed
    `);

    const row = result.rows[0];
    expect(row.v1).toBe('123.4567');
    expect(row.v2).toBe('0.0001');
    expect(row.v3).toBe('999999999999.9999');
    // Scale 4 rounding by PostgreSQL engine when 6 decimals provided
    expect(row.v_exceed).toBe('123.4568');

    await closeDb();
  }, 30000);
});
