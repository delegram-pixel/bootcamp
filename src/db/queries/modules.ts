import "server-only";

import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentAttempts,
  assessmentOptions,
  assessmentQuestions,
  memberships,
  noteAttachments,
  notes,
  type NoteAttachment,
} from "@/db/schema";
import {
  attemptPct,
  bestByAssessment,
  moduleStates,
  passedAt,
  type AttemptLike,
  type ModuleNode,
  type ModuleState,
} from "@/lib/modules";

/** Default pass mark, mirrored from the `assessment.pass_pct` column default. */
const DEFAULT_PASS_PCT = 70;

/** One sitting, flattened for the best-of reduction. */
type AttemptRow = AttemptLike;

/** A note reduced to what a gated path needs to render and reason about. */
export type ModuleListItem = {
  id: string;
  groupId: string | null;
  title: string;
  topic: string | null;
  weekNumber: number | null;
  position: number;
  group: { id: string; name: string } | null;
  /** null when the module has no usable quiz (absent, or zero questions). */
  assessmentId: string | null;
  passPct: number | null;
  /** Sum of the quiz's question points. */
  quizTotal: number | null;
  questionCount: number;
  /** The best sitting's numbers, or null when never attempted. */
  bestScore: number | null;
  bestTotal: number | null;
  bestPct: number | null;
  attempted: boolean;
  passed: boolean;
  /** Resources a mentor attached — links, files, images. */
  attachments: NoteAttachment[];
  /**
   * Gating state. Meaningless (always "unlocked") for reference notes, which
   * sit outside every path and are never gated.
   */
  state: ModuleState;
};

export type CohortPath = {
  group: { id: string; name: string };
  modules: ModuleListItem[];
  /** Modules passed in this cohort, and how many there are. */
  passed: number;
  total: number;
};

export type ModulePaths = {
  /** One ordered, gated path per cohort the intern belongs to. */
  cohorts: CohortPath[];
  /** Global notes — shared reference reading, never gated. */
  reference: ModuleListItem[];
};

/**
 * Every module the intern can see, as one ordered path per cohort. A note with
 * no quiz can never gate, but it is still locked while an earlier gating module
 * in its cohort is unpassed.
 */
export async function getModulePathsForIntern(userId: string): Promise<ModulePaths> {
  const mine = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    columns: { groupId: true },
    with: { group: { columns: { id: true, name: true } } },
  });
  const groups = mine
    .map((m) => m.group)
    .filter((g): g is { id: string; name: string } => g != null);
  const groupIds = groups.map((g) => g.id);

  const rows = await db.query.notes.findMany({
    where: groupIds.length
      ? or(isNull(notes.groupId), inArray(notes.groupId, groupIds))
      : isNull(notes.groupId),
    columns: {
      id: true,
      groupId: true,
      title: true,
      topic: true,
      weekNumber: true,
      position: true,
    },
    with: {
      group: { columns: { id: true, name: true } },
      assessment: {
        columns: { id: true, passPct: true },
        with: { questions: { columns: { points: true } } },
      },
      // Carried on the list item so an intern sees a module's resources without
      // opening it — the admin's notes list has always shown them inline, and a
      // link only the author can see is a link nobody uses.
      attachments: { orderBy: [asc(noteAttachments.createdAt)] },
    },
    // Position is the path order; createdAt breaks ties so two notes sharing a
    // position still have one stable sequence.
    orderBy: [asc(notes.position), asc(notes.createdAt)],
  });

  const best = await loadBestAttempts(
    userId,
    rows.map((r) => r.assessment?.id).filter((id): id is string => id != null),
  );

  const toItem = (
    row: (typeof rows)[number],
    state: ModuleState,
  ): ModuleListItem => {
    const quiz = usableQuiz(row.assessment);
    const attempt = quiz ? (best.get(quiz.id) ?? null) : null;
    const bestPct = attempt ? attemptPct(attempt.score, attempt.total) : null;
    return {
      id: row.id,
      groupId: row.groupId,
      title: row.title,
      topic: row.topic,
      weekNumber: row.weekNumber,
      position: row.position,
      group: row.group,
      attachments: row.attachments,
      assessmentId: quiz?.id ?? null,
      passPct: quiz?.passPct ?? null,
      quizTotal: quiz?.total ?? null,
      questionCount: quiz?.questionCount ?? 0,
      bestScore: attempt?.score ?? null,
      bestTotal: attempt?.total ?? null,
      bestPct,
      attempted: attempt != null,
      passed: quiz ? passedAt(bestPct, quiz.passPct) : false,
      state,
    };
  };

  const cohorts: CohortPath[] = groups.map((group) => {
    const cohortRows = rows.filter((r) => r.groupId === group.id);
    const nodes: ModuleNode[] = cohortRows.map((r) => {
      const quiz = usableQuiz(r.assessment);
      const attempt = quiz ? (best.get(quiz.id) ?? null) : null;
      const bestPct = attempt ? attemptPct(attempt.score, attempt.total) : null;
      return {
        noteId: r.id,
        position: r.position,
        assessmentId: quiz?.id ?? null,
        bestPct,
        passed: quiz ? passedAt(bestPct, quiz.passPct) : false,
      };
    });
    const states = moduleStates(nodes);
    const modules = cohortRows.map((r, i) => toItem(r, states[i]));
    return {
      group,
      modules,
      passed: modules.filter((m) => m.passed).length,
      total: modules.length,
    };
  });

  // Global notes are reference material: always open, never part of a path.
  const reference = rows
    .filter((r) => r.groupId == null)
    .map((r) => toItem(r, "unlocked"));

  return { cohorts, reference };
}

