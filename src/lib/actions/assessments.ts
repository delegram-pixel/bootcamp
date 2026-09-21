"use server";

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentOptions,
  assessmentQuestions,
  assessments,
  notes,
} from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import { revalidateNoteEditor } from "@/lib/revalidate-notes";
import {
  assessmentCorrectOptionSchema,
  assessmentOptionAddSchema,
  assessmentOptionUpdateSchema,
  assessmentQuestionAddSchema,
  assessmentQuestionUpdateSchema,
  assessmentUpsertSchema,
  removeAssessmentOptionSchema,
  removeAssessmentQuestionSchema,
  removeAssessmentSchema,
  type AssessmentCorrectOptionInput,
  type AssessmentOptionAddInput,
  type AssessmentOptionUpdateInput,
  type AssessmentQuestionAddInput,
  type AssessmentQuestionUpdateInput,
  type AssessmentUpsertInput,
  type RemoveAssessmentOptionInput,
  type RemoveAssessmentQuestionInput,
  type RemoveAssessmentInput,
} from "@/lib/validations";

const ADMIN = { action: "manage", resource: { kind: "admin" } } as const;

/**
 * Authoring a module's quiz. Every mutation is admin-only and goes through the
 * one central `guardedAction` → `authorize()` gate, exactly as `actions/notes.ts`
 * does — the client is never the authority on who may edit a quiz.
 *
 * Each action resolves its row up the chain (option → question → assessment →
 * note) before writing, for two reasons:
 *
 *  1. **Scope.** Only *cohort* notes can carry a quiz — a global note is
 *     reference material with no path to gate, so authoring one would create a
 *     quiz nobody can ever be gated by.
 *  2. **Revalidation.** The note's cohort decides which reader and standing
 *     views must be invalidated, and a quiz edit moves everyone's grade
 *     denominator.
 */

/** Where a quiz sits: its note and that note's cohort (null = global note). */
type NoteScope = { noteId: string; groupId: string | null };

async function noteForQuiz(assessmentId: string): Promise<NoteScope | null> {
  const row = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentId),
    columns: { noteId: true },
    with: { note: { columns: { groupId: true } } },
  });
  if (!row) return null;
  return { noteId: row.noteId, groupId: row.note?.groupId ?? null };
}

async function noteForQuestion(questionId: string): Promise<NoteScope | null> {
  const row = await db.query.assessmentQuestions.findFirst({
    where: eq(assessmentQuestions.id, questionId),
    columns: { assessmentId: true },
  });
  return row ? noteForQuiz(row.assessmentId) : null;
}

async function noteForOption(optionId: string): Promise<NoteScope | null> {
  const row = await db.query.assessmentOptions.findFirst({
    where: eq(assessmentOptions.id, optionId),
    columns: { questionId: true },
  });
  return row ? noteForQuestion(row.questionId) : null;
}

/**
 * Refuse authoring on a global note. Returned as a plain failure rather than a
 * thrown error so the admin UI can show it in a toast.
 */
function globalNoteRefusal(): ActionResult<never> {
  return fail(
    "Global notes are shared reference reading and can't carry a quiz. Set this note's audience to a cohort first.",
  );
}

const notFound = () => fail("That no longer exists.");

/* ------------------------------------------------------------- the quiz */

/**
 * Create the note's quiz, or update its pass mark. One row per note (the unique
 * `noteId` makes the upsert idempotent), so "does this module gate?" stays a
 * plain existence check for the gating layer.
 */
export async function upsertAssessment(
  input: AssessmentUpsertInput,
): Promise<ActionResult<{ id: string }>> {
  return guardedAction(
    { ...ADMIN, schema: assessmentUpsertSchema, input },
    async (data) => {
      const note = await db.query.notes.findFirst({
        where: eq(notes.id, data.noteId),
        columns: { id: true, groupId: true },
      });
      if (!note) return notFound();
      if (note.groupId == null) return globalNoteRefusal();

      const passPct = Number(data.passPct);
      const [row] = await db
        .insert(assessments)
        .values({ noteId: data.noteId, passPct })
        .onConflictDoUpdate({
          target: assessments.noteId,
          set: { passPct },
        })
        .returning({ id: assessments.id });

      revalidateNoteEditor(data.noteId, note.groupId);
      return ok({ id: row.id }, "Assessment saved");
    },
  );
}

/**
 * Delete the quiz. **Cascades** to its questions, options, every intern's
 * attempts, and their answers — so those scores leave the grade pool with it.
 * The UI says so plainly before calling this.
 */
export async function deleteAssessment(
  input: RemoveAssessmentInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: removeAssessmentSchema, input },
    async (data) => {
      const note = await db.query.notes.findFirst({
        where: eq(notes.id, data.noteId),
        columns: { groupId: true },
      });
      if (!note) return notFound();
      await db.delete(assessments).where(eq(assessments.noteId, data.noteId));
      revalidateNoteEditor(data.noteId, note.groupId);
      return ok(undefined, "Assessment removed");
    },
  );
}

/* --------------------------------------------------------- the questions */

/**
 * Append a question to the quiz. Its order is assigned here rather than sent by
 * the client, so the path of questions can't be reordered by a stale form.
 */
