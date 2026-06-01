import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  DATABASE_URL: z.string().default('./data/minibot.db'),
  ALLOWED_USER_IDS: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(',')
            .map((id) => parseInt(id.trim(), 10))
            .filter(Boolean)
        : [],
    ),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  MAX_HISTORY_MESSAGES: z.coerce.number().int().min(1).max(100).default(20),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  STREAM_THROTTLE_MS: z.coerce.number().int().min(200).max(5000).default(800),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
