# PROJECT_CONTEXT.md

## What This Is

MiniBot is a single-process Telegram bot that provides a conversational AI interface backed by Google Gemini (via Vertex AI). It is designed as a personal or small-team bot, not a public-scale service.

## Runtime Characteristics

| Property | Value |
|---|---|
| Language | TypeScript 5.7, strict++ (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Module system | ESM (`"type": "module"`, `.js` imports everywhere) |
| Node target | 22 (Alpine in Docker) |
| Transport | Telegram long-polling via grammy v1 |
| AI provider | Google Vertex AI — `@google-cloud/vertexai` (requires ADC, not API key) |
| Database | SQLite (better-sqlite3 + Drizzle ORM), WAL mode, FK enforcement |
| Logging | Pino (structured JSON in prod, pino-pretty in dev) |
| Config validation | Zod at startup; process exits on invalid env |

## Entry Flow

```
src/index.ts
  → buildContainer(config)      # manual DI wiring
  → createBot(container)        # grammy Bot + middleware stack
  → bot.start()                 # long-poll loop
```

## Feature Surface

| Feature | File(s) |
|---|---|
| `/start` | `features/commands/start.ts` — upserts user, sends greeting |
| `/help` | `features/commands/help.ts` — static reply |
| `/reset` | `features/commands/reset.ts` — deletes all messages for user |
| Text chat | `features/chat/handler.ts` + `service.ts` — streaming AI reply |

## Auth Model

Optional allowlist via `ALLOWED_USER_IDS` env var (comma-separated Telegram user IDs). Empty = open to everyone. Enforced globally by `bot/middlewares/auth.ts`.

## Deployment

Docker (multi-stage build, node:22-alpine). SQLite database persisted to a named Docker volume (`minibot_data:/app/data`). Single-instance only — no horizontal scaling path.

## Credentials Required

- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `GOOGLE_CLOUD_PROJECT` — GCP project with Vertex AI enabled
- Google ADC — `gcloud auth application-default login` or mounted service account key
