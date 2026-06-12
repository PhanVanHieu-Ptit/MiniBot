# DEPLOYMENT.md

> Steps to run the bot in each environment. Update when infra or env requirements change.

## Prerequisites

| Requirement | How to satisfy |
|---|---|
| Node.js ≥ 22 | `node --version` |
| Google Cloud project | With Vertex AI API enabled |
| ADC configured (local) | `gcloud auth application-default login` |
| GCP Service Account key (VPS) | See [GCP Auth on VPS](#gcp-auth-on-vps) below |
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

## GCP Auth on VPS

Locally, ADC works via `gcloud auth application-default login`. On VPS the Docker container has no gcloud credentials, so a **Service Account key** is required.

```bash
# 1. Create Service Account
gcloud iam service-accounts create minibot-sa \
  --project=YOUR_PROJECT_ID \
  --display-name="MiniBot Vertex AI"

# 2. Grant Vertex AI User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:minibot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 3. Download key JSON
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account=minibot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com

# 4. Upload to VPS (keep outside repo — never commit this file)
scp gcp-sa-key.json user@VPS_HOST:/opt/minibot/gcp-sa-key.json
```

`docker-compose.prod.yml` mounts `/opt/minibot/gcp-sa-key.json` → `/app/gcp-sa-key.json:ro` and sets `GOOGLE_APPLICATION_CREDENTIALS` automatically.

## Known Deployment Risks

- SQLite is a single file — ensure backups before schema migrations
- `ALLOWED_USER_IDS` empty = open bot, any Telegram user triggers Vertex AI calls
- Never commit `gcp-sa-key.json` — it grants Vertex AI access to your GCP project
