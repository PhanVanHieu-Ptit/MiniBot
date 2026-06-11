/**
 * One-time data migration: SQLite → PostgreSQL.
 *
 * Usage:
 *   SQLITE_URL=./data/minibot.db \
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/minibot \
 *   tsx scripts/migrate-sqlite-to-postgres.ts
 *
 * Safe to re-run: inserts use ON CONFLICT DO NOTHING.
 * The SQLite file is opened read-only and is never modified.
 * After migration, PostgreSQL sequences are reset to MAX(id) of each table.
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import postgres from 'postgres';

const SQLITE_URL = process.env['SQLITE_URL'] ?? './data/minibot.db';
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

interface SqliteUser {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  created_at: string;
}

interface SqliteMessage {
  id: number;
  user_id: number;
  role: string;
  content: string;
  created_at: string;
}

function parseCreatedAt(raw: string): Date {
  // SQLite stores datetime('now') as "YYYY-MM-DD HH:MM:SS" in UTC
  return new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
}

async function main() {
  console.log(`Source SQLite: ${SQLITE_URL}`);
  console.log(`Target PostgreSQL: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);

  // Open SQLite read-only
  const sqlite = new Database(SQLITE_URL, { readonly: true });

  // Connect to PostgreSQL
  const sql = postgres(DATABASE_URL);

  try {
    const sqliteUsers = sqlite.prepare('SELECT * FROM users ORDER BY id').all() as SqliteUser[];
    const sqliteMessages = sqlite
      .prepare('SELECT * FROM messages ORDER BY id')
      .all() as SqliteMessage[];

    console.log(`\nSQLite rows: ${sqliteUsers.length} users, ${sqliteMessages.length} messages`);

    // Migrate users
    let usersInserted = 0;
    if (sqliteUsers.length > 0) {
      const rows = sqliteUsers.map((u) => ({
        id: u.id,
        telegram_id: u.telegram_id,
        username: u.username,
        first_name: u.first_name,
        created_at: parseCreatedAt(u.created_at),
      }));

      const result = await sql`
        INSERT INTO users (id, telegram_id, username, first_name, created_at)
        SELECT id, telegram_id, username, first_name, created_at
        FROM ${sql(rows)}
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      usersInserted = result.length;

      // Reset sequence to avoid PK collisions on future inserts
      await sql`
        SELECT setval(
          pg_get_serial_sequence('users', 'id'),
          COALESCE((SELECT MAX(id) FROM users), 0)
        )
      `;
    }

    // Migrate messages
    let messagesInserted = 0;
    if (sqliteMessages.length > 0) {
      const rows = sqliteMessages.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        content: m.content,
        created_at: parseCreatedAt(m.created_at),
      }));

      const result = await sql`
        INSERT INTO messages (id, user_id, role, content, created_at)
        SELECT id, user_id, role, content, created_at
        FROM ${sql(rows)}
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      messagesInserted = result.length;

      await sql`
        SELECT setval(
          pg_get_serial_sequence('messages', 'id'),
          COALESCE((SELECT MAX(id) FROM messages), 0)
        )
      `;
    }

    // Verify counts in PostgreSQL
    const [{ count: pgUsers }] = await sql<[{ count: string }]>`SELECT COUNT(*) FROM users`;
    const [{ count: pgMessages }] =
      await sql<[{ count: string }]>`SELECT COUNT(*) FROM messages`;

    console.log(`\nMigration complete:`);
    console.log(
      `  Users   : ${usersInserted} inserted (${sqliteUsers.length} in source, ${pgUsers} in PG)`,
    );
    console.log(
      `  Messages: ${messagesInserted} inserted (${sqliteMessages.length} in source, ${pgMessages} in PG)`,
    );

    if (
      parseInt(pgUsers) < sqliteUsers.length ||
      parseInt(pgMessages) < sqliteMessages.length
    ) {
      console.warn('\nWARN: PG row counts are lower than SQLite — some rows may have been skipped');
      console.warn('      (This is expected on re-runs due to ON CONFLICT DO NOTHING)');
    }
  } finally {
    sqlite.close();
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
