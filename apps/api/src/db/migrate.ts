import { getDb, closeDb } from './index.js';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  const migrationsFolder = path.join(__dirname, 'migrations');
  console.log(`Running database migrations from ${migrationsFolder}...`);
  if (env.NODE_ENV === 'production') {
    await migrateNodePg(db, { migrationsFolder });
  } else {
    await migratePglite(db, { migrationsFolder });
  }
  console.log('✅ Database migrations completed successfully.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => closeDb())
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
