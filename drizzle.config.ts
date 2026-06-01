import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? './data/minibot.db',
  },
});
