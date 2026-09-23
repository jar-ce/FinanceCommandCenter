import { PGlite } from '@electric-sql/pglite';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema/index.js';

let client: PGlite | null = null;
let dbInstance: PgliteDatabase<typeof schema> | null = null;

export async function getDb(): Promise<PgliteDatabase<typeof schema>> {
  if (!dbInstance) {
    // Local PGlite instance running real PostgreSQL C code compiled to WebAssembly
    client = new PGlite();
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
  }
}

/**
 * Execute work within an atomic database transaction
 */
export async function withTransaction<T>(
  work: (tx: Parameters<Parameters<PgliteDatabase<typeof schema>['transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    return await work(tx);
  });
}
