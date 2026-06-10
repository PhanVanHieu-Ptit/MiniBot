# AI_BEHAVIOR.md

> Describes how the AI provider is configured and behaves. Update when prompt, model, or safety settings change.

## Provider

| Field | Value |
|---|---|
| SDK | `@google-cloud/vertexai` |
| Auth | Application Default Credentials (ADC) — no API key |
| Model | `GEMINI_MODEL` env var (default `gemini-3.0-flash`) **[INFERRED: model name unverified]** |
| Location | `GOOGLE_CLOUD_LOCATION` env var (default `us-central1`) |
| File | `src/infrastructure/ai/GeminiProvider.ts` |

## System Prompt

```
You are a helpful, concise AI assistant.
```

Configured as `systemInstruction` on the Vertex AI `GenerativeModel`. Not user-configurable at runtime.

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
| 1 | `chatStream()` returns `AsyncGenerator<string>` |
| 2 | Handler sends placeholder `"..."` Telegram message |
| 3 | Chunks accumulated into `accumulated` string |
| 4 | `editMessageText` called every `STREAM_THROTTLE_MS` ms (default 800ms) |
| 5 | Final edit applies full response with `parse_mode: Markdown` |
| 6 | If response >4096 chars, `splitMessage()` sends additional messages |

## Retry Behavior

Calls wrapped with `withRetry` (3 attempts, exponential backoff + jitter, max 8 s delay).

Retried on: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `SQLITE_BUSY`, HTTP 429, HTTP 5xx.
Not retried on: HTTP 400, 401, 403, 404.

## Assumptions & Unknowns

- **[INFERRED]** `gemini-3.0-flash` may not be a valid Vertex AI model ID. Verify with `gcloud ai models list`.
- Generation config (temperature, topP, maxOutputTokens) uses Vertex AI defaults — no overrides set.
- No tool/function calling is configured.
- No grounding or RAG is used.
