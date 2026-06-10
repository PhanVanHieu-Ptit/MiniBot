import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Config } from '../../config/index.js';
import * as schema from './schema.js';

export function createDbClient(config: Pick<Config, 'DATABASE_URL'>) {
  const dbPath = config.DATABASE_URL;
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');
  migrate(db, { migrationsFolder });

  return db;
}

export type DB = ReturnType<typeof createDbClient>;
