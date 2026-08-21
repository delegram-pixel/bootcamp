// Applies SQL migrations to the local PGlite dev database. Real Postgres uses
// drizzle-kit (`db:migrate` / `db:push`); this is the offline-dev counterpart.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

async function main() {
  if (process.env.DATABASE_URL) {
    console.error("DATABASE_URL is set — use `npm run db:migrate` (drizzle-kit) instead.");
    process.exit(1);
  }

  const dir = process.env.PGLITE_DIR ?? ".pglite";
  const client = new PGlite(dir);
  const db = drizzle(client, { schema, casing: "snake_case" });

  await migrate(db, { migrationsFolder: "drizzle" });
  await client.close();

  console.log(`✓ PGlite migrated (${dir})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
