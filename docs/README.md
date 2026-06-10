# docs/ — AI Agent Knowledge Base

This directory is the primary context for any AI coding agent working on MiniBot.
Files are kept short and high-signal. Long-form rationale lives in the legacy docs listed at the bottom.

---

## Document Index

| File | Purpose | Update trigger |
|---|---|---|
| [SESSION_SUMMARY.md](SESSION_SUMMARY.md) | Current project state, open items, recent git history | Start of every session |
| [TASK_BACKLOG.md](TASK_BACKLOG.md) | Prioritized bug/improvement list | When a task is started, completed, or discovered |
| [COMPONENT_REGISTRY.md](COMPONENT_REGISTRY.md) | Every source file in one table | When a file is added, moved, or deleted |
| [FEATURE_MAP.md](FEATURE_MAP.md) | User-facing commands → code mapping, request lifecycle | When a command/handler is added or removed |
| [API_CONTRACTS.md](API_CONTRACTS.md) | Interface signatures and DTOs | When any interface or shared type changes |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables, columns, constraints, migration history | After every `db:generate` / `db:migrate` |
| [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) | All mutable state, its storage, and lifetime | When new stateful logic is added |
| [AI_BEHAVIOR.md](AI_BEHAVIOR.md) | System prompt, safety settings, streaming, retry | When Gemini config or prompts change |
| [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) | Auth, input handling, data, infra security status | When adding new input paths or deployment changes |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local dev, Docker, env vars, migrations | When env vars, Docker config, or infra changes |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Test setup, priorities, patterns (no tests exist yet) | When tests are added or the strategy changes |

---

## Before Coding — Read These

Minimum context required before making any change:

1. **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** — understand current state
2. **[COMPONENT_REGISTRY.md](COMPONENT_REGISTRY.md)** — locate the right file
3. **[API_CONTRACTS.md](API_CONTRACTS.md)** — understand interface contracts before touching boundaries

For domain-specific tasks, also read:

| Task type | Additional reading |
|---|---|
| DB / schema change | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) |
| AI / prompt change | [AI_BEHAVIOR.md](AI_BEHAVIOR.md) |
| New feature / command | [FEATURE_MAP.md](FEATURE_MAP.md) |
| Security-sensitive change | [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) |
| Deployment / infra | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Writing tests | [TESTING_STRATEGY.md](TESTING_STRATEGY.md) |

---

## After Coding — Update These

| What you did | Update |
|---|---|
| Added / moved / deleted a file | [COMPONENT_REGISTRY.md](COMPONENT_REGISTRY.md) |
| Added or changed a command/handler | [FEATURE_MAP.md](FEATURE_MAP.md) |
| Changed an interface or type | [API_CONTRACTS.md](API_CONTRACTS.md) |
| Added or modified DB schema | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) |
| Completed or added a backlog item | [TASK_BACKLOG.md](TASK_BACKLOG.md) |
| Changed env vars or deployment steps | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Changed AI prompt, model, or safety | [AI_BEHAVIOR.md](AI_BEHAVIOR.md) |
| Added new mutable state | [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) |
| End of session | [SESSION_SUMMARY.md](SESSION_SUMMARY.md) |

---

## Legacy Docs (keep for rationale; don't duplicate here)

| File | Content |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layer map, DI pattern, streaming architecture diagram |
| [DECISIONS.md](DECISIONS.md) | Why grammy, Vertex AI, SQLite, long-poll, ESM were chosen |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Original issue list (superseded by [TASK_BACKLOG.md](TASK_BACKLOG.md)) |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | High-level project overview and constraints |
| [PROMPT_RULES.md](PROMPT_RULES.md) | Code style, naming, and architecture rules for AI agents |

---

## Key Invariants (never break these)

1. `src/core/interfaces/` — zero imports from `infrastructure/` or `features/`
2. All imports use `.js` extension (ESM, TypeScript bundler resolution)
3. Config injection via `Pick<Config, 'key'>` — never pass full config object
4. DB changes go through Drizzle migrations — no raw SQL in app code
5. New columns use `INTEGER` for timestamps, not `TEXT`
6. All infrastructure calls wrapped with `withRetry`
