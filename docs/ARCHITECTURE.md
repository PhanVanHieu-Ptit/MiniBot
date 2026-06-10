# ARCHITECTURE.md

## Layer Map

```
src/
├── index.ts                     # Entrypoint: wires container, starts bot
├── config/index.ts              # Zod-parsed env; process.exit on invalid
├── types/index.ts               # Shared domain types (ChatMessage, User, MessageRole)
│
├── core/interfaces/             # Pure abstractions — no imports from infra
│   ├── IAIProvider.ts
│   ├── ILogger.ts
│   ├── IMessageRepository.ts
│   └── IUserRepository.ts
│
├── infrastructure/              # Concrete implementations
│   ├── ai/GeminiProvider.ts     # Vertex AI adapter, implements IAIProvider
│   ├── db/
│   │   ├── client.ts            # Opens DB, runs migrations on startup
│   │   ├── migrate.ts           # Standalone migration script (duplicates client.ts setup)
│   │   ├── schema.ts            # Drizzle table definitions + inferred types
│   │   ├── migrations/          # SQL migration files managed by drizzle-kit
│   │   └── repositories/
│   │       ├── UserRepository.ts
│   │       └── MessageRepository.ts
│   ├── logger/PinoLogger.ts     # Implements ILogger
│   └── retry/withRetry.ts       # Generic exponential-backoff retry utility
│
├── features/
│   ├── chat/
│   │   ├── types.ts             # ChatContext (input DTO)
│   │   ├── service.ts           # ChatService — orchestrates user, history, AI
│   │   └── handler.ts           # grammy handler — streaming, throttle, message split
│   └── commands/
│       ├── start.ts, help.ts, reset.ts
│
├── bot/
│   ├── index.ts                 # Assembles grammy Bot, registers middleware + routes
│   └── middlewares/
│       ├── auth.ts              # Allowlist enforcement
│       ├── logger.ts            # Per-request timing log
│       └── errorHandler.ts      # bot.catch handler
│
├── container/index.ts           # Manual DI: constructs and wires all services
└── utils/
    ├── message.ts               # splitMessage — splits >4096 char responses
    └── rateLimit.ts             # In-memory sliding-window rate limiter
```

## Dependency Direction

```
bot → features → core/interfaces ← infrastructure
         ↓
      container (wires everything)
         ↓
       config (read by all layers via Pick<Config, ...>)
```

Core interfaces have zero upward dependencies. Infrastructure implements them. Features consume interfaces only (except `ChatService` which is not behind an interface — see KNOWN_ISSUES).

## DI Pattern

Manual container in `container/index.ts`. No DI framework. Each service receives dependencies as constructor arguments. Logger is scoped per-service via `logger.child({ service: '...' })`.

Config injection uses `Pick<Config, 'KEY1' | 'KEY2'>` — services declare only the config keys they need.

## Streaming Architecture

```
GeminiProvider.chatStream()   →  AsyncGenerator<string chunk>
  ↓ consumed by
ChatService.chatStream()      →  AsyncGenerator<string chunk>  (also saves to DB when done)
  ↓ consumed by
handler.ts                    →  throttled editMessageText every STREAM_THROTTLE_MS
                                 final edit with full response + parse_mode: Markdown
```

The stream is end-to-end lazy. DB write happens after the full stream completes (not per-chunk).

## Retry Strategy

`withRetry` in `infrastructure/retry/withRetry.ts` — 3 attempts, exponential backoff with full jitter (0..min(8000, base * 2^attempt)). Retryable conditions:
- Network errors: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`
- SQLite: `SQLITE_BUSY`
- HTTP: `429`, `5xx`
- Not retried: `400`, `401`, `403`, `404`

## Database Schema

```sql
users (id PK, telegram_id UNIQUE, username, first_name, created_at TEXT)
messages (id PK, user_id FK→users.id CASCADE, role ENUM('user','model'), content, created_at TEXT)
```

`createdAt` is stored as `TEXT` via SQLite `datetime('now')`. Ordering relies on lexicographic sort of the ISO-format string.
