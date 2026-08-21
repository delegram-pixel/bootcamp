/**
 * Destructive reset. Wipes the database schema so the next migrate starts
 * clean. Refuses to run in production.
 *
 *  - Local PGlite  → delete the on-disk data directory.
 *  - Real Postgres → DROP SCHEMA public CASCADE; CREATE SCHEMA public.
 *
 * Follow with `npm run db:migrate:local && npm run db:seed` (local) or
 * `npm run db:migrate && npm run db:seed` (real Postgres).
 */
import { rm } from "node:fs/promises";

import { isProd, features, env } from "@/lib/env";

async function main() {
  if (isProd) {
    console.error("Refusing to reset the database in production.");
    process.exit(1);
  }

  if (features.localDb) {
    await rm(env.PGLITE_DIR, { recursive: true, force: true });
    console.log(`✓ Removed local PGlite directory (${env.PGLITE_DIR})`);
    console.log("  Next: npm run db:migrate:local && npm run db:seed");
    return;
  }

  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`drop schema if exists public cascade;`);
  await db.execute(sql`create schema public;`);
  console.log("✓ Dropped and recreated schema `public`");
  console.log("  Next: npm run db:migrate && npm run db:seed");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
