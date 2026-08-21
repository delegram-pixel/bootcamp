/**
 * Central environment access. Parsed once, validated with Zod.
 *
 * Philosophy: never hard-crash on missing *optional* service creds — the app
 * should boot and tell you what's not wired up yet. `features` exposes which
 * integrations are live so the UI/actions can degrade gracefully.
 */
import { z } from "zod";

// .env files love blank keys (`DATABASE_URL=`). Treat empty/whitespace-only
// values as "unset" so a placeholder line reads the same as an absent one.
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** Optional secret: present-and-nonblank, or absent. Blank → undefined. */
const optionalSecret = z.preprocess(blankToUndefined, z.string().min(1).optional());

/** Optional with a fallback: blank or absent → the default. */
const withDefault = (def: string) =>
  z.preprocess(blankToUndefined, z.string().min(1).default(def));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Core
  DATABASE_URL: optionalSecret,
  AUTH_SECRET: optionalSecret,
  APP_URL: withDefault("http://localhost:3000"),

  // File storage
  UPLOADTHING_TOKEN: optionalSecret,

  // Email (Resend)
  RESEND_API_KEY: optionalSecret,
  EMAIL_FROM: withDefault("Intern Portal <onboarding@resend.dev>"),

  // Cron guard
  CRON_SECRET: optionalSecret,

  // Dev-only credentials login (pick a seeded user without a password). Off in prod.
  ALLOW_DEV_LOGIN: z.preprocess(blankToUndefined, z.string().optional()),

  // Where the local PGlite dev database persists (only used when DATABASE_URL
  // is unset and not in production).
  PGLITE_DIR: withDefault(".pglite"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Only structural problems (bad enum, etc.) land here — optional creds don't.
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";

/** Which integrations are actually configured right now. */
export const features = {
  /**
   * A database is reachable: either a real DATABASE_URL, or (in dev) the local
   * PGlite fallback, which is always available. Drives whether the app shows
   * the setup screen or the real, DB-backed experience.
   */
  database: !!env.DATABASE_URL || !isProd,
  /** True when running against the local PGlite dev DB rather than a real URL. */
  localDb: !env.DATABASE_URL && !isProd,
  uploads: !!env.UPLOADTHING_TOKEN,
  email: !!env.RESEND_API_KEY,
  /** Dev sign-in as any seeded user, no OAuth. Never enabled in production. */
  devLogin: !isProd && env.ALLOW_DEV_LOGIN !== "false",
} as const;

/** Throw a clear, actionable error when a DB-backed path runs without a URL. */
export function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon (or any Postgres) connection string to .env.local — see .env.example.",
    );
  }
  return env.DATABASE_URL;
}
