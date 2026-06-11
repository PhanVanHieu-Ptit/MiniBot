import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import type { Config } from '../../config/index.js';
import * as schema from './schema.js';

export type DB = PostgresJsDatabase<typeof schema>;

export async function createDbClient(
  config: Pick<Config, 'DATABASE_URL'>,
): Promise<{ db: DB; close: () => Promise<void> }> {
  const sql = postgres(config.DATABASE_URL, { max: 10 });
  const db = drizzle(sql, { schema });

  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');
  await migrate(db, { migrationsFolder });

  return { db, close: () => sql.end() };
}
