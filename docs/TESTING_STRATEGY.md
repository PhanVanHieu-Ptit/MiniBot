# TESTING_STRATEGY.md

> Testing plan for MiniBot. No tests exist yet — this defines the target strategy.

## Current Status

| Area | Coverage |
|---|---|
| Unit tests | ❌ None |
| Integration tests | ❌ None |
| E2E tests | ❌ None |
| Typecheck | ✅ `npm run typecheck` |
| Lint | ✅ `npm run lint` |

## Recommended Test Setup

**Framework:** Vitest (ESM-native, fast, compatible with TypeScript strict)

```bash
yarn add -D vitest @vitest/coverage-v8
```

Add to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

## Test Priority (by ROI)

| Priority | Target | Type | Rationale |
|---|---|---|---|
| P1 | `withRetry` | Unit | Core reliability primitive; pure function |
| P1 | `splitMessage` | Unit | Pure function; edge cases matter (4096-char boundary) |
| P1 | `RateLimiter` | Unit | Blocked by singleton issue — fix injection first |
| P1 | `ChatService` | Unit | Orchestration logic; mock interfaces |
| P2 | `UserRepository` | Integration | Test against real in-memory SQLite |
| P2 | `MessageRepository` | Integration | Test findByUserId ordering, deleteByUserId cascade |
| P2 | Auth middleware | Unit | Allowlist logic |
| P3 | `GeminiProvider` | Integration | Requires real GCP creds — skip in CI |
| P3 | Chat handler | Unit | grammy context mocking is verbose |

## Unit Test Pattern

Dependencies are injected → use mock implementations of interfaces:

```typescript
// Example: ChatService unit test
const mockAI: IAIProvider = {
  chat: vi.fn().mockResolvedValue('Hello'),
  chatStream: vi.fn(),
};
const mockUserRepo: IUserRepository = { ... };
const mockMsgRepo: IMessageRepository = { ... };

const service = new ChatService(mockUserRepo, mockMsgRepo, mockAI, config, logger);
```

⚠️ `rateLimiter` is a module singleton — cannot mock without refactoring `handler.ts` to accept it as a parameter (see [TASK_BACKLOG.md](TASK_BACKLOG.md) #4).

## Integration Test Pattern

Use an in-memory SQLite database:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite);
// run migrations programmatically
```

## What NOT to Test

- Telegram API behavior (grammy handles it)
- Vertex AI response format (Gemini SDK handles it)
- Drizzle ORM SQL generation (library responsibility)
- Config parsing (Zod handles it; process.exit makes it hard to test anyway)

## CI Recommendation

```yaml
# .github/workflows/ci.yml
- run: npm run typecheck
- run: npm run lint
- run: npm test
```

No real GCP calls in CI — stub `GeminiProvider` or skip AI tests with `vi.mock`.
