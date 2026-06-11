# AI_BEHAVIOR.md

> Describes how the AI provider is configured and behaves. Update when prompt, model, or safety settings change.

## Provider

| Field | Value |
|---|---|
| SDK | `@google-cloud/vertexai` |
| Auth | Application Default Credentials (ADC) — no API key |
| Model | `GEMINI_MODEL` env var (default `gemini-2.5-flash`) |
| Location | `GOOGLE_CLOUD_LOCATION` env var (default `us-central1`) |
| File | `src/infrastructure/ai/GeminiProvider.ts` |

## System Prompt

Configured as `systemInstruction` on the Vertex AI `GenerativeModel`. Not user-configurable at runtime.

The bot has a Vietnamese persona: xưng "em", gọi người dùng là "sếp". Rules enforced:

- **Opening emoji**: Every response MUST start with a single emoji on its own line matching the message context, followed by a blank line, then the content.
- **Tone**: Lịch sự, gần gũi, nhẹ hài hước — natural Vietnamese particles (`ạ`, `nhé`, `nha`, `ơi`).
- **Language**: Vietnamese by default; mirrors the user's language if they write in another language.
- **No filler phrases**: Emoji replaces openers like "Tất nhiên!", "Câu hỏi hay đấy!"
- **Format**: Short, on-point. Use bullet/numbered lists for technical/long answers.

Emoji selection guide baked into the prompt:

| Context | Emoji options |
|---|---|
| Question / clarification | 🤔 ❓ 💭 |
| Request / command | ✅ 👍 🛠️ |
| Praise / encouragement | 😊 🙏 ❤️ |
| Agreement | 👌 ✔️ |
| Greeting | 👋 😄 |
| Info / news | 📌 💡 |
| Error / apology | 😔 🙏 |
| Humor | 😄 🤣 |

## Safety Settings

All four categories set to `BLOCK_MEDIUM_AND_ABOVE`:

| Category | Threshold |
|---|---|
| HARM_CATEGORY_HARASSMENT | BLOCK_MEDIUM_AND_ABOVE |
| HARM_CATEGORY_HATE_SPEECH | BLOCK_MEDIUM_AND_ABOVE |
| HARM_CATEGORY_SEXUALLY_EXPLICIT | BLOCK_MEDIUM_AND_ABOVE |
| HARM_CATEGORY_DANGEROUS_CONTENT | BLOCK_MEDIUM_AND_ABOVE |

## Conversation History

- Loaded from DB on **every message** (no in-memory cache)
- Capped at `MAX_HISTORY_MESSAGES` env var (1–100, default 20)
- Messages fetched in DESC order then reversed to chronological
- Format: `[{ role: 'user'|'model', parts: [{ text }] }]`
- Saved to DB **after full stream completes** (not per-chunk)

## Streaming

| Step | Detail |
|---|---|
| 1 | `pickReactionEmoji(text)` selects an emoji based on message content |
| 2 | `setMessageReaction` called immediately with the initial emoji |
| 3 | `sendChatAction('typing')` sent; refreshed every 4 s while processing |
| 4 | Handler sends placeholder `"..."` Telegram message |
| 5 | `chatStream()` returns `AsyncGenerator<string>` |
| 6 | Chunks accumulated into `accumulated` string |
| 7 | `editMessageText` called every `STREAM_THROTTLE_MS` ms (default 800ms) |
| 8 | Final edit applies full response with `parse_mode: Markdown`; falls back to plaintext on parse error |
| 9 | If response >4096 chars, `splitMessage()` sends additional messages |
| 10 | Reaction updated to "done" emoji via `pickCompletionEmoji(initialEmoji)` |
| finally | `clearInterval` stops the typing indicator; error reaction set to `😔` on failure |

## Retry Behavior

Calls wrapped with `withRetry` (3 attempts, exponential backoff + jitter, max 8 s delay).

Retried on: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `SQLITE_BUSY`, HTTP 429, HTTP 5xx.
Not retried on: HTTP 400, 401, 403, 404.

## Assumptions & Notes

- Generation config (temperature, topP, maxOutputTokens) uses Vertex AI defaults — no overrides set.
- No tool/function calling is configured.
- No grounding or RAG is used.
