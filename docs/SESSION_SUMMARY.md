# SESSION_SUMMARY.md

> **Update this file** at the start of each new coding session to reflect current project state.

## Project Identity

| Field | Value |
|---|---|
| Name | MiniBot |
| Type | Telegram AI chatbot (single-process, personal use) |
| Stack | TypeScript ESM · grammy · Vertex AI (Gemini) · Drizzle ORM / SQLite · Pino |
| Entry | `src/index.ts` → `container/index.ts` → `bot/index.ts` |
| Run | `npm run dev` (tsx watch) · `npm start` (compiled) · `npm run docker:up` |

## Current State (as of 2026-06-10)

| Area | Status |
|---|---|
| Core chat (streaming) | Working |
| Commands (/start /help /reset) | Working |
| Auth middleware (allowlist) | Working |
| Rate limiter | Working (in-memory, resets on restart) |
| Database migrations | 1 migration applied (0000_fixed_talos) |
| Docker support | Dockerfile + docker-compose.yml present |
| Tests | **None** |
| CI/CD | **None** |

## Recent Git History

| Commit | Message |
|---|---|
| `0f58ebe` | feat: init |
| `b74a82b` | Initial commit |

## Open Issues (critical first)

See [TASK_BACKLOG.md](TASK_BACKLOG.md) for full list. Top 3 blockers:

1. **[HIGH]** `messages.user_id` has no index → full table scan every chat turn
2. **[HIGH]** Core interfaces import infra types (`UserRow`, `MessageRow`) — breaks layering
3. **[HIGH]** Container exposes concrete classes, not interfaces — untestable

## Environment Assumptions

- Google Cloud ADC configured (`gcloud auth application-default login`)
- `GOOGLE_CLOUD_PROJECT` set to a project with Vertex AI API enabled
- SQLite file path defaults to `./data/minibot.db` (auto-created)
- `GEMINI_MODEL=gemini-3.0-flash` — **[INFERRED]** model name may not exist; verify against Vertex AI model list
