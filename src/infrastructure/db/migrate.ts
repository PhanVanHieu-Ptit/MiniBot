import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../../config/index.js';

const sql = postgres(config.DATABASE_URL);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './src/infrastructure/db/migrations' });
console.error('Migrations applied successfully.');
await sql.end();
