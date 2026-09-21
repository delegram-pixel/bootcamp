/**
 * Copy the local PGlite notes (and their quizzes) up to Neon — ADDITIVE ONLY.
 *
 *   npx tsx src/db/copy-notes-to-neon.ts           # dry run, prints the plan
 *   npx tsx src/db/copy-notes-to-neon.ts --apply   # writes
 *
 * Every insert uses `onConflictDoNothing`, so a row that already exists on Neon
 * is skipped rather than overwritten. Nothing is ever updated or deleted: this
 * is deliberately not a sync. Re-running it is safe.
 *
 * Deliberately NOT `db:seed`. That script opens by deleting every table in
 * child→parent order — including `user` — and it can't reach Neon anyway (tsx
 * doesn't load .env, so it silently falls back to PGlite). This script loads
 * the env itself and touches exactly seven tables, all inserts.
 *
 * Opens two connections at once, which is why it doesn't go through `@/db`:
 * that module picks one driver based on DATABASE_URL, and here we need the
 * local PGlite as the *source* while postgres.js is the *destination*.
 *
 * PGlite is single-writer — stop `next dev` before running this, or the local
 * open will fail.
 */
import { config } from "dotenv";

// Load the env ourselves: tsx does not, which is the whole reason `db:seed`
// can never see Neon. .env.local first, .env as fallback (same order as
// drizzle.config.ts, so this reaches the same database `db:migrate` does).
config({ path: ".env.local" });
config({ path: ".env" });

import { inArray } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const APPLY = process.argv.includes("--apply");
const LOCAL_DIR = process.env.PGLITE_DIR || ".pglite";
const NEON_URL = process.env.DATABASE_URL;

if (!NEON_URL) {
  console.error(
    "DATABASE_URL is not set — looked in .env.local and .env.\n" +
      "Refusing to run: without it there is no destination, and falling back to\n" +
      "PGlite would copy the local database onto itself.",
  );
  process.exit(1);
}

/** Print the shape of a pending write without doing it. */
function plan(label: string, rows: { id: string }[], skip: Set<string>) {
  const fresh = rows.filter((r) => !skip.has(r.id));
  const dupes = rows.length - fresh.length;
  console.log(
    `  ${label.padEnd(20)} ${String(fresh.length).padStart(3)} to add` +
      (dupes ? `, ${dupes} already there (skipped)` : ""),
  );
  return fresh;
}

/* ------------------------------------------------------------ read local */

const { PGlite } = await import("@electric-sql/pglite");
const localClient = new PGlite(LOCAL_DIR);
const local = drizzlePglite(localClient, { schema, casing: "snake_case" });

console.log(`Reading  ${LOCAL_DIR}  (PGlite)`);
console.log(`Writing  ${NEON_URL.replace(/:[^:@]*@/, ":***@")}  (Neon)`);
console.log(APPLY ? "\nMODE: APPLY — writing\n" : "\nMODE: dry run — nothing is written\n");

const srcNotes = await local.select().from(schema.notes);
const srcNoteIds = srcNotes.map((n) => n.id);

const srcGroupIds = [...new Set(srcNotes.map((n) => n.groupId).filter((g): g is string => g != null))];
const srcGroups = srcGroupIds.length
  ? await local.select().from(schema.groups).where(inArray(schema.groups.id, srcGroupIds))
  : [];

const srcAttachments = srcNoteIds.length
  ? await local
      .select()
      .from(schema.noteAttachments)
      .where(inArray(schema.noteAttachments.noteId, srcNoteIds))
  : [];

const srcAssessments = srcNoteIds.length
  ? await local.select().from(schema.assessments).where(inArray(schema.assessments.noteId, srcNoteIds))
  : [];
const srcAssessmentIds = srcAssessments.map((a) => a.id);

const srcQuestions = srcAssessmentIds.length
  ? await local
      .select()
      .from(schema.assessmentQuestions)
      .where(inArray(schema.assessmentQuestions.assessmentId, srcAssessmentIds))
  : [];
const srcQuestionIds = srcQuestions.map((q) => q.id);

const srcOptions = srcQuestionIds.length
  ? await local
      .select()
      .from(schema.assessmentOptions)
      .where(inArray(schema.assessmentOptions.questionId, srcQuestionIds))
  : [];

await localClient.close();

/* ----------------------------------------------------- resolve the author */

const neonClient = postgres(NEON_URL, { max: 1, prepare: false });
const remote = drizzlePostgres(neonClient, { schema, casing: "snake_case" });

const remoteUsers = await remote
  .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
  .from(schema.users);
const remoteUserIds = new Set(remoteUsers.map((u) => u.id));

const wantedAuthors = [...new Set(srcNotes.map((n) => n.createdById))];
let authorFallback = wantedAuthors.find((id) => remoteUserIds.has(id)) ?? null;

if (!authorFallback) {
  const admin = remoteUsers.find((u) => u.role === "admin");
  authorFallback = admin?.id ?? null;
}

