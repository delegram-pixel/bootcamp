import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentAttempts,
  assessmentQuestions,
  assessments,
  groups,
  memberships,
  notes,
} from "@/db/schema";
import { loadQuizzes } from "@/db/queries/scoring";
import { attemptPct, isBetterAttempt, passedAt, type AttemptLike } from "@/lib/modules";

/**
 * Admin-facing views of who has sat each assessment.
 *
 * The question a mentor has is "who has taken this quiz, what did they score,
 * and who hasn't?" — and the third part is the one nothing else answers. A
 * never-attempted quiz is simply absent from every scorecard, so it can't be
 * seen as missing anywhere. Here the roster starts from *membership*, not from
 * attempts, so a blank is a row rather than a gap.
 *
 * Authorization is the page's job (`requireAdmin`), matching the other
 * `queries/*` modules — these functions assume an admin already asked.
 */

export type AssessmentSummary = {
  assessmentId: string;
  noteId: string;
  noteTitle: string;
  groupId: string;
  groupName: string;
  questionCount: number;
  /** Sum of the question points — the percentage denominator. */
  total: number;
  passPct: number;
  internCount: number;
  /** Interns with at least one sitting. */
  takenCount: number;
  /** Interns whose *best* sitting cleared the pass mark. */
  passedCount: number;
};

export type RosterRow = {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  /** 0 means never sat it. */
  attempts: number;
  bestScore: number | null;
  bestTotal: number | null;
  bestPct: number | null;
  passed: boolean;
  lastAttemptAt: Date | null;
};

export type AssessmentRoster = {
  assessment: {
    id: string;
    noteId: string;
    noteTitle: string;
    groupId: string;
    groupName: string;
    passPct: number;
    total: number;
    questionCount: number;
  };
  /** Every intern in the cohort — takers by best %, then non-takers by name. */
  rows: RosterRow[];
  takenCount: number;
  passedCount: number;
};

/** One intern's history on one quiz, folded to what a roster needs. */
type AttemptSummary = {
  attempts: number;
  best: AttemptLike;
  lastAttemptAt: Date;
};

/**
 * Every sitting for the given (intern, quiz) pairs, folded to per-pair totals.
 *
 * `loadBestAttempts` does the same reduction but keeps *only* the best, and a
 * roster wants the attempt count and the last-sat date too. Both walk the same
 * rows; this one just keeps more of what it sees. One query for the whole
 * board — no per-intern N+1, same shape as its sibling.
 */
async function loadAttemptSummaries(
  assessmentIds: string[],
  internIds: string[],
): Promise<Map<string, AttemptSummary>> {
  const out = new Map<string, AttemptSummary>();
  if (assessmentIds.length === 0 || internIds.length === 0) return out;

  const rows = await db.query.assessmentAttempts.findMany({
    where: and(
      inArray(assessmentAttempts.assessmentId, assessmentIds),
      inArray(assessmentAttempts.internId, internIds),
    ),
    columns: {
      assessmentId: true,
      internId: true,
      score: true,
      total: true,
      submittedAt: true,
    },
  });

  for (const r of rows) {
    const key = `${r.internId}:${r.assessmentId}`;
    const cur = out.get(key);
    if (!cur) {
      out.set(key, { attempts: 1, best: r, lastAttemptAt: r.submittedAt });
      continue;
    }
    cur.attempts += 1;
    // Same "best" rule the gate and the grade pool use — if these disagreed an
    // intern could be shown a passed module whose score counted differently.
    if (isBetterAttempt(r, cur.best)) cur.best = r;
    if (r.submittedAt > cur.lastAttemptAt) cur.lastAttemptAt = r.submittedAt;
  }
  return out;
}

/**
 * Everything about a set of quizzes that `loadQuizzes` doesn't carry: the pass
 * mark, the note title, the cohort, and how many questions there are.
 *
 * Question counts are tallied in memory rather than with SQL `count()` — the
 * rows are a handful per quiz, and it sidesteps `bigint` arriving as a string.
 */
async function loadQuizMeta(assessmentIds: string[]) {
  if (assessmentIds.length === 0) return new Map<string, QuizMeta>();

  const [details, questionRows] = await Promise.all([
    db
      .select({
        id: assessments.id,
        passPct: assessments.passPct,
        noteTitle: notes.title,
        groupId: notes.groupId,
        groupName: groups.name,
      })
      .from(assessments)
      .innerJoin(notes, eq(notes.id, assessments.noteId))
      .innerJoin(groups, eq(groups.id, notes.groupId))
      .where(inArray(assessments.id, assessmentIds)),
    db
      .select({ assessmentId: assessmentQuestions.assessmentId })
      .from(assessmentQuestions)
      .where(inArray(assessmentQuestions.assessmentId, assessmentIds)),
  ]);

  const counts = new Map<string, number>();
  for (const q of questionRows) {
    counts.set(q.assessmentId, (counts.get(q.assessmentId) ?? 0) + 1);
  }

  return new Map<string, QuizMeta>(
    details.map((d) => [
      d.id,
      { ...d, questionCount: counts.get(d.id) ?? 0 },
    ]),
  );
}

type QuizMeta = {
  id: string;
  passPct: number;
  noteTitle: string;
  groupId: string | null;
  groupName: string;
  questionCount: number;
};

