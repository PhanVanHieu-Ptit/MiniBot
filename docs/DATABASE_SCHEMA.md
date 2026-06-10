# DATABASE_SCHEMA.md

> Source of truth for DB structure. Update whenever a new migration is generated.

## Engine

| Field | Value |
|---|---|
| Engine | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Mode | WAL (Write-Ahead Logging) |
| FK enforcement | ON (`PRAGMA foreign_keys = ON`) |
| File path | `DATABASE_URL` env var (default `./data/minibot.db`) |
| Migrations dir | `src/infrastructure/db/migrations/` |
| Schema file | `src/infrastructure/db/schema.ts` |

## Tables

### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | Internal row ID |
| `telegram_id` | INTEGER | UNIQUE, NOT NULL | Telegram user ID |
| `username` | TEXT | nullable | Telegram `@username` |
| `first_name` | TEXT | nullable | Telegram display name |
| `created_at` | TEXT | default `datetime('now')` | ISO-format string; lexicographic sort |

**Indices:** `telegram_id` (UNIQUE index from migration)

### `messages`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | Internal row ID |
| `user_id` | INTEGER | FK → `users.id` CASCADE DELETE | Owner reference |
| `role` | TEXT | NOT NULL, enum `'user'\|'model'` | Speaker role |
| `content` | TEXT | NOT NULL | Message body |
| `created_at` | TEXT | default `datetime('now')` | ISO-format string |

**Indices:** ⚠️ **None on `user_id`** — causes full table scan on every `findByUserId` call (see [TASK_BACKLOG.md](TASK_BACKLOG.md) #1)

## Relationships

```
users (1) ──── (*) messages
              ON DELETE CASCADE
```

## Migration History

| Version | File | Description |
|---|---|---|
| 0000 | `0000_fixed_talos.sql` | Initial schema — creates `users` and `messages` tables |

## ORM Types (Drizzle inferred)

| Export | Description |
|---|---|
| `UserRow` | Full select type for `users` |
| `NewUserRow` | Insert type for `users` (id/created_at optional) |
| `MessageRow` | Full select type for `messages` |
| `NewMessageRow` | Insert type for `messages` |

## Adding a Migration

```bash
# 1. Edit src/infrastructure/db/schema.ts
# 2. Generate SQL
npm run db:generate
# 3. Apply to DB
npm run db:migrate
```

> Migrations run automatically on app startup via `src/infrastructure/db/client.ts`.

## Known Issues

- `created_at` stored as TEXT; date arithmetic requires `strftime()` or app-side parsing
- No index on `messages.user_id` — add in next migration
- `migrate.ts` duplicates DB open logic from `client.ts` **[INFERRED: safe to extract shared helper]**
