# DECISIONS.md

Decisions inferred from the code. Marked **[INFERRED]** where no explicit comment exists.

---

## grammy over Telegraf

**[INFERRED]** grammy is the modern, ESM-native Telegram framework with better TypeScript support than Telegraf. Consistent with the ESM-first project setup.

---

## Vertex AI over direct Gemini API

`@google-cloud/vertexai` uses Application Default Credentials instead of an API key. This means:
- No API key to rotate or leak
- Access controlled by GCP IAM
- Requires `gcloud` ADC setup or a service account — higher ops burden for non-GCP environments

**[INFERRED]** Chosen to align with a GCP-hosted deployment target.

---

## SQLite over PostgreSQL

**[INFERRED]** Single-process bot with low concurrency. SQLite with WAL mode handles sequential Telegram updates adequately. No infra to operate. The tradeoff is: no horizontal scaling, no remote access, file-based backup required.

---

## Manual DI over a framework

**[INFERRED]** The container is ~20 lines. A DI framework (tsyringe, inversify) would add complexity with no benefit at this scale.

---

## Long-poll over Webhook

`bot.start()` uses grammy's long-polling mode. No webhook setup or HTTPS endpoint required. Suitable for development and Docker deployments without a public domain. Tradeoff: slightly higher latency vs webhooks; polling cannot scale horizontally.

---

## Streaming reply with throttled edits

Handler sends a placeholder `...` message immediately, then edits it as chunks arrive. Edit frequency is capped by `STREAM_THROTTLE_MS` (default 800ms) to avoid Telegram's rate limit on `editMessageText` (~20 edits/min per message). Full response always sent as a final edit.

---

## History loaded per-message (no session cache)

Every message fetches up to `MAX_HISTORY_MESSAGES` from SQLite. No in-memory session cache. This avoids stale-state bugs at the cost of a DB read per message. **[INFERRED]** Chosen for simplicity and correctness over performance.

---

## ESM with `.js` import extensions

`"type": "module"` + `moduleResolution: "bundler"` requires explicit `.js` extensions on all relative imports even though source files are `.ts`. This is the Node.js ESM requirement. tsx handles it at dev time; tsc emits `.js` for production.

---

## TypeScript strict++

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` all enabled. This is the highest practical TypeScript safety tier. Implies all array accesses must handle `undefined`.