/**
 * Every quiz across every cohort, with how many interns have sat it and how
 * many passed. Drives the index page; one row per quiz, no per-quiz query.
 */
export async function getAdminAssessments(): Promise<AssessmentSummary[]> {
  const allGroups = await db.query.groups.findMany({
    orderBy: [asc(groups.name)],
    columns: { id: true },
    with: {
      memberships: {
        where: eq(memberships.roleInGroup, "intern"),
        columns: { userId: true },
      },
    },
  });
  if (allGroups.length === 0) return [];

  // `loadQuizzes` owns the definition of a usable quiz (a zero-question one is
  // dropped, so it can't put an unwinnable zero in the grade denominator).
  // Reusing it keeps this page agreeing with the grade and the gate.
  const quizzes = await loadQuizzes(allGroups.map((g) => g.id));
  if (quizzes.length === 0) return [];

  const internsByGroup = new Map(
    allGroups.map((g) => [g.id, g.memberships.map((m) => m.userId)]),
  );
  const allInternIds = [...new Set([...internsByGroup.values()].flat())];

  const [meta, summaries] = await Promise.all([
    loadQuizMeta(quizzes.map((q) => q.assessmentId)),
    loadAttemptSummaries(
      quizzes.map((q) => q.assessmentId),
      allInternIds,
    ),
  ]);

  const out: AssessmentSummary[] = [];
  for (const quiz of quizzes) {
    const m = meta.get(quiz.assessmentId);
    if (!m) continue;
    const internIds = internsByGroup.get(quiz.groupId) ?? [];

    let takenCount = 0;
    let passedCount = 0;
    for (const internId of internIds) {
      const s = summaries.get(`${internId}:${quiz.assessmentId}`);
      if (!s) continue;
      takenCount++;
      if (passedAt(attemptPct(s.best.score, s.best.total), m.passPct)) passedCount++;
    }

    out.push({
      assessmentId: quiz.assessmentId,
      noteId: quiz.noteId,
      noteTitle: m.noteTitle,
      groupId: quiz.groupId,
      groupName: m.groupName,
      questionCount: m.questionCount,
      total: quiz.total,
      passPct: m.passPct,
      internCount: internIds.length,
      takenCount,
      passedCount,
    });
  }
  return out;
}

/**
 * One quiz, with every intern in its cohort whether they sat it or not.
 * Returns null for an unknown id, or one on a global note — a global note has
 * no cohort to roster, so it can't carry a gating quiz in the first place.
 */
export async function getAdminAssessmentRoster(
  assessmentId: string,
): Promise<AssessmentRoster | null> {
  const meta = await loadQuizMeta([assessmentId]);
  const quiz = meta.get(assessmentId);
  if (!quiz || quiz.groupId == null) return null;

  const quizzes = await loadQuizzes([quiz.groupId]);
  const asQuiz = quizzes.find((q) => q.assessmentId === assessmentId);
  if (!asQuiz) return null; // not usable — no questions, so nothing to grade

  const interns = await db.query.memberships.findMany({
    where: and(
      eq(memberships.groupId, quiz.groupId),
      eq(memberships.roleInGroup, "intern"),
    ),
    columns: { userId: true },
    with: { user: { columns: { id: true, name: true, email: true, image: true } } },
  });

  const summaries = await loadAttemptSummaries(
    [assessmentId],
    interns.map((m) => m.userId),
  );

  let takenCount = 0;
  let passedCount = 0;
  const rows: RosterRow[] = interns.map((m) => {
    const s = summaries.get(`${m.userId}:${assessmentId}`) ?? null;
    const bestPct = s ? attemptPct(s.best.score, s.best.total) : null;
    const passed = passedAt(bestPct, quiz.passPct);
    if (s) takenCount++;
    if (passed) passedCount++;
    return {
      userId: m.userId,
      name: m.user?.name ?? null,
      email: m.user?.email ?? "",
      image: m.user?.image ?? null,
      attempts: s?.attempts ?? 0,
      bestScore: s?.best.score ?? null,
      bestTotal: s?.best.total ?? null,
      bestPct,
      passed,
      lastAttemptAt: s?.lastAttemptAt ?? null,
    };
  });

  // Takers first, best score down. Non-takers collect at the end, alphabetically
  // — "who hasn't sat it" is the question this page exists to answer, so they
  // read as a group instead of being scattered through the list.
  const label = (r: RosterRow) => (r.name ?? r.email).toLowerCase();
  rows.sort((a, b) => {
    if (a.attempts === 0 && b.attempts === 0) return label(a).localeCompare(label(b));
    if (a.attempts === 0) return 1;
    if (b.attempts === 0) return -1;
    if (a.bestPct !== b.bestPct) return (b.bestPct ?? 0) - (a.bestPct ?? 0);
    return label(a).localeCompare(label(b));
  });

  return {
    assessment: {
      id: assessmentId,
      noteId: asQuiz.noteId,
      noteTitle: quiz.noteTitle,
      groupId: quiz.groupId,
      groupName: quiz.groupName,
      passPct: quiz.passPct,
      total: asQuiz.total,
      questionCount: quiz.questionCount,
    },
    rows,
    takenCount,
    passedCount,
  };
}
