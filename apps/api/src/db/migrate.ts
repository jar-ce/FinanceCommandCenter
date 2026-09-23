import { getDb, closeDb } from './index.js';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  const migrationsFolder = path.join(__dirname, 'migrations');
  console.log(`Running database migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
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
