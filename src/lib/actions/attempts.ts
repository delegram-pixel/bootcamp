"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { assessmentAnswers, assessmentAttempts, assessments } from "@/db/schema";
import {
  getCurrentUser,
  authorize,
  ForbiddenError,
  type Action,
} from "@/lib/authz";
import { ok, fail, zodFieldErrors, type ActionResult } from "@/lib/actions/types";
import { notify } from "@/lib/notify";
import { currentLevel, recordScoringMilestones } from "@/lib/scoring-events";
import { revalidateNoteViews } from "@/lib/revalidate-notes";
import { getModulePathsForIntern, type CohortPath, type ModulePaths } from "@/db/queries/modules";
import { attemptPct, moduleStates, type ModuleNode } from "@/lib/modules";
import { submitAttemptSchema, type SubmitAttemptInput } from "@/lib/validations";

/** Passing or failing a module's quiz, as the form shows it. */
export type AttemptResult = {
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  passPct: number;
  bestPct: number;
  bestPassed: boolean;
};

/** The quiz plus the cohort it gates, resolved before anything is written. */
type AttemptCtx = {
  assessmentId: string;
  passPct: number;
  noteId: string;
  noteTitle: string;
  groupId: string;
  questions: {
    id: string;
    points: number;
    /** Every option on this question, with the answer key. */
    options: Map<string, boolean>;
  }[];
};

/**
 * Shared gate for sitting a quiz. Mirrors `withGradingAuth`: the resource
 * (`{ kind: "assessment", groupId }`) can only be built after loading the
 * assessment, so we validate, load, then run the one central `authorize()`.
 *
 * **Locking is enforced here, not in the UI.** A locked module's quiz is
 * refused server-side by re-deriving the intern's path, so POSTing an
 * assessment id directly — bypassing the page entirely — gets a refusal rather
 * than a score.
 *
 * The answer key is loaded here and never returned to the client.
 */
async function withAttemptAuth<TResult>(
  action: Action,
  input: unknown,
  run: (
    data: SubmitAttemptInput,
    userId: string,
    ctx: AttemptCtx,
  ) => Promise<ActionResult<TResult>>,
): Promise<ActionResult<TResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("You're not signed in.");

  const parsed = submitAttemptSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }
  const data = parsed.data;

  const quiz = await db.query.assessments.findFirst({
    where: eq(assessments.id, data.assessmentId),
    columns: { id: true, passPct: true },
    with: {
      note: { columns: { id: true, title: true, groupId: true } },
      questions: {
        columns: { id: true, points: true },
        with: { options: { columns: { id: true, isCorrect: true } } },
      },
    },
  });
  if (!quiz?.note) return fail("That assessment no longer exists.");
  // A global note sits outside every path, so it can never carry a gating quiz.
  if (quiz.note.groupId == null) return fail("This assessment isn't part of a cohort.");

  const groupId = quiz.note.groupId;

  try {
    await authorize(user, action, { kind: "assessment", groupId });
  } catch (e) {
    if (e instanceof ForbiddenError) return fail(e.message);
    throw e;
  }

  if (quiz.questions.length === 0) {
    return fail("This assessment has no questions yet.");
  }

  const ctx: AttemptCtx = {
    assessmentId: quiz.id,
    passPct: quiz.passPct,
    noteId: quiz.note.id,
    noteTitle: quiz.note.title,
    groupId,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      points: q.points,
      options: new Map(q.options.map((o) => [o.id, o.isCorrect])),
    })),
  };

  return run(data, user.id, ctx);
}

/** The module the intern is on, and whether it is open. */
function findModule(paths: ModulePaths, noteId: string, groupId: string) {
  const cohort = paths.cohorts.find((c) => c.group.id === groupId);
  // Not `module` — that identifier is reserved by Next's bundler.
  const item = cohort?.modules.find((m) => m.id === noteId);
  return item ? { cohort, item } : null;
}

/** Recompute the cohort's states, for finding what a pass just opened. */
function statesOf(cohort: CohortPath) {
  const nodes: ModuleNode[] = cohort.modules.map((m) => ({
    noteId: m.id,
    position: m.position,
    assessmentId: m.assessmentId,
    bestPct: m.bestPct,
    passed: m.passed,
  }));
  return moduleStates(nodes);
}

/**
 * Submit a sitting and score it.
 *
 * Scoring is entirely server-side: the client's answers are matched against the
 * loaded answer key, and an option that doesn't belong to the question it is
 * claimed for simply doesn't match. The submitted score is never read.
 */