/**
 * A quiz only counts if it actually has questions — an assessment with none has
 * nothing to score, so we treat it as absent rather than as a module that can
 * never be passed (which would deadlock the whole path behind it).
 */
function usableQuiz(
  assessment:
    | { id: string; passPct: number; questions: { points: number }[] }
    | null
    | undefined,
): { id: string; passPct: number; total: number; questionCount: number } | null {
  if (!assessment) return null;
  const total = assessment.questions.reduce((sum, q) => sum + q.points, 0);
  if (total <= 0) return null;
  return {
    id: assessment.id,
    passPct: assessment.passPct ?? DEFAULT_PASS_PCT,
    total,
    questionCount: assessment.questions.length,
  };
}

/** The intern's best sitting per assessment, in one query. */
async function loadBestAttempts(
  userId: string,
  assessmentIds: string[],
): Promise<Map<string, AttemptRow>> {
  if (assessmentIds.length === 0) return new Map();
  const rows = await db.query.assessmentAttempts.findMany({
    where: and(
      eq(assessmentAttempts.internId, userId),
      inArray(assessmentAttempts.assessmentId, assessmentIds),
    ),
    columns: {
      assessmentId: true,
      score: true,
      total: true,
      submittedAt: true,
    },
  });
  return bestByAssessment(rows);
}

/* ------------------------------------------------------ one module */

export type ModuleDetail = {
  note: {
    id: string;
    groupId: string | null;
    title: string;
    bodyMd: string;
    topic: string | null;
    weekNumber: number | null;
    position: number;
    createdAt: Date;
    group: { id: string; name: string } | null;
    attachments: (typeof noteAttachments.$inferSelect)[];
  };
  /** Questions and options only — `isCorrect` never leaves the server. */
  assessment: {
    id: string;
    passPct: number;
    total: number;
    questions: {
      id: string;
      prompt: string;
      points: number;
      options: { id: string; label: string }[];
    }[];
  } | null;
  bestScore: number | null;
  bestTotal: number | null;
  bestPct: number | null;
  attempted: boolean;
  passed: boolean;
  state: ModuleState;
  /**
   * The module after this one in the cohort's path, so the reader can move on
   * without going back to the list. Null for a global note, or at the end.
   */
  next: { id: string; title: string; state: ModuleState } | null;
};

/**
 * One module for an intern, **gated**: returns null (which the page turns into
 * `notFound()`) when the module is locked or isn't in one of the intern's
 * cohorts. Locking is enforced here, in the loader — not by hiding a link — so
 * a locked module is unreachable by URL, the same way
 * `getAssignmentForIntern` enforces cohort membership.
 *
 * Global notes are reference material and are always readable.
 */
export async function getModuleForIntern(
  userId: string,
  noteId: string,
): Promise<ModuleDetail | null> {
  const row = await db.query.notes.findFirst({
    where: eq(notes.id, noteId),
    with: {
      group: { columns: { id: true, name: true } },
      attachments: { orderBy: [asc(noteAttachments.createdAt)] },
      assessment: {
        columns: { id: true, passPct: true },
        with: {
          questions: {
            columns: { id: true, prompt: true, points: true },
            orderBy: [asc(assessmentQuestions.order)],
            with: {
              options: {
                // `isCorrect` is deliberately not selected — the answer key
                // must never reach the client before an attempt is scored.
                columns: { id: true, label: true },
                orderBy: [asc(assessmentOptions.order)],
              },
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  // Global note → reference reading, no gate to clear.
  if (row.groupId == null) {
    return {
      note: row,
      assessment: null,
      bestScore: null,
      bestTotal: null,
      bestPct: null,
      attempted: false,
      passed: false,
      state: "unlocked",
      next: null,
    };
  }

  // Cohort note → the intern must belong to the cohort, and the module must be
  // open in that cohort's path.
  const member = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.groupId, row.groupId)),
    columns: { id: true },
  });
  if (!member) return null;

  const path = await getModulePathsForIntern(userId);
  const cohort = path.cohorts.find((c) => c.group.id === row.groupId);
  const index = cohort?.modules.findIndex((m) => m.id === noteId) ?? -1;
  const item = index >= 0 ? cohort!.modules[index] : undefined;
  if (!item || item.state === "locked") return null;

  const sibling = index >= 0 ? cohort!.modules[index + 1] : undefined;
  const questions = row.assessment?.questions ?? [];

  return {
    note: row,
    assessment: item.assessmentId
      ? {
          id: row.assessment!.id,
          passPct: item.passPct ?? DEFAULT_PASS_PCT,
          total: item.quizTotal ?? 0,
          questions,
        }
      : null,
    bestScore: item.bestScore,
    bestTotal: item.bestTotal,
    bestPct: item.bestPct,
    attempted: item.attempted,
    passed: item.passed,
    state: item.state,
    next: sibling
      ? { id: sibling.id, title: sibling.title, state: sibling.state }
      : null,
  };
}
