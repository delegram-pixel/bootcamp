import { createRequire } from "node:module";

import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env, isProd } from "@/lib/env";
import * as schema from "./schema";

/**
 * Two drivers, one `db`:
 *
 *  - Production / anywhere DATABASE_URL is set → postgres.js against Neon
 *    (the locked stack). `prepare: false` + `max: 1` keep us happy on
 *    transaction-pooling endpoints and serverless.
 *  - Local dev with no DATABASE_URL → PGlite, real Postgres compiled to WASM,
 *    persisted under `.pglite/`. Zero external services, so the whole app —
 *    seed, login, submit, grade — runs offline. Never used in production.
 *
 * PGlite is pulled in through `createRequire` rather than a static import so it
 * stays out of the production server bundle entirely.
 */
export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  _dbClient?: { close?: () => Promise<void>; end?: () => Promise<void> };
  _drizzle?: Database;
};

function createPostgresDb(url: string): Database {
  const client = postgres(url, { max: 1, prepare: false });
  globalForDb._dbClient = client;
  return drizzlePostgres(client, { schema, casing: "snake_case" });
}

function createPgliteDb(): Database {
  const require = createRequire(import.meta.url);
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const client = new PGlite(env.PGLITE_DIR);
  globalForDb._dbClient = client;
  // Both drivers extend Drizzle's PgDatabase; our query surface is identical.
  return drizzlePglite(client, { schema, casing: "snake_case" }) as unknown as Database;
}

function init(): Database {
  if (globalForDb._drizzle) return globalForDb._drizzle;

  let instance: Database;
  if (env.DATABASE_URL) {
    instance = createPostgresDb(env.DATABASE_URL);
  } else if (!isProd) {
    instance = createPgliteDb();
  } else {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon (or any Postgres) connection string to .env.local — see .env.example.",
    );
  }

  globalForDb._drizzle = instance;
  return instance;
}

/**
 * Returns the real Drizzle instance, connecting on first call. Use where a
 * consumer must introspect the concrete driver — notably the Auth.js Drizzle
 * adapter, which sniffs the dialect off the object and can't see through the
 * `db` Proxy below.
 */
export function getDb(): Database {
  return init();
}

/**
 * Proxy so `import { db }` is side-effect free. First real property access
 * triggers the connection; methods are bound to the real instance so
 * `db.transaction(...)`, `db.query.*`, etc. behave correctly.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = init();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
