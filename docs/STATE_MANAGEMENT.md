# STATE_MANAGEMENT.md

> Describes all mutable state in the system, where it lives, and its lifetime.

## State Inventory

| State | Storage | Lifetime | Owner |
|---|---|---|---|
| Conversation history | SQLite `messages` table | Persistent (until `/reset`) | `MessageRepository` |
| User record | SQLite `users` table | Persistent | `UserRepository` |
| Rate limiter counters | In-memory `Map<userId, {count, windowStart}>` | Process lifetime (resets on restart) | `rateLimit.ts` singleton |
| Streaming accumulator | Stack-local `string` in handler | Single request | `chat/handler.ts` |
| Throttle timer | Stack-local `NodeJS.Timeout` in handler | Single request | `chat/handler.ts` |

## Conversation History Flow

```
User sends message
  → handler extracts ChatContext
  → ChatService.chatStream(ctx)
      → userRepo.upsert(user)          [write: ensure user exists]
      → messageRepo.findByUserId(...)  [read: load last N messages]
      → aiProvider.chatStream(...)     [read: call Gemini]
      → yield chunks to handler
  → stream ends
      → messageRepo.insertMany([userMsg, modelMsg])  [write: persist both turns]
```

History is **loaded fresh from DB per message** — no cache. Changes to `MAX_HISTORY_MESSAGES` take effect on next message with no migration needed.

## Rate Limiter State

```
Map<userId: number, { count: number, windowStart: number }>
```

- Window: 60 seconds (rolling)
- Limit: 10 requests per window
- State is **not persisted** — restarts reset all counters
- **[KNOWN ISSUE]** Map entries are never evicted for inactive users → memory leak over time
- Single exported singleton at module level → cannot be injected or reset in tests

## No Session / No grammy Session

grammy's session plugin is **not used**. All state is stored in SQLite or local variables. There is no in-memory per-user session object.

## Concurrency Notes

- SQLite `better-sqlite3` is synchronous — all DB ops are blocking
- WAL mode allows concurrent reads; single writer
- No mutex/lock beyond SQLite's built-in guarantees
- Multiple in-flight streaming responses for different users are fine (independent)
- Simultaneous messages from the same user: rate limiter throttles at 10/60s; SQLite `SQLITE_BUSY` triggers retry

## Config State

Config is read once at startup via `src/config/index.ts` (Zod parse of `process.env`). It is **immutable** at runtime. Hot-reload is not supported — restart required to pick up env changes.
