# KNOWN_ISSUES.md

Severity: **[CRITICAL]** data loss risk / **[HIGH]** functional bug / **[MEDIUM]** reliability / **[LOW]** maintainability / **[RISK]** scalability or performance

---

## [HIGH] Missing index on `messages.user_id`

**File:** `src/infrastructure/db/migrations/0000_fixed_talos.sql`

`MessageRepository.findByUserId` runs `WHERE user_id = ?` with no index. SQLite will full-scan the `messages` table for every chat turn. For a user with thousands of messages this degrades linearly.

**Fix:** Add to the next migration:
```sql
CREATE INDEX idx_messages_user_id ON messages (user_id);
```

---

## [HIGH] Core interfaces leak infrastructure types

**Files:** `src/core/interfaces/IUserRepository.ts`, `src/core/interfaces/IMessageRepository.ts`

Both interfaces import `UserRow`, `NewUserRow`, `MessageRow`, `NewMessageRow` directly from `src/infrastructure/db/schema.ts`. This inverts the dependency: core depends on infra. If the schema changes column names or the DB is swapped, the interfaces must change too.

**Fix:** Define domain types (`User`, `NewUser`, `Message`, `NewMessage`) in `src/types/index.ts` and have the interfaces use those. Repositories map between DB rows and domain types internally.

---

## [HIGH] `Container` interface exposes concrete classes

**File:** `src/container/index.ts`

```ts
export interface Container {
  userRepo: UserRepository;      // should be IUserRepository
  messageRepo: MessageRepository; // should be IMessageRepository
  aiProvider: GeminiProvider;    // should be IAIProvider
  chatService: ChatService;      // should be IChatService (doesn't exist yet)
}
```

Any code that depends on `Container` gets coupled to concrete implementations, defeating the interface layer.

**Fix:** Type the container fields against their interfaces. Create `IChatService` if `ChatService` needs to be swappable.

---

## [MEDIUM] `rateLimiter` is an untestable module singleton

**File:** `src/utils/rateLimit.ts`

```ts
export const rateLimiter = new RateLimiter(10, 60_000); // hardcoded params
```

The singleton is imported and called directly in `handler.ts`. Parameters are not configurable. Tests cannot reset state between runs.

**Fix:** Export the `RateLimiter` class only. Instantiate it in `container/index.ts` with params from `config`. Inject it into the handler.

---

## [MEDIUM] Rate limiter state grows unbounded

**File:** `src/utils/rateLimit.ts`

`state: Map<number, RateLimitState>` entries are never evicted. For a long-running bot with many unique users the map grows forever. Each entry is ~40 bytes — negligible for hundreds of users but measurable for tens of thousands.

**Fix:** Add a periodic cleanup or use a TTL-aware structure. Entries where `now - windowStart > windowMs` are safe to delete.

---

## [MEDIUM] `migrate.ts` duplicates DB setup logic from `client.ts`

**File:** `src/infrastructure/db/migrate.ts`

Both files independently open the DB, set `journal_mode = WAL`, set `foreign_keys = ON`, and create the `data/` directory. If pragmas change, both must be updated.

**Fix:** Extract a shared `openSqlite(path)` function that both files use.

---

## [MEDIUM] Streaming errors are silently dropped

**File:** `src/features/chat/handler.ts`

```ts
} catch {
  await ctx.api.editMessageText(...).catch(() => ctx.reply(...));
}
```

Errors thrown during stream processing are caught and converted to a user-facing message with no logging. Diagnosing production failures requires guessing.

**Fix:** Log the error with context (`userId`, `updateId`, `error.message`, `stack`) before replying to the user.

---

## [MEDIUM] `parse_mode: 'Markdown'` is fragile

**File:** `src/features/chat/handler.ts` (lines 63, 65)

Telegram's Markdown v1 fails silently when AI-generated content contains unbalanced tokens (`*`, `_`, `` ` ``). The `editMessageText` call will throw, caught by the outer `catch {}`.

**Fix:** Switch to `parse_mode: 'HTML'` and sanitize output, or use `MarkdownV2` with proper escaping. Alternatively, send without `parse_mode` and accept plaintext.

---

## [LOW] `getOrCreateUser` makes two DB calls for existing users

**File:** `src/features/chat/service.ts`

```ts
const existing = await this.deps.userRepo.findByTelegramId(ctx.telegramId);
if (existing) return existing;
return this.deps.userRepo.upsert(...);
```

Existing users (the common path) pay for a `SELECT` followed by nothing, instead of a single `INSERT OR REPLACE`. The `upsert` method already uses `onConflictDoUpdate` — `findByTelegramId` is redundant.

**Fix:** Remove `getOrCreateUser` and call `upsert` directly. It returns the row in both insert and update cases.

---

## [LOW] `/reset` gives no feedback when user has no history

**File:** `src/features/commands/reset.ts`

If the user was never registered or has no messages, the reply is still "Conversation history cleared." which is misleading.

---

## [RISK] SQLite is a single-writer bottleneck

If the bot is ever deployed with multiple workers (e.g., separate webhook handlers), SQLite's single-writer model will cause `SQLITE_BUSY` errors under concurrent writes. `withRetry` handles transient `SQLITE_BUSY` but sustained concurrent writes will fail.

**Note:** This is a design constraint, not a bug. Acceptable for a single-process personal bot.

---

## [RISK] History is loaded in full on every message

**File:** `src/features/chat/service.ts`

`findByUserId(user.id, MAX_HISTORY_MESSAGES)` runs on every chat turn. At `MAX_HISTORY_MESSAGES=20` this is negligible, but if the limit is raised significantly the per-message overhead grows. There is no caching or session state.

---

## [RISK] No deduplication of Telegram updates

If Telegram delivers the same update twice (retry on timeout), `insertMany` will insert duplicate messages. The `messages` table has no unique constraint on `(user_id, content, created_at)`.

---

## [UNCERTAIN] `GEMINI_MODEL` default value

**File:** `src/config/index.ts`

Default is `gemini-3.0-flash`. As of the knowledge cutoff, the Vertex AI model catalog does not include this name. The likely intended value is `gemini-2.0-flash` or `gemini-1.5-flash`. **Verify against your GCP project's available models.**
