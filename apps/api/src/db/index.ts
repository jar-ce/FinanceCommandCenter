import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';

let pgliteClient: PGlite | null = null;
let pgPoolClient: pg.Pool | null = null;
let dbInstance: any = null;

export async function getDb(): Promise<any> {
  if (!dbInstance) {
    if (env.NODE_ENV === 'production') {
      pgPoolClient = new pg.Pool({
        connectionString: env.DATABASE_URL,
        max: env.DATABASE_POOL_SIZE,
        ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false
      });
      dbInstance = drizzleNodePg(pgPoolClient, { schema });
    } else {
      // Local PGlite instance running real PostgreSQL C code compiled to WebAssembly
      pgliteClient = new PGlite();
      dbInstance = drizzlePglite(pgliteClient, { schema });
    }
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = null;
  }
  if (pgPoolClient) {
    await pgPoolClient.end();
    pgPoolClient = null;
  }
  dbInstance = null;
}

/**
 * Execute work within an atomic database transaction
 */
export async function withTransaction<T>(
  work: (tx: any) => Promise<T>
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx: any) => {
    return await work(tx);
  });
}