export async function addQuestion(
  input: AssessmentQuestionAddInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: assessmentQuestionAddSchema, input },
    async (data) => {
      const scope = await noteForQuiz(data.assessmentId);
      if (!scope) return notFound();
      if (scope.groupId == null) return globalNoteRefusal();

      const last = await db.query.assessmentQuestions.findFirst({
        where: eq(assessmentQuestions.assessmentId, data.assessmentId),
        columns: { order: true },
        orderBy: [desc(assessmentQuestions.order)],
      });
      await db.insert(assessmentQuestions).values({
        assessmentId: data.assessmentId,
        prompt: data.prompt,
        points: Number(data.points),
        order: (last?.order ?? 0) + 1,
      });

      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Question added");
    },
  );
}

export async function updateQuestion(
  input: AssessmentQuestionUpdateInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: assessmentQuestionUpdateSchema, input },
    async (data) => {
      const scope = await noteForQuestion(data.id);
      if (!scope) return notFound();
      await db
        .update(assessmentQuestions)
        .set({ prompt: data.prompt, points: Number(data.points) })
        .where(eq(assessmentQuestions.id, data.id));
      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Question updated");
    },
  );
}

/** Remove a question and, by cascade, its options. Older attempts keep their scores. */
export async function removeQuestion(
  input: RemoveAssessmentQuestionInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: removeAssessmentQuestionSchema, input },
    async (data) => {
      const scope = await noteForQuestion(data.id);
      if (!scope) return notFound();
      await db
        .delete(assessmentQuestions)
        // Scoped by assessment as well as id, so a mismatched pair deletes nothing.
        .where(
          and(
            eq(assessmentQuestions.id, data.id),
            eq(assessmentQuestions.assessmentId, data.assessmentId),
          ),
        );
      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Question removed");
    },
  );
}

/* ----------------------------------------------------------- the options */

/**
 * Append an answer choice. Marking it correct clears the question's others in
 * the same transaction — one correct answer per question is what keeps the radio
 * UI and the scoring rule telling the same story.
 */
export async function addOption(
  input: AssessmentOptionAddInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: assessmentOptionAddSchema, input },
    async (data) => {
      const scope = await noteForQuestion(data.questionId);
      if (!scope) return notFound();

      const last = await db.query.assessmentOptions.findFirst({
        where: eq(assessmentOptions.questionId, data.questionId),
        columns: { order: true },
        orderBy: [desc(assessmentOptions.order)],
      });
      const order = (last?.order ?? 0) + 1;

      if (data.isCorrect) {
        await db.transaction(async (tx) => {
          await tx
            .update(assessmentOptions)
            .set({ isCorrect: false })
            .where(eq(assessmentOptions.questionId, data.questionId));
          await tx.insert(assessmentOptions).values({
            questionId: data.questionId,
            label: data.label,
            isCorrect: true,
            order,
          });
        });
      } else {
        await db.insert(assessmentOptions).values({
          questionId: data.questionId,
          label: data.label,
          isCorrect: false,
          order,
        });
      }

      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Option added");
    },
  );
}

export async function updateOption(
  input: AssessmentOptionUpdateInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: assessmentOptionUpdateSchema, input },
    async (data) => {
      const scope = await noteForOption(data.id);
      if (!scope) return notFound();
      await db
        .update(assessmentOptions)
        .set({ label: data.label })
        .where(eq(assessmentOptions.id, data.id));
      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Option updated");
    },
  );
}

/** Mark one option as the right answer, clearing the question's other options. */
export async function setCorrectOption(
  input: AssessmentCorrectOptionInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: assessmentCorrectOptionSchema, input },
    async (data) => {
      const scope = await noteForOption(data.optionId);
      if (!scope) return notFound();

      await db.transaction(async (tx) => {
        await tx
          .update(assessmentOptions)
          .set({ isCorrect: false })
          .where(eq(assessmentOptions.questionId, data.questionId));
        await tx
          .update(assessmentOptions)
          .set({ isCorrect: true })
          .where(
            and(
              eq(assessmentOptions.id, data.optionId),
              eq(assessmentOptions.questionId, data.questionId),
            ),
          );
      });

      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Correct answer set");
    },
  );
}

/**
 * Remove an answer choice. Refuses to remove the question's **last** correct
 * option: that would leave a question nobody can score, dragging the quiz's
 * pass mark out of reach for every intern. The admin is told what to do instead.
 */
export async function removeOption(
  input: RemoveAssessmentOptionInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: removeAssessmentOptionSchema, input },
    async (data) => {
      const scope = await noteForOption(data.id);
      if (!scope) return notFound();

      const target = await db.query.assessmentOptions.findFirst({
        where: and(
          eq(assessmentOptions.id, data.id),
          eq(assessmentOptions.questionId, data.questionId),
        ),
        columns: { id: true, isCorrect: true },
      });
      if (!target) return notFound();

      if (target.isCorrect) {
        const others = await db.query.assessmentOptions.findMany({
          where: and(
            eq(assessmentOptions.questionId, data.questionId),
            ne(assessmentOptions.id, data.id),
            eq(assessmentOptions.isCorrect, true),
          ),
          columns: { id: true },
        });
        if (others.length === 0) {
          return fail(
            "This is the question's only correct answer — mark another option correct first.",
          );
        }
      }

      await db
        .delete(assessmentOptions)
        .where(
          and(
            eq(assessmentOptions.id, data.id),
            eq(assessmentOptions.questionId, data.questionId),
          ),
        );
      revalidateNoteEditor(scope.noteId, scope.groupId);
      return ok(undefined, "Option removed");
    },
  );
}