if (!authorFallback) {
  console.error(
    `\nNo usable author on Neon.\n` +
      `Local notes are authored by ${wantedAuthors.join(", ")}, none of which exist there,\n` +
      `and Neon has no user with role 'admin' to attribute them to.\n` +
      `Annotate a user as admin in Neon first, then re-run.`,
  );
  await neonClient.end();
  process.exit(1);
}

const authorIsSubstituted = !wantedAuthors.every((id) => remoteUserIds.has(id));

/* ------------------------------------------------------------------ plan */

const existingGroups = new Set(
  (await remote.select({ id: schema.groups.id }).from(schema.groups)).map((r) => r.id),
);
const existingNotes = new Set(
  (await remote.select({ id: schema.notes.id }).from(schema.notes)).map((r) => r.id),
);
const existingAssessments = new Set(
  (await remote.select({ id: schema.assessments.id }).from(schema.assessments)).map((r) => r.id),
);
const existingQuestions = new Set(
  (await remote
    .select({ id: schema.assessmentQuestions.id })
    .from(schema.assessmentQuestions)).map((r) => r.id),
);
const existingOptions = new Set(
  (await remote
    .select({ id: schema.assessmentOptions.id })
    .from(schema.assessmentOptions)).map((r) => r.id),
);
const existingAttachments = new Set(
  (await remote
    .select({ id: schema.noteAttachments.id })
    .from(schema.noteAttachments)).map((r) => r.id),
);

console.log("Plan");
plan("cohorts", srcGroups, existingGroups);
const newNotes = plan("notes", srcNotes, existingNotes);
plan("attachments", srcAttachments, existingAttachments);
const newAssessments = plan("assessments", srcAssessments, existingAssessments);
const newQuestions = plan("questions", srcQuestions, existingQuestions);
plan("options", srcOptions, existingOptions);

console.log(
  `\n  ${newAssessments.length} of the ${newNotes.length} new notes carry a quiz` +
    ` → ${newQuestions.length} questions, ${srcOptions.length} options`,
);

if (authorIsSubstituted) {
  console.log(
    `\n  NOTE  ${wantedAuthors.join(", ")} don't exist on Neon.\n` +
      `        New notes will be attributed to "${authorFallback}" instead.`,
  );
}

const newGroupRows = srcGroups.filter((g) => !existingGroups.has(g.id));
if (newGroupRows.length) {
  console.log(
    `\n  NOTE  This adds ${newGroupRows.length} cohort(s) to the live site:\n` +
      newGroupRows.map((g) => `        · ${g.name} (${g.id})`).join("\n") +
      `\n        Nobody is enrolled in them, so only an admin will see their notes.`,
  );
}

if (!APPLY) {
  console.log("\nDry run — re-run with --apply to write.");
  await neonClient.end();
  process.exit(0);
}

/* ----------------------------------------------------------------- write */

// FK order: groups and the author must exist before the notes that point at
// them; notes before attachments and assessments; assessments before questions;
// questions before options.
if (newGroupRows.length) {
  await remote.insert(schema.groups).values(newGroupRows).onConflictDoNothing();
}

const noteRows = srcNotes
  .filter((n) => !existingNotes.has(n.id))
  .map((n) => ({ ...n, createdById: remoteUserIds.has(n.createdById) ? n.createdById : authorFallback }));
if (noteRows.length) {
  await remote.insert(schema.notes).values(noteRows).onConflictDoNothing();
}

const attachmentRows = srcAttachments.filter((a) => !existingAttachments.has(a.id));
if (attachmentRows.length) {
  await remote.insert(schema.noteAttachments).values(attachmentRows).onConflictDoNothing();
}

// Only the assessments whose note actually landed — a quiz pointing at a note
// that was skipped (or refused) would violate the FK.
const landedNoteIds = new Set([...existingNotes, ...noteRows.map((n) => n.id)]);
const assessmentRows = srcAssessments.filter(
  (a) => !existingAssessments.has(a.id) && landedNoteIds.has(a.noteId),
);
if (assessmentRows.length) {
  await remote.insert(schema.assessments).values(assessmentRows).onConflictDoNothing();
}

const landedAssessmentIds = new Set([...existingAssessments, ...assessmentRows.map((a) => a.id)]);
const questionRows = srcQuestions.filter(
  (q) => !existingQuestions.has(q.id) && landedAssessmentIds.has(q.assessmentId),
);
if (questionRows.length) {
  await remote.insert(schema.assessmentQuestions).values(questionRows).onConflictDoNothing();
}

const landedQuestionIds = new Set([...existingQuestions, ...questionRows.map((q) => q.id)]);
const optionRows = srcOptions.filter(
  (o) => !existingOptions.has(o.id) && landedQuestionIds.has(o.questionId),
);
if (optionRows.length) {
  await remote.insert(schema.assessmentOptions).values(optionRows).onConflictDoNothing();
}

console.log(
  `\nDone. Added ${newGroupRows.length} cohort(s), ${noteRows.length} note(s), ` +
    `${assessmentRows.length} quiz(zes) — ${questionRows.length} questions, ${optionRows.length} options.`,
);

await neonClient.end();
