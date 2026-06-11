# SQLite → PostgreSQL Migration Guide

This document covers all changes made, step-by-step migration instructions, rollback procedure, and deployment verification for the MiniBot database migration.

---

## Summary of Changes

### Dependencies (`package.json`)
| Change | Detail |
|--------|--------|
| Removed from `dependencies` | `better-sqlite3` |
| Moved to `devDependencies` | `better-sqlite3`, `@types/better-sqlite3` (still needed for the data migration script) |
| Added to `dependencies` | `postgres` ^3.4.5 (postgres.js — Drizzle's preferred PG driver) |
| New npm script | `db:migrate:data` — runs the one-time SQLite→PG data migration |

### Schema (`src/infrastructure/db/schema.ts`)
| Column | Before (SQLite) | After (PostgreSQL) |
|--------|----------------|-------------------|
| `users.id` | `integer` autoIncrement | `serial` (int4 sequence) |
| `users.telegram_id` | `integer` | `bigint` mode `'number'` — Telegram IDs can exceed 32-bit |
| `users.created_at` | `text` DEFAULT `datetime('now')` | `timestamptz` DEFAULT `now()` |
| `messages.id` | `integer` autoIncrement | `serial` |
| `messages.role` | `text` enum helper | `text.$type<'user'\|'model'>` (no PG ENUM type) |
| `messages.created_at` | `text` | `timestamptz` |
| Import source | `drizzle-orm/sqlite-core` | `drizzle-orm/pg-core` |

**TypeScript impact**: `UserRow.createdAt` and `MessageRow.createdAt` are now `Date` instead of `string`. Code that serialises these to strings must call `.toISOString()`.

### Database Client (`src/infrastructure/db/client.ts`)
- Replaced `better-sqlite3` + `drizzle-orm/better-sqlite3` with `postgres` + `drizzle-orm/postgres-js`.
- `createDbClient` is now **async** (PG migrator is async).
- Returns `{ db, close }` — call `close()` on shutdown to drain the connection pool.
- WAL-mode pragma and foreign-keys pragma removed (PostgreSQL handles these natively).

### Migration Runner (`src/infrastructure/db/migrate.ts`)
- Rewritten for `drizzle-orm/postgres-js/migrator`.

### Retry Logic (`src/infrastructure/retry/withRetry.ts`)
- Removed `SQLITE_BUSY` from retryable error codes.
- Added PostgreSQL transient codes: `57P03` (cannot_connect_now), `08006` (connection_failure), `40001` (serialization_failure), `40P01` (deadlock_detected).

### Container & Entry Point
- `buildContainer` in `src/container/index.ts` is now `async`; `Container` interface gains `close(): Promise<void>`.
- `src/index.ts` awaits `buildContainer` and calls `container.close()` during graceful shutdown.

### Config (`src/config/index.ts`)
- `DATABASE_URL` no longer has a default — it is required and must be a PostgreSQL connection string.

### Drizzle Config (`drizzle.config.ts`)
- `dialect: 'sqlite'` → `dialect: 'postgresql'`.
- Fallback URL changed to `postgresql://localhost:5432/minibot`.

### Migrations Folder
- Old SQLite migrations preserved at `src/infrastructure/db/migrations/sqlite/` (not deleted).
- New PostgreSQL initial migration at `src/infrastructure/db/migrations/0000_lame_sunset_bain.sql`.

### Docker (`Dockerfile`, `docker-compose.yml`)
- **Dockerfile**: Removed SQLite data directory (`/app/data`). Added step to copy migration SQL files into `dist/infrastructure/db/migrations/` so the runtime auto-migrator can find them.
- **docker-compose.yml**:
  - Added `postgres` service (image `postgres:16-alpine`) with health check and persistent volume `postgres_data`.
  - `minibot` service now `depends_on: postgres: condition: service_healthy`.
  - `DATABASE_URL` constructed automatically from `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
  - Removed `minibot_data` SQLite volume.

### Environment (`.env.example`)
```
POSTGRES_USER=minibot
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=minibot
DATABASE_URL=postgresql://minibot:change_me_in_production@localhost:5432/minibot
```

---

## Prerequisites

- Node.js 22+
- Docker + Docker Compose v2 (for Docker deployment)
- A running PostgreSQL 14+ instance (for local dev without Docker)

---

## Migration Procedure

### Step 0 — Back up your SQLite data

```bash
cp ./data/minibot.db ./data/minibot.db.backup-$(date +%Y%m%d-%H%M%S)
```

The SQLite file is never modified by any step below, but keeping an explicit backup is good practice.

### Step 1 — Pull the new code and install dependencies

```bash
git pull
npm install
```

### Step 2 — Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Set at minimum:
```
TELEGRAM_BOT_TOKEN=...
GOOGLE_CLOUD_PROJECT=...
POSTGRES_PASSWORD=<a strong random password>
DATABASE_URL=postgresql://minibot:<password>@localhost:5432/minibot
```

For Docker deployments, `DATABASE_URL` is constructed automatically from `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — you do **not** need to set it manually in `.env` when using Docker Compose.

### Step 3 — Start PostgreSQL (Docker)

```bash
docker compose up postgres -d
# Wait for healthy status
docker compose ps postgres
```

Or, for local dev without Docker, start your own PostgreSQL instance and create the database:
```bash
createdb -U minibot minibot   # adjust as needed
```

### Step 4 — Apply PostgreSQL schema migrations

```bash
npm run db:migrate
```

This creates the `users` and `messages` tables in PostgreSQL.

### Step 5 — Migrate existing data from SQLite

```bash
SQLITE_URL=./data/minibot.db DATABASE_URL=postgresql://minibot:<password>@localhost:5432/minibot \
  npm run db:migrate:data
```

Expected output:
```
Source SQLite: ./data/minibot.db
Target PostgreSQL: postgresql://minibot:***@localhost:5432/minibot

SQLite rows: N users, M messages

Migration complete:
  Users   : N inserted (N in source, N in PG)
  Messages: M inserted (M in source, M in PG)
```

The script is idempotent — re-running it is safe (duplicate rows are skipped via `ON CONFLICT DO NOTHING`).

### Step 6 — Start the application

**Docker:**
```bash
docker compose up -d
docker compose logs -f minibot
```

**Local:**
```bash
npm start
```

Look for:
```
{"level":"info","msg":"Bot ready","username":"your_bot"}
```

---

## Rollback Procedure

If you need to revert to SQLite:

1. **Stop the application.**
2. **Restore the original code:**
   ```bash
   git revert HEAD   # or git checkout <previous-tag>
   npm install
   ```
3. **Restore `.env`:**
   - Remove the `POSTGRES_*` variables.
   - Set `DATABASE_URL=./data/minibot.db` (or remove it to use the default).
4. **Restore the SQLite file if needed:**
   ```bash
   cp ./data/minibot.db.backup-<timestamp> ./data/minibot.db
   ```
5. **Restart the application.**

---

## Deployment Verification Checklist

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean compile
- [ ] `docker compose up postgres -d && docker compose ps postgres` — postgres service healthy
- [ ] `npm run db:migrate` (or auto-migrate on startup) — no errors
- [ ] Bot starts and logs `Bot ready`
- [ ] Send `/start` to the bot — user is created in PostgreSQL:
  ```sql
  SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
  ```
- [ ] Send a message — conversation is stored in PostgreSQL:
  ```sql
  SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
  ```
- [ ] Restart the bot and confirm conversation history persists
- [ ] `docker compose down && docker compose up -d` — data survives container restart (postgres_data volume)

---

## Notes

- **Telegram ID size**: `telegram_id` is now stored as PostgreSQL `BIGINT` (64-bit) to safely accommodate all Telegram user IDs. The JavaScript type remains `number` (via Drizzle's `{ mode: 'number' }`).
- **Timestamps**: `created_at` columns changed from `TEXT` to `TIMESTAMPTZ`. Values are now `Date` objects in TypeScript. The data migration script converts SQLite's `"YYYY-MM-DD HH:MM:SS"` UTC strings to proper timestamps automatically.
- **Connection pool**: postgres.js defaults to one connection per CPU core; the client is capped at 10 with `{ max: 10 }`.
- **Auto-migrate on startup**: The app still runs `drizzle-kit` migrations automatically at boot, so manual `db:migrate` is only needed if you want to migrate before first start (e.g., in CI or when data-migrating).
