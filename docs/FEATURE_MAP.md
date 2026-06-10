# FEATURE_MAP.md

> Maps user-visible features to the code that implements them.
> Update when adding or removing commands/handlers.

## Bot Commands

| Command | Handler File | Description | DB Operations |
|---|---|---|---|
| `/start` | `src/features/commands/start.ts` | Greeting + command list. Upserts user on first call | `users.upsert` |
| `/help` | `src/features/commands/help.ts` | Static help text (no DB) | None |
| `/reset` | `src/features/commands/reset.ts` | Deletes all conversation history for the user | `users.findByTelegramId` + `messages.deleteByUserId` |
| _(any text)_ | `src/features/chat/handler.ts` | Streams AI response | `messages.findByUserId` + `messages.insertMany` |

## Request Lifecycle (text message)

```
Telegram update
  ↓
grammy Bot.on('message:text')
  ↓
[middleware] logger.ts    → logs userId, updateId, text preview
  ↓
[middleware] auth.ts      → blocks if userId not in ALLOWED_USER_IDS
  ↓
chat/handler.ts
  ├── rateLimiter.isAllowed(userId)  → 429-like reply if exceeded
  ├── ctx.reply("...")               → send placeholder
  ├── chatService.chatStream(ctx)    → AsyncGenerator<chunk>
  ├── [loop] accumulate + throttled editMessageText every STREAM_THROTTLE_MS
  └── final edit with full text (Markdown) or sendMessage for overflow chunks
```

## Rate Limits

| Limit | Value | Scope | Reset |
|---|---|---|---|
| Messages per window | 10 | Per user | 60-second rolling window |
| Message edit frequency | 1 per `STREAM_THROTTLE_MS` | Per request | End of request |
| Telegram message max length | 4096 chars | Per message | Overflow handled by `splitMessage` |

## AI Context Window per Request

```
[system prompt: "You are a helpful, concise AI assistant."]
+ [last MAX_HISTORY_MESSAGES messages from DB]
+ [current user message]
```

All loaded synchronously before the stream starts.

## Command Registration Order (`src/bot/index.ts`)

```
bot.catch(errorHandler)
bot.use(loggerMiddleware)
bot.use(authMiddleware)
bot.command('start', startHandler)
bot.command('help', helpHandler)
bot.command('reset', resetHandler)
bot.on('message:text', chatHandler)
```

## Feature Gaps (not yet implemented)

| Feature | Notes |
|---|---|
| `/settings` command | No user-configurable settings |
| Multi-model selection | Hardcoded to `GEMINI_MODEL` env |
| Image/file input | Text-only; no multimodal |
| Inline mode | Not configured |
| Group chat | Untested; auth allowlist may behave unexpectedly |
| Message threading | No reply-chain awareness |