export async function submitAttempt(
  input: SubmitAttemptInput,
): Promise<ActionResult<AttemptResult>> {
  return withAttemptAuth("create", input, async (data, userId, ctx) => {
    // --- the module must actually be open ---------------------------------
    const before = await getModulePathsForIntern(userId);
    const found = findModule(before, ctx.noteId, ctx.groupId);
    if (!found) return fail("That module isn't part of your cohorts.");
    if (found.item.state === "locked") {
      return fail("Finish the earlier modules before taking this one.");
    }

    // --- score it ---------------------------------------------------------
    // One answer per question; a duplicate is ignored rather than allowed to
    // stack. An option id that isn't on its question scores nothing.
    const picked = new Map<string, string | null>();
    for (const a of data.answers) {
      if (!picked.has(a.questionId)) picked.set(a.questionId, a.optionId);
    }

    let score = 0;
    let total = 0;
    const rows: { questionId: string; optionId: string | null }[] = [];
    for (const q of ctx.questions) {
      total += q.points;
      const optionId = picked.get(q.id) ?? null;
      // `options` is keyed by this question's own option ids, so a foreign
      // option id can never be "correct" here.
      const isCorrect = optionId != null && q.options.get(optionId) === true;
      if (isCorrect) score += q.points;
      rows.push({ questionId: q.id, optionId });
    }

    const pct = attemptPct(score, total);
    const passed = pct >= ctx.passPct;

    // A pass is only "first" if no earlier sitting already cleared the bar —
    // that's what gates the notification, so retakes stay quiet.
    const priorPass = await db.query.assessmentAttempts.findFirst({
      where: and(
        eq(assessmentAttempts.assessmentId, ctx.assessmentId),
        eq(assessmentAttempts.internId, userId),
        eq(assessmentAttempts.passed, true),
      ),
      columns: { id: true },
    });
    const firstPass = passed && !priorPass;

    // Captured before the write: `recordScoringMilestones` compares against it
    // to detect a level crossing. Sampled here rather than at grade time because
    // a quiz alone can carry an intern over a threshold.
    const previousLevel = await currentLevel(userId);

    await db.transaction(async (tx) => {
      const [attempt] = await tx
        .insert(assessmentAttempts)
        .values({
          assessmentId: ctx.assessmentId,
          internId: userId,
          score,
          // Snapshotted, so editing question points later can't rewrite history.
          total,
          passed,
        })
        .returning({ id: assessmentAttempts.id });
      await tx.insert(assessmentAnswers).values(
        rows.map((r) => ({
          attemptId: attempt.id,
          questionId: r.questionId,
          optionId: r.optionId,
        })),
      );
    });

    // A quiz score lands in the same cumulative pool as a grade, so it can earn
    // badges or cross a level exactly as a grade can. Runs on every sitting, not
    // just a first pass — a retake that raises the best score moves the pool too.
    await recordScoringMilestones({
      intern: { id: userId, email: null, name: null },
      previousLevel,
    });

    revalidatePath(`/notes/${ctx.noteId}`);
    revalidateNoteViews(ctx.groupId);

    // --- tell them what changed -------------------------------------------
    // Best-effort, and after the write: a notification failure must never
    // undo a score the intern earned.
    if (firstPass) {
      await notify([{ id: userId, email: null, name: null }], {
        type: "assessment_passed",
        payload: { noteId: ctx.noteId, title: ctx.noteTitle, score, total },
      });

      // Which module did that just open? Compare the path before and after.
      const after = await getModulePathsForIntern(userId);
      const afterCohort = after.cohorts.find((c) => c.group.id === ctx.groupId);
      if (found.cohort && afterCohort) {
        const wasStates = statesOf(found.cohort);
        const nowStates = statesOf(afterCohort);
        const openedIndex = found.cohort.modules.findIndex(
          (m, i) => wasStates[i] === "locked" && nowStates[i] === "unlocked",
        );
        const opened = openedIndex >= 0 ? found.cohort.modules[openedIndex] : null;
        if (opened) {
          await notify([{ id: userId, email: null, name: null }], {
            type: "module_unlocked",
            payload: { noteId: opened.id, title: opened.title },
          });
        }
      }
    }

    // The best score is what counts, so report it alongside this sitting.
    const best = await db.query.assessmentAttempts.findMany({
      where: and(
        eq(assessmentAttempts.assessmentId, ctx.assessmentId),
        eq(assessmentAttempts.internId, userId),
      ),
      columns: { score: true, total: true },
    });
    const bestPct = best.reduce(
      (max, a) => Math.max(max, attemptPct(a.score, a.total)),
      0,
    );

    return ok(
      {
        score,
        total,
        pct,
        passed,
        passPct: ctx.passPct,
        bestPct,
        bestPassed: bestPct >= ctx.passPct,
      },
      passed ? `Passed — ${pct}%` : `Scored ${pct}% — ${ctx.passPct}% needed`,
    );
  });
}
