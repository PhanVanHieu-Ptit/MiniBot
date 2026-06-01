import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Config } from '../../config/index.js';
import * as schema from './schema.js';

export function createDbClient(config: Pick<Config, 'DATABASE_URL'>) {
  const dbPath = config.DATABASE_URL;
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

export type DB = ReturnType<typeof createDbClient>;
