# API_CONTRACTS.md

> Interface contracts between layers. These are the seams where implementations can be swapped.
> Update when any interface signature changes.

## Core Interfaces (`src/core/interfaces/`)

### `IAIProvider`

```typescript
interface IAIProvider {
  chat(history: ChatMessage[], userMessage: string): Promise<string>;
  chatStream(history: ChatMessage[], userMessage: string): AsyncGenerator<string>;
}
```

| Method | Input | Output | Side Effects |
|---|---|---|---|
| `chat` | history array + user message | full response string | Vertex AI API call |
| `chatStream` | history array + user message | async chunks generator | Vertex AI streaming call |

Implementation: `src/infrastructure/ai/GeminiProvider.ts`

---

### `ILogger`

```typescript
interface ILogger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  fatal(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ILogger;
}
```

Implementation: `src/infrastructure/logger/PinoLogger.ts`

---

### `IUserRepository`

```typescript
interface IUserRepository {
  findByTelegramId(telegramId: number): Promise<UserRow | null>;
  upsert(user: NewUserRow): Promise<UserRow>;
}
```

⚠️ **[KNOWN ISSUE]** Returns `UserRow` / accepts `NewUserRow` — these are Drizzle infra types leaking into the core layer. Should use domain types from `src/types/index.ts`.

Implementation: `src/infrastructure/db/repositories/UserRepository.ts`

---

### `IMessageRepository`

```typescript
interface IMessageRepository {
  findByUserId(userId: number, limit: number): Promise<MessageRow[]>;
  insertMany(rows: NewMessageRow[]): Promise<void>;
  deleteByUserId(userId: number): Promise<void>;
}
```

⚠️ **[KNOWN ISSUE]** Same infra type leakage as `IUserRepository`.

Implementation: `src/infrastructure/db/repositories/MessageRepository.ts`

---

## Domain Types (`src/types/index.ts`)

```typescript
type MessageRole = 'user' | 'model';

interface ChatMessage {
  role: MessageRole;
  content: string;
}

interface User {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  createdAt: Date;
}
```

---

## Feature DTOs

### `ChatContext` (`src/features/chat/types.ts`)

```typescript
interface ChatContext {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  userMessage: string;
}
```

Input to `ChatService` from bot handlers.

---

## `ChatService` Public API (`src/features/chat/service.ts`)

Not behind an interface **[KNOWN ISSUE — untestable]**.

```typescript
class ChatService {
  constructor(
    userRepo: IUserRepository,
    messageRepo: IMessageRepository,
    aiProvider: IAIProvider,
    config: Pick<Config, 'maxHistoryMessages'>,
    logger: ILogger
  )

  chat(ctx: ChatContext): Promise<string>
  chatStream(ctx: ChatContext): AsyncGenerator<string>
}
```

---

## Utility Contracts

### `withRetry` (`src/infrastructure/retry/withRetry.ts`)

```typescript
function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number }  // default 3
): Promise<T>
```

### `splitMessage` (`src/utils/message.ts`)

```typescript
function splitMessage(text: string, maxLength?: number): string[]
// maxLength defaults to 4096 (Telegram limit)
```

### `RateLimiter` (`src/utils/rateLimit.ts`)

```typescript
class RateLimiter {
  constructor(maxRequests: number, windowMs: number)
  isAllowed(userId: number): boolean
}
// Exported singleton: rateLimiter (10 req / 60_000 ms)
```
