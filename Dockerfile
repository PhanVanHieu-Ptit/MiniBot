# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
# Copy migration SQL files alongside compiled JS so the auto-migrator finds them at runtime
COPY --from=builder /app/src/infrastructure/db/migrations ./dist/infrastructure/db/migrations

CMD ["node", "dist/index.js"]
