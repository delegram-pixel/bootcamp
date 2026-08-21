import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local first (dev secrets), then .env as fallback. dotenv does not
// override already-set vars, so the first file wins.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
