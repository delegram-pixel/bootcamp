ALTER TABLE "note" ADD COLUMN "week_number" integer;
--> statement-breakpoint
-- Backfill: derive a numeric week from the legacy free-text `week` by taking its
-- first run of digits ("Week 4 — Day 1" -> 4, "Week 10" -> 10). Notes whose week
-- has no digits (or is null) stay null and fall into the "General" section.
UPDATE "note"
SET "week_number" = (regexp_match("week", '\d+'))[1]::int
WHERE "week_number" IS NULL AND "week" ~ '\d';