# COMPONENT_REGISTRY.md

> One-line description of every non-trivial file. Use this to locate the right file quickly.
> Update when adding, moving, or removing source files.

## Entry & Wiring

| File | Purpose |
|---|---|
| `src/index.ts` | Process entry. Loads config, builds container, starts bot. Graceful shutdown on SIGINT/SIGTERM with 5 s force-exit fallback |
| `src/config/index.ts` | Zod-validated env config. Exits process on invalid env |
| `src/container/index.ts` | Manual DI. Constructs all services and wires dependencies |

## Core Abstractions (`src/core/interfaces/`)

| File | Interface | Purpose |
|---|---|---|
| `ILogger.ts` | `ILogger` | Logging contract (debug/info/warn/error/fatal/child) |
| `IAIProvider.ts` | `IAIProvider` | AI chat + streaming contract |
| `IUserRepository.ts` | `IUserRepository` | User CRUD contract |
| `IMessageRepository.ts` | `IMessageRepository` | Message CRUD contract |

**Rule:** Zero imports from `infrastructure/` or `features/` in this folder.

## Infrastructure (`src/infrastructure/`)

| File | Implements | Purpose |
|---|---|---|
| `logger/PinoLogger.ts` | `ILogger` | Pino-based structured logger; pino-pretty in dev |
| `ai/GeminiProvider.ts` | `IAIProvider` | Vertex AI adapter; maps domain types to Gemini SDK types |
| `retry/withRetry.ts` | — | Generic exponential-backoff retry (3 attempts, max 8 s) |
| `db/schema.ts` | — | Drizzle ORM table definitions + inferred insert/select types |
| `db/client.ts` | — | Opens SQLite, sets WAL + FK pragma, runs migrations, returns drizzle db |
| `db/migrate.ts` | — | Standalone CLI migration runner (duplicates client.ts setup) |
| `db/repositories/UserRepository.ts` | `IUserRepository` | `findByTelegramId` + `upsert` with retry |
| `db/repositories/MessageRepository.ts` | `IMessageRepository` | `findByUserId` / `insertMany` / `deleteByUserId` with retry |

## Features (`src/features/`)

| File | Purpose |
|---|---|
| `chat/types.ts` | `ChatContext` DTO — input to ChatService |
| `chat/service.ts` | `ChatService` — orchestrates user upsert, history load, AI call, history save |
| `chat/handler.ts` | grammy handler factory — rate check, emoji reaction, typing indicator, streaming, throttled edits, Markdown fallback, message split, error logging |
| `commands/start.ts` | `/start` handler — upserts user, sends greeting |
| `commands/help.ts` | `/help` handler — static help message |
| `commands/reset.ts` | `/reset` handler — deletes user's message history |

## Bot Assembly (`src/bot/`)

| File | Purpose |
|---|---|
| `bot/index.ts` | Assembles grammy `Bot`, registers middlewares and routes |
| `middlewares/auth.ts` | Blocks non-allowlisted users (if `ALLOWED_USER_IDS` is set) |
| `middlewares/logger.ts` | Per-request timing log (userId, updateId, text preview, durationMs) |
| `middlewares/errorHandler.ts` | `bot.catch` — logs error, attempts user-facing reply |

## Utilities (`src/utils/`)

| File | Export | Purpose |
|---|---|---|
| `message.ts` | `splitMessage(text, maxLength?)` | Splits >4096-char strings at newline/space/hard boundary |
| `rateLimit.ts` | `RateLimiter` class + `rateLimiter` singleton | In-memory sliding-window rate limiter |

## Shared Types (`src/types/index.ts`)

Exports: `MessageRole`, `ChatMessage`, `User`

## Configuration Keys

| Key | Default | Used by |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | `bot/index.ts` |
| `GOOGLE_CLOUD_PROJECT` | — | `GeminiProvider` |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | `GeminiProvider` |
| `DATABASE_URL` | `./data/minibot.db` | `db/client.ts` |
| `ALLOWED_USER_IDS` | `[]` | `middlewares/auth.ts` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | `GeminiProvider` |
| `MAX_HISTORY_MESSAGES` | `20` | `ChatService` |
| `STREAM_THROTTLE_MS` | `800` | `chat/handler.ts` |
| `NODE_ENV` | `development` | `PinoLogger` |
| `LOG_LEVEL` | `info` | `PinoLogger` |
