# DEPLOYMENT.md

> Steps to run the bot in each environment. Update when infra or env requirements change.

## Prerequisites

| Requirement | How to satisfy |
|---|---|
| Node.js ≥ 22 | `node --version` |
| Google Cloud project | With Vertex AI API enabled |
| ADC configured | `gcloud auth application-default login` |
| Telegram bot token | Create via @BotFather |

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | From @BotFather |
| `GOOGLE_CLOUD_PROJECT` | ✅ | — | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | No | `us-central1` | Vertex AI region |
| `DATABASE_URL` | No | `./data/minibot.db` | SQLite file path; dir must exist |
| `ALLOWED_USER_IDS` | No | `""` (open) | Comma-separated Telegram user IDs |
| `GEMINI_MODEL` | No | `gemini-3.0-flash` | **[INFERRED]** Verify model ID is valid |
| `MAX_HISTORY_MESSAGES` | No | `20` | Range 1–100 |
| `STREAM_THROTTLE_MS` | No | `800` | Range 200–5000 ms |
| `NODE_ENV` | No | `development` | Set `production` in prod |
| `LOG_LEVEL` | No | `info` | `debug\|info\|warn\|error` |

## Local Development

```bash
# 1. Install deps
yarn install

# 2. Copy and fill env
cp .env.example .env

# 3. Create DB directory
mkdir -p data

# 4. Run migrations (also run automatically on startup)
npm run db:migrate

# 5. Start with hot-reload
npm run dev
```

## Production (Node)

```bash
npm run build          # tsc → dist/
NODE_ENV=production npm start
```

## Docker

```bash
# Build image
npm run docker:build   # or: docker build -t minibot .

# Start (detached)
npm run docker:up      # or: docker compose up -d

# View logs
npm run docker:logs

# Stop
npm run docker:down
```

> **[INFERRED]** The `docker-compose.yml` likely mounts a volume for `./data/` to persist the SQLite file across container restarts. Verify this before relying on it.

## Database Migrations

Migrations run **automatically on every startup** via `src/infrastructure/db/client.ts`. To run manually:

```bash
npm run db:migrate
```

To generate a new migration after editing `src/infrastructure/db/schema.ts`:

```bash
npm run db:generate    # creates new SQL file in src/infrastructure/db/migrations/
npm run db:migrate     # applies it
```

## Health Check

There is no HTTP health endpoint — the bot uses long-polling. To verify it's running:

1. Send `/start` to the bot in Telegram
2. Check logs: `npm run docker:logs` or stdout in dev

## Restart Behavior

| State | On restart |
|---|---|
| Conversation history | Preserved (SQLite) |
| User records | Preserved (SQLite) |
| Rate limiter counters | **Reset** (in-memory) |
| Pending Telegram updates | Replayed by Telegram (long-poll) |

## Known Deployment Risks

- SQLite is a single file — ensure backups before schema migrations
- `ALLOWED_USER_IDS` empty = open bot, any Telegram user triggers Vertex AI calls
- ADC must be available inside Docker; mount service account key or use Workload Identity
