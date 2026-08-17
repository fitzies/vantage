import "server-only";
import { z } from "zod";

/**
 * Server-only environment validation.
 *
 * Importing this file from a Client Component will fail the build via
 * `server-only`. That's deliberate — `DATABASE_URL` must never ship to
 * the browser.
 *
 * The Vercel Marketplace Neon integration sets both `DATABASE_URL` and
 * `POSTGRES_URL`; we accept either so this works locally and on Vercel
 * without touching env config.
 */
const schema = z
  .object({
    DATABASE_URL: z.string().url().optional(),
    POSTGRES_URL: z.string().url().optional(),
    /** Better Auth settings for dashboard users. */
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    BOOTSTRAP_OWNER_EMAIL: z.string().email().optional(),
    /**
     * Telegram bot notification settings. Optional at process startup so the
     * app can build before the bot is configured; Telegram-specific routes
     * validate the values they need at request time.
     */
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
    CRON_SECRET: z.string().min(16).optional(),
  })
  .refine((v) => Boolean(v.DATABASE_URL ?? v.POSTGRES_URL), {
    message: "Set DATABASE_URL or POSTGRES_URL",
    path: ["DATABASE_URL"],
  });

const parsed = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BOOTSTRAP_OWNER_EMAIL: process.env.BOOTSTRAP_OWNER_EMAIL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
});

const databaseUrl = (parsed.DATABASE_URL ?? parsed.POSTGRES_URL) as string;

export const env = {
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: parsed.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: parsed.BETTER_AUTH_URL,
  BOOTSTRAP_OWNER_EMAIL: parsed.BOOTSTRAP_OWNER_EMAIL,
  TELEGRAM_BOT_TOKEN: parsed.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: parsed.TELEGRAM_CHAT_ID,
  TELEGRAM_WEBHOOK_SECRET: parsed.TELEGRAM_WEBHOOK_SECRET,
  CRON_SECRET: parsed.CRON_SECRET,
} as const;
