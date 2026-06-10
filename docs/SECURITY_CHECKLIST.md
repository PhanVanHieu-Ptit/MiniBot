# SECURITY_CHECKLIST.md

> Security posture of the bot. Review before any deployment or when adding new features.

## Authentication & Authorization

| Check | Status | Notes |
|---|---|---|
| Telegram user allowlist | ✅ Implemented | `ALLOWED_USER_IDS` env var; empty = open to all |
| Bot token in env only | ✅ Implemented | `TELEGRAM_BOT_TOKEN` never hardcoded |
| GCP credentials via ADC | ✅ Implemented | No service account key file in repo |
| Per-user rate limiting | ✅ Implemented | 10 msg/60 s in-memory |
| Admin commands separated | ⚠️ Not implemented | Any allowed user can `/reset` their own history; no admin role |

## Input Handling

| Check | Status | Notes |
|---|---|---|
| Config validated at startup | ✅ Zod schema | Process exits on invalid env |
| Message length limits | ✅ `splitMessage` | Output split at 4096 chars; input length unchecked |
| SQL injection | ✅ Drizzle ORM | Parameterized queries; no raw SQL in app code |
| Prompt injection | ⚠️ No mitigation | User input sent directly to Gemini as `userMessage`; AI safety filters are the only protection |
| Markdown injection (Telegram) | ⚠️ Fragile | `parse_mode: Markdown` applied to AI output; unbalanced tokens cause Telegram to reject edits |

## Data & Privacy

| Check | Status | Notes |
|---|---|---|
| All messages stored in DB | ⚠️ Be aware | Full conversation history persisted in SQLite — encrypt disk if sensitive |
| No PII logged beyond userId | ✅ | Logger captures userId, username, text preview (80 chars) |
| `/reset` deletes history | ✅ | CASCADE delete removes all messages for a user |
| DB file location | ⚠️ Configurable | Default `./data/minibot.db` — ensure directory has restricted permissions in production |

## Network & Infrastructure

| Check | Status | Notes |
|---|---|---|
| Long-polling only (no webhook) | ✅ | No inbound HTTP port; reduces attack surface |
| TLS | ✅ via SDK | grammy and Vertex AI SDKs use HTTPS internally |
| Docker non-root user | **[INFERRED]** Unverified | Check Dockerfile — should run as non-root |
| Secrets in Docker | ⚠️ Unknown | Ensure `.env` not baked into image; use Docker secrets or env injection |

## Dependency Security

| Check | Status |
|---|---|
| `npm audit` run | ⚠️ Not automated (no CI) |
| Lock file committed | ✅ `yarn.lock` present |
| Outdated packages checked | ⚠️ No scheduled review |

## Recommendations

1. Set `ALLOWED_USER_IDS` in all deployments — open bots incur Vertex AI costs for any user.
2. Sanitize or strip Markdown before sending AI output to Telegram (fallback to plain text on parse error).
3. Add `npm audit` to a CI step or pre-commit hook.
4. Encrypt the SQLite file or run on an encrypted volume if conversations are sensitive.
5. Validate max input message length to avoid sending huge prompts to Gemini.
