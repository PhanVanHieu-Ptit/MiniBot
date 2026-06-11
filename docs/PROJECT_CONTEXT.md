# PROJECT_CONTEXT.md

## What This Is

MiniBot is a single-process Telegram bot that provides a conversational AI interface backed by Google Gemini (via Vertex AI). It is designed as a personal or small-team bot, not a public-scale service. The bot stores per-user conversation history in SQLite and streams AI responses back to Telegram in real time.

---

## Runtime Characteristics

### Core Runtime

| Property | Value |
|---|---|
| Language | TypeScript 5.7, strict++ (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`) |
| Module system | ESM (`"type": "module"`, `.js` import extensions everywhere) |
| Node target | 22 (Alpine in Docker) |
| Transport | Telegram long-polling via grammy v1 |
| AI provider | Google Vertex AI — `@google-cloud/vertexai` v1 (requires ADC, not API key) |
| Database | SQLite (better-sqlite3 + Drizzle ORM v0.45), WAL mode, FK enforcement |
| Logging | Pino v10 (structured JSON in prod, pino-pretty in dev) |
| Config validation | Zod v3 at startup; process exits on invalid env |

### Dev Tooling

| Tool | Purpose |
|---|---|
| `tsx` | TypeScript execution for development (`npm run dev` uses `tsx watch`) |
| `drizzle-kit` | Schema migration generation (`npm run db:generate`) |
| `ESLint` + `typescript-eslint` | Lint (enforces TS-aware rules, Prettier compat) |
| `Prettier` | Code formatting |
| `tsc --noEmit` | Type-checking without emit (`npm run typecheck`) |

---

## Entry Flow

```
src/index.ts
  → config/index.ts              # Zod parse process.env; exit on failure
  → buildContainer(config)       # manual DI: constructs all services
  → createBot(container)         # grammy Bot + middleware + routes
  → bot.start()                  # long-poll loop (blocks until SIGINT/SIGTERM)
```

Graceful shutdown: `SIGINT`/`SIGTERM` call `bot.stop()`.

---

## Architecture Overview

### Layer Map

```
src/
├── config/              # Zod-parsed env — consumed by all layers via Pick<Config, ...>
├── types/               # Shared domain types: ChatMessage, MessageRole
├── core/interfaces/     # Pure contracts — zero imports from infra or features
│   ├── IAIProvider      # chat() + chatStream()
│   ├── ILogger          # debug/info/warn/error/fatal/child()
│   ├── IUserRepository  # findByTelegramId() + upsert()
│   └── IMessageRepository # findByUserId() + insertMany() + deleteByUserId()
├── infrastructure/      # Concrete implementations of core interfaces
│   ├── ai/              # GeminiProvider → IAIProvider
│   ├── db/              # schema, client, migrations, repositories
│   ├── logger/          # PinoLogger → ILogger
│   └── retry/           # withRetry utility (used by repos + AI provider)
├── features/            # Domain logic
│   ├── chat/            # ChatService (orchestration) + handler (grammy glue)
│   └── commands/        # /start, /help, /reset handlers
├── bot/                 # grammy assembly
│   ├── index.ts         # registers middleware + routes
│   └── middlewares/     # auth, logger, errorHandler
├── container/           # Manual DI: wires all services
└── utils/               # splitMessage, RateLimiter
```

### Dependency Direction

```
bot → features → core/interfaces ← infrastructure
                       ↑
                   container (wires everything)
                       ↑
                    config (read by all via Pick<>)
```

Core interfaces have zero upward dependencies. Infrastructure implements them. Features consume interfaces only.

### DI Pattern

Manual container in `container/index.ts` — no DI framework. Each service receives dependencies as constructor arguments. Config injection uses `Pick<Config, 'NEEDED_KEYS'>` so services declare only the keys they need. Logger scoped per-service via `logger.child({ service: '...' })`.

### Known Architectural Violations (Active)

These are documented in `KNOWN_ISSUES.md` and tracked in `TASK_BACKLOG.md`:

| Violation | Impact |
|---|---|
| `IUserRepository` / `IMessageRepository` import ORM row types from `infrastructure/db/schema.ts` | Core layer depends on infrastructure — inverts the dependency arrow |
| `Container` interface exposes concrete classes (`UserRepository`, `GeminiProvider`, `ChatService`) instead of interfaces | All container consumers coupled to implementations |
| `ChatService` has no `IChatService` interface | Untestable; cannot be swapped |

---

## Streaming Architecture

The AI response is streamed end-to-end with no buffering until completion:

```
GeminiProvider.chatStream()        AsyncGenerator<string chunk>
  consumed by
ChatService.chatStream()           AsyncGenerator<string chunk>
  (persists to DB after full stream completes, not per-chunk)
  consumed by
chat/handler.ts
  accumulates chunks → throttled editMessageText every STREAM_THROTTLE_MS
  final edit applies full response (parse_mode: Markdown)
  if response > 4096 chars → deleteMessage + splitMessage() + multiple sends
```

Key invariant: **DB write happens after the stream is fully consumed**, not incrementally. If the stream fails mid-way, no history is saved.

---

## Retry Strategy

All outbound I/O (DB, AI provider) is wrapped with `infrastructure/retry/withRetry.ts`:

| Property | Value |
|---|---|
| Max attempts | 3 |
| Backoff | Exponential with full jitter: `random(0, min(8000ms, 1000ms × 2^attempt))` |
| Retryable | `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `SQLITE_BUSY`, HTTP 429, HTTP 5xx |
| Not retried | HTTP 400, 401, 403, 404 |

---

## Feature Surface

| Feature | Handler File | DB Operations |
|---|---|---|
| `/start` | `features/commands/start.ts` | `users.upsert` |
| `/help` | `features/commands/help.ts` | None |
| `/reset` | `features/commands/reset.ts` | `users.findByTelegramId` + `messages.deleteByUserId` |
| Text chat | `features/chat/handler.ts` + `service.ts` | `users.upsert` + `messages.findByUserId` + `messages.insertMany` |

Request lifecycle per text message:
```
Telegram update
  → [MW] loggerMiddleware     logs userId, updateId, text preview, durationMs
  → [MW] authMiddleware       blocks if userId not in ALLOWED_USER_IDS
  → chatHandler
      → rateLimiter.isAllowed()
      → ChatService.chatStream()
      → throttled editMessageText loop
      → final edit / split send
```

---

## Auth Model

Optional allowlist via `ALLOWED_USER_IDS` env var (comma-separated Telegram user IDs). Empty = open to all users. Enforced globally by `bot/middlewares/auth.ts` before any feature handler runs.

**Security note:** An unconfigured bot (empty allowlist) allows any Telegram user to trigger Vertex AI calls. Set `ALLOWED_USER_IDS` in production to control costs.

---

## Data Model

```sql
users    (id PK, telegram_id UNIQUE, username, first_name, created_at TEXT)
messages (id PK, user_id FK→users.id CASCADE, role ENUM('user','model'), content, created_at TEXT)
```

- `created_at` stored as `TEXT` (`datetime('now')` ISO format). Ordering relies on lexicographic sort.
- New timestamp columns should use `INTEGER` (Unix epoch ms) — see `PROMPT_RULES.md`.
- **Known gap:** No index on `messages.user_id` — every `findByUserId` is a full table scan. Migration pending.

---

## State Inventory

| State | Storage | Lifetime |
|---|---|---|
| Conversation history | SQLite `messages` | Persistent until `/reset` |
| User record | SQLite `users` | Persistent |
| Rate limiter counters | In-memory `Map<userId, {count, windowStart}>` | Process lifetime (resets on restart) |
| Streaming accumulator | Stack-local `string` in handler | Single request |

No grammy session plugin. No in-memory per-user session cache. History is loaded fresh from DB on every message.

---

## Development Workflows

### Local Development

```bash
cp .env.example .env          # fill in TELEGRAM_BOT_TOKEN and GOOGLE_CLOUD_PROJECT
gcloud auth application-default login
npm install
npm run db:migrate            # apply migrations to ./data/minibot.db
npm run dev                   # tsx watch — hot-reloads on file change
```

### Schema Change Workflow

```bash
# 1. Edit src/infrastructure/db/schema.ts
# 2. Generate migration SQL:
npm run db:generate
# 3. Review generated SQL in src/infrastructure/db/migrations/
# 4. Apply to local DB:
npm run db:migrate
# 5. Commit both schema.ts and the generated SQL file
```

### Quality Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src
npm run format:check  # prettier --check src
```

### Docker

```bash
npm run docker:build   # docker build -t minibot
npm run docker:up      # docker compose up -d
npm run docker:logs    # docker compose logs -f
npm run docker:down    # docker compose down
```

---

## Deployment

Docker multi-stage build (`node:22-alpine`). Dev dependencies excluded from production image. SQLite database persisted to a named Docker volume (`minibot_data:/app/data`).

**Hard constraints:**
- Single-instance only — SQLite single-writer model prevents horizontal scaling.
- Long-poll transport only — no webhook mode; cannot deploy to serverless/edge.
- `better-sqlite3` is synchronous — all DB operations block the Node.js event loop.

---

## Credentials Required

| Credential | Source | Used By |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather | grammy `Bot` constructor |
| `GOOGLE_CLOUD_PROJECT` | GCP console | `GeminiProvider` (Vertex AI) |
| Google ADC | `gcloud auth application-default login` or mounted SA key | `@google-cloud/vertexai` SDK |

---

## Current Status (as of 2026-06-10)

| Area | Status |
|---|---|
| Core chat (streaming) | Working |
| Commands (/start /help /reset) | Working |
| Auth middleware (allowlist) | Working |
| Rate limiter | Working — in-memory, resets on restart, **map grows unbounded** |
| Database migrations | 1 migration applied (`0000_fixed_talos`) |
| Docker support | Working |
| Tests | **None** |
| CI/CD | **None** |
| Architectural violations | **3 active** — see KNOWN_ISSUES.md |

---

## Project Goals

### Immediate (P0 — correctness and testability)

1. Add migration for `messages.user_id` index — eliminates full table scan on every chat turn.
2. Fix core interface type leakage — define domain types (`User`, `Message`) in `src/types/index.ts`; remove ORM row type imports from `core/interfaces/`.
3. Create `IChatService` interface — update `Container` to expose interfaces, not concrete classes.
4. Log streaming errors before user-facing generic reply — currently undiagnosable in production.
5. Fix fragile `parse_mode: 'Markdown'` — migrate to HTML with sanitization or drop formatting.
6. Create `CLAUDE.md` at project root — AI coding agents currently miss `docs/PROMPT_RULES.md`.

### Near-term (P1 — reliability and developer experience)

7. Inject `RateLimiter` via container — eliminate untestable module singleton.
8. Add TTL eviction to `RateLimiter` — prevent unbounded memory growth.
9. Extract shared `openSqlite()` function — eliminate duplicate DB setup in `client.ts` and `migrate.ts`.
10. Add Vitest unit tests for `withRetry`, `splitMessage`, `RateLimiter`, `ChatService`.
11. Add GitHub Actions CI — typecheck + lint + test on every push.
12. Inject user name and current date into the AI system prompt per request.

---

## Future Roadmap

| Capability | Notes |
|---|---|
| Per-user settings | `/settings` command; configurable language, response style, history depth |
| Conversation summarization | Rolling summary when history exceeds `MAX_HISTORY_MESSAGES`; prevents abrupt quality cliff |
| AI tool calling | Extend `IAIProvider` with `tools?: ToolDefinition[]`; enables structured data extraction, API integrations |
| Multimodal input | Images, PDFs via Gemini multimodal API; `grammy` supports media message types |
| Health endpoint | Lightweight HTTP `/health` for container liveness probes |
| Webhook mode | Lower latency; required for serverless deployment; `grammy` supports webhooks natively |
| Metrics / observability | Structured counters for message count, AI latency, error rates; foundation for alerting |
| Message deduplication | Unique constraint or idempotency key on `messages` to handle Telegram update retransmission |
| Admin commands | Operator-level commands for inspecting state, force-resetting users, or adjusting runtime config |
