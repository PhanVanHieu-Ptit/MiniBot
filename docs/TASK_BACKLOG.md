# TASK_BACKLOG.md

> Prioritized list of known issues and improvements. Update when tasks are started or completed.
> Source of truth: `docs/KNOWN_ISSUES.md` (legacy). This file owns priority ordering.

## Priority Legend

| Level | Meaning |
|---|---|
| P0 | Blocks correctness / causes data loss |
| P1 | Performance / testability / layering violation |
| P2 | Code quality / mild risk |
| P3 | Nice-to-have |

## Backlog

| # | Priority | Area | Task | File(s) |
|---|---|---|---|---|
| 1 | P1 | DB | Add index on `messages.user_id` (full scan every chat turn) | `src/infrastructure/db/schema.ts`, new migration |
| 2 | P1 | Architecture | Remove `UserRow`/`MessageRow` imports from core interfaces | `src/core/interfaces/IUserRepository.ts`, `IMessageRepository.ts` |
| 3 | P1 | Architecture | Container should expose interfaces, not concrete classes | `src/container/index.ts` |
| 4 | P2 | Testability | Extract `rateLimiter` singleton into injectable class | `src/utils/rateLimit.ts`, `src/features/chat/handler.ts` |
| 5 | P2 | Memory | Rate limiter map grows unbounded; add eviction for stale windows | `src/utils/rateLimit.ts` |
| 6 | P2 | Code | Deduplicate DB setup between `client.ts` and `migrate.ts` | `src/infrastructure/db/client.ts`, `migrate.ts` |
| 7 | P2 | Reliability | Log streaming errors before sending user-facing reply | `src/features/chat/handler.ts` |
| 8 | P2 | UX | Markdown `parse_mode` fragile with unbalanced tokens; add sanitization or fallback | `src/features/chat/handler.ts` |
| 9 | P3 | DB | `getOrCreateUser` always does SELECT + INSERT even for known users | `src/features/chat/service.ts` |
| 10 | P3 | UX | `/reset` gives no feedback when user has no history | `src/features/commands/reset.ts` |
| 11 | P3 | Testing | No tests exist — add unit + integration coverage | new `src/**/*.test.ts` files |
| 12 | P3 | CI/CD | No CI pipeline — add GitHub Actions for typecheck + lint | new `.github/workflows/` |

## Completed

_(none yet)_
