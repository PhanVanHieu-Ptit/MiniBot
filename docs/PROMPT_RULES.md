# PROMPT_RULES.md

Rules for AI assistants working in this codebase.

---

## Code Style

- All imports use `.js` extension, even for `.ts` source files. Never omit it.
- ESM only. No `require()`, no `__dirname` (use `import.meta.url` + `fileURLToPath`).
- `strict: true` + `noUncheckedIndexedAccess`. All array index accesses must be null-checked (e.g. `rows[0]` must not be assumed defined — use `rows[0] ?? fallback` or check first).
- Factory functions for handlers: `createXxxHandler(deps)` returns a grammy handler function.
- Constructor injection only. No globals, no module-level singletons (except `rateLimiter` — which is a known issue).
- Config slicing: accept `Pick<Config, 'NEEDED_KEY'>` not the full `Config` object.
- Logger: always use `logger.child({ service: 'MyService' })` at construction time.

---

## Architecture Rules

- New features go under `src/features/<feature-name>/`. Each feature has `handler.ts`, `service.ts`, `types.ts` as needed.
- New infrastructure adapters go under `src/infrastructure/<category>/`. Implement the relevant `core/interfaces/I*.ts` interface.
- Do not import from `infrastructure/` inside `core/interfaces/`. Core interfaces must have zero infra dependencies.
- Do not import from `features/` inside `infrastructure/`.
- New services must be wired in `container/index.ts` and added to the `Container` interface.
- Do not add framework-level DI (decorators, tokens). The manual container is intentional.

---

## Database Rules

- Schema changes require: (1) edit `src/infrastructure/db/schema.ts`, (2) run `npm run db:generate` to produce a migration SQL, (3) commit the generated SQL.
- Never write raw SQL strings. Use Drizzle query builder.
- Always add an index for any column used in a `WHERE` clause in a new query.
- Timestamps: store as `INTEGER` (Unix epoch ms) for new columns, not `TEXT`. Existing `created_at` columns are `TEXT` — do not change them without a migration.

---

## AI Provider Rules

- AI logic belongs in `GeminiProvider` only. `ChatService` must not import from `@google-cloud/vertexai`.
- If you add a new AI provider, implement `IAIProvider` and swap it in `container/index.ts`.
- `SYSTEM_INSTRUCTION` is defined in `GeminiProvider.ts`. Modify there; do not override per-chat.

---

## Error Handling Rules

- Never swallow errors silently in service or infrastructure code. Log with context, then rethrow or convert.
- `catch {}` is only acceptable in the grammy handler's "ignore edit failure" path (race condition guard) and `errorHandler.ts`'s reply fallback.
- Use `withRetry` for all outbound I/O (DB, AI, Telegram API calls if needed). Do not write ad-hoc retry loops.

---

## Testing Rules (if tests are added)

- Do not mock the database. Use an in-memory SQLite instance (`new Database(':memory:')`).
- `rateLimiter` is a module singleton — inject a fresh `new RateLimiter(...)` for tests by refactoring the handler to accept it as a dependency.
- Use the `ILogger` interface for a no-op logger stub in tests.

---

## Things to Avoid

- Do not add `any` casts. Use `unknown` and narrow.
- Do not use `!` non-null assertions. Prefer early returns or proper narrowing.
- Do not use Telegram `Markdown` parse mode for new features — prefer `MarkdownV2` or `HTML`. (Existing handler uses `Markdown`; see KNOWN_ISSUES.)
- Do not hardcode Telegram user IDs or chat IDs in source code. Use `ALLOWED_USER_IDS` env var.
- Do not commit `.env` files. Use `.env.example` as the template.
