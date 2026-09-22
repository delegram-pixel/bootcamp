import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentAttempts,
  assessmentQuestions,
  assessments,
  assignments,
  groups,
  memberships,
  notes,
  submissions,
} from "@/db/schema";
import {
  assignmentTotal,
  countOverdue,
  evaluateBadges,
  isAtRisk,
  levelInfo,
  overallGrade,
  progress,
  quizRowsFor,
  totalXp,
  weeklyStreak,
  type BadgeKey,
  type LevelInfo,
  type OverallGrade,
  type Progress,
  type ScorecardRow,
} from "@/lib/scoring";
import { isBetterAttempt, type AttemptLike } from "@/lib/modules";
import { type SubmissionStatus } from "@/lib/submission-status";

export type InternScorecard = {
  grade: OverallGrade;
  progress: Progress;
  xp: number;
  level: LevelInfo;
  streakWeeks: number;
  earnedBadges: BadgeKey[];
};

/** Extras the badge/streak layer needs that a bare `ScorecardRow[]` can't carry. */
type ScorecardExtras = {
  /** Every non-null submission date, for the weekly streak. */
  submittedDates: Date[];
  /** Count of distinct submission-item kinds used, for the polyglot badge. */
  itemKindCount: number;
};

function buildScorecard(rows: ScorecardRow[], extras: ScorecardExtras): InternScorecard {
  const grade = overallGrade(rows);
  const prog = progress(rows);
  const xp = totalXp(rows);
  const streakWeeks = weeklyStreak(extras.submittedDates);
  const hasPerfectScore = rows.some(
    (r) =>
      r.status === "graded" &&
      r.score != null &&
      r.total != null &&
      r.total > 0 &&
      r.score >= r.total,
  );
  const earnedBadges = evaluateBadges({
    grade,
    progress: prog,
    xp,
    streakWeeks,
    itemKindCount: extras.itemKindCount,
    hasPerfectScore,
  });
  return { grade, progress: prog, xp, level: levelInfo(xp), streakWeeks, earnedBadges };
}

const EMPTY_EXTRAS: ScorecardExtras = { submittedDates: [], itemKindCount: 0 };

/* ------------------------------------------------------------- quizzes */

/**
 * A cohort quiz reduced to what a standing needs. `total` is the sum of its
 * question points — the percentage denominator, and the contribution to the
 * cumulative grade pool's `possible`.
 */
export type QuizLite = {
  assessmentId: string;
  noteId: string;
  groupId: string;
  total: number;
};

/** The best sitting for one (intern, quiz) pair. */
type QuizAttemptLite = AttemptLike;

/**
 * Every usable quiz on a note in the given cohorts. A quiz with no questions is
 * dropped — it has nothing to score, and counting it would put an unwinnable
 * zero in the intern's grade denominator. Mirrors `usableQuiz` in
 * `queries/modules.ts` so the grade and the gate agree on what counts as a quiz.
 */
export async function loadQuizzes(groupIds: string[]): Promise<QuizLite[]> {
  if (groupIds.length === 0) return [];
  const rows = await db
    .select({
      assessmentId: assessments.id,
      noteId: assessments.noteId,
      groupId: notes.groupId,
      points: assessmentQuestions.points,
    })
    .from(assessments)
    .innerJoin(notes, eq(notes.id, assessments.noteId))
    .innerJoin(
      assessmentQuestions,
      eq(assessmentQuestions.assessmentId, assessments.id),
    )
    .where(inArray(notes.groupId, groupIds));

  const byId = new Map<string, QuizLite>();
  for (const r of rows) {
    if (r.groupId == null) continue; // global notes never carry a gating quiz
    const cur = byId.get(r.assessmentId);
    if (cur) cur.total += r.points;
    else
      byId.set(r.assessmentId, {
        assessmentId: r.assessmentId,
        noteId: r.noteId,
        groupId: r.groupId,
        total: r.points,
      });
  }
  return [...byId.values()];
}

/**
 * The best sitting per (intern, quiz), indexed `internId:assessmentId`. One
 * query for the whole board — no per-intern N+1, same shape as `loadSubmissions`.
 */
async function loadBestAttempts(
  assessmentIds: string[],
  internIds: string[],
): Promise<Map<string, QuizAttemptLite>> {
  if (assessmentIds.length === 0 || internIds.length === 0) return new Map();
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
  const best = new Map<string, QuizAttemptLite>();
  for (const r of rows) {
    const key = `${r.internId}:${r.assessmentId}`;
    const cur = best.get(key);
    if (!cur || isBetterAttempt(r, cur)) best.set(key, r);
  }
  return best;
}

/**
 * One intern's standing across every published assignment in their groups: the
 * cumulative grade, progress buckets, and XP/level. Gathers the raw rows here
 * (server-only, DB) and hands them to the pure `scoring` module to compute.
 * Returns a zeroed scorecard when the intern has no groups or assignments.
 */
export async function getInternScorecard(userId: string): Promise<InternScorecard> {
  const mine = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    columns: { groupId: true },
  });
  const groupIds = mine.map((m) => m.groupId);
  if (groupIds.length === 0) return buildScorecard([], EMPTY_EXTRAS);

  const asgs = await db.query.assignments.findMany({
    where: and(
      inArray(assignments.groupId, groupIds),
      eq(assignments.status, "published"),
    ),
    columns: { id: true, dueAt: true, points: true },
    with: { rubric: { with: { criteria: { columns: { maxPoints: true } } } } },
  });

  // Assignments and quizzes are independent sources of graded work, so neither
  // may short-circuit the other — an intern with quizzes but no published
  // assignments still has a standing.
  const quizzes = await loadQuizzes(groupIds);

  const subs = asgs.length
    ? await db.query.submissions.findMany({
        where: and(
          eq(submissions.internId, userId),
          inArray(
            submissions.assignmentId,
            asgs.map((a) => a.id),
          ),
        ),
        columns: { assignmentId: true, status: true, submittedAt: true },
        with: {
          grade: { columns: { score: true } },
          items: { columns: { kind: true } },
        },
      })
    : [];

  const attempts = await loadBestAttempts(
    quizzes.map((q) => q.assessmentId),
    [userId],
  );
  const byAssignment = new Map(subs.map((s) => [s.assignmentId, s]));

  const rows: ScorecardRow[] = asgs.map((a) => {
    const sub = byAssignment.get(a.id);
    const rubricSum = a.rubric
      ? a.rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0)
      : null;
    return {
      status: sub?.status ?? null,
      score: sub?.grade?.score ?? null,
      total: assignmentTotal(a.points, rubricSum),
      dueAt: a.dueAt,
      submittedAt: sub?.submittedAt ?? null,
    };
  });
  rows.push(...quizRowsFor(userId, quizzes, attempts));

  // Streak looks at every submission date — including quiz sittings, which are
  // just as much "work done this week" as a task submission. Polyglot still
  // counts only submission formats.
  const submittedDates = [
    ...subs.map((s) => s.submittedAt).filter((d): d is Date => d != null),
    ...[...attempts.values()].map((a) => a.submittedAt),
  ];
  const kinds = new Set<string>();
  for (const s of subs) for (const item of s.items) kinds.add(item.kind);

  return buildScorecard(rows, { submittedDates, itemKindCount: kinds.size });
}

/* --------------------------------------------------------- leaderboards */

/**
 * A published assignment reduced to what a standing needs: its total (rubric
 * sum or flat points, precomputed once) and due date. `groupId` is kept so the
 * admin view can bucket assignments by cohort from a single query.
 */
type AssignmentLite = {
  id: string;
  groupId: string;
  dueAt: Date | null;
  total: number | null;
};

/** One intern's submission for one assignment, flattened for row-building. */
type SubLite = {
  status: SubmissionStatus;
  submittedAt: Date | null;
  score: number | null;
};

/** One person's rank on a board — everything the leaderboard/standings UI needs. */
export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  xp: number;
  level: number;
  gradePct: number | null;
  gradedCount: number;
  /** True for the signed-in viewer's own row, so the UI can highlight it. */
  isViewer: boolean;
};

/** A leaderboard entry plus the admin-only at-risk signals. */
export type StandingEntry = LeaderboardEntry & { overdue: number; atRisk: boolean };

export type CohortLeaderboard = {
  group: { id: string; name: string };
  entries: LeaderboardEntry[];
};

export type CohortStanding = {
  groupId: string;
  groupName: string;
  status: "active" | "archived";
  internCount: number;
  atRiskCount: number;
  entries: StandingEntry[];
};

/** All published assignments across the given groups, with totals precomputed. */
async function loadPublishedAssignments(groupIds: string[]): Promise<AssignmentLite[]> {
  if (groupIds.length === 0) return [];
  const rows = await db.query.assignments.findMany({
    where: and(
      inArray(assignments.groupId, groupIds),
      eq(assignments.status, "published"),
    ),
    columns: { id: true, groupId: true, dueAt: true, points: true },
    with: { rubric: { with: { criteria: { columns: { maxPoints: true } } } } },
  });
  return rows.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    dueAt: a.dueAt,
    total: assignmentTotal(
      a.points,
      a.rubric ? a.rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0) : null,
    ),
  }));
}

/**
 * Every submission for the given assignments by the given interns, indexed by
 * `internId:assignmentId`. One query for the whole board — no per-intern N+1.
 */
async function loadSubmissions(
  assignmentIds: string[],
  internIds: string[],
): Promise<Map<string, SubLite>> {
  if (assignmentIds.length === 0 || internIds.length === 0) return new Map();
  const rows = await db.query.submissions.findMany({
    where: and(
      inArray(submissions.assignmentId, assignmentIds),
      inArray(submissions.internId, internIds),
    ),
    columns: { assignmentId: true, internId: true, status: true, submittedAt: true },
    with: { grade: { columns: { score: true } } },
  });
  return new Map(
    rows.map((s) => [
      `${s.internId}:${s.assignmentId}`,
      { status: s.status, submittedAt: s.submittedAt, score: s.grade?.score ?? null },
    ]),
  );
}

/** Build one intern's scorecard rows against a fixed set of work. */
function scorecardRowsFor(
  internId: string,
  asgs: AssignmentLite[],
  subs: Map<string, SubLite>,
  quizzes: QuizLite[],
  attempts: Map<string, QuizAttemptLite>,
): ScorecardRow[] {
  const rows: ScorecardRow[] = asgs.map((a) => {
    const sub = subs.get(`${internId}:${a.id}`);
    return {
      status: sub?.status ?? null,
      score: sub?.score ?? null,
      total: a.total,
      dueAt: a.dueAt,
      submittedAt: sub?.submittedAt ?? null,
    };
  });
  rows.push(...quizRowsFor(internId, quizzes, attempts));
  return rows;
}

/**
 * Rank by XP (rewards volume, not a lucky 1/1 = 100%), then grade %, then name.
 * Ties share a rank, competition-style (1, 2, 2, 4).
 */
function rankByXp<
  T extends { xp: number; gradePct: number | null; name: string | null; email: string },
>(entries: T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    const ap = a.gradePct ?? -1;
    const bp = b.gradePct ?? -1;
    if (bp !== ap) return bp - ap;
    return (a.name ?? a.email).localeCompare(b.name ?? b.email);
  });
  let rank = 0;
  let prevXp = Number.NaN;
  return sorted.map((e, i) => {
    if (e.xp !== prevXp) {
      rank = i + 1;
      prevXp = e.xp;
    }
    return { ...e, rank };
  });
}

/** Reduce one intern's rows to the numbers a board row shows. */
function scoreIntern(rows: ScorecardRow[]) {
  const grade = overallGrade(rows);
  const xp = totalXp(rows);
  return {
    xp,
    level: levelInfo(xp).level,
    gradePct: grade.pct,
    gradedCount: rows.filter((r) => r.status === "graded" && r.score != null).length,
  };
}

/**
 * A single cohort's leaderboard, member-gated: any member (intern *or* mentor)
 * may view, so mentors can see how their cohort is doing; everyone else gets
 * null → the page turns that into notFound(). Only interns appear as entries;
 * mentors are never ranked.
 */
export async function getCohortLeaderboard(
  viewerId: string,
  groupId: string,
): Promise<CohortLeaderboard | null> {
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, viewerId), eq(memberships.groupId, groupId)),
    columns: { id: true },
  });
  if (!membership) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    columns: { id: true, name: true },
  });
  if (!group) return null;

  const interns = await db.query.memberships.findMany({
    where: and(
      eq(memberships.groupId, groupId),
      eq(memberships.roleInGroup, "intern"),
    ),
    columns: { userId: true },
    with: { user: { columns: { id: true, name: true, email: true, image: true } } },
  });
  if (interns.length === 0) return { group, entries: [] };

  const asgs = await loadPublishedAssignments([groupId]);
  const quizzes = await loadQuizzes([groupId]);
  const internIds = interns.map((m) => m.userId);
  const subs = await loadSubmissions(
    asgs.map((a) => a.id),
    internIds,
  );
  const attempts = await loadBestAttempts(
    quizzes.map((q) => q.assessmentId),
    internIds,
  );

  const scored = interns.map((m) => ({
    userId: m.userId,
    name: m.user?.name ?? null,
    email: m.user?.email ?? "",
    image: m.user?.image ?? null,
    ...scoreIntern(scorecardRowsFor(m.userId, asgs, subs, quizzes, attempts)),
  }));

  const entries = rankByXp(scored).map((e) => ({
    ...e,
    isViewer: e.userId === viewerId,
  }));
  return { group, entries };
}

/**
 * Cross-cohort standings for admins: every group with its interns ranked by XP
 * and flagged at-risk (failing grade or a pile of overdue work). Gathers all
 * published assignments and all submissions in two queries, then buckets per
 * cohort in memory.
 */
export async function getAdminCohortStandings(): Promise<CohortStanding[]> {
  const allGroups = await db.query.groups.findMany({
    orderBy: [asc(groups.name)],
    with: {
      memberships: {
        where: eq(memberships.roleInGroup, "intern"),
        columns: { userId: true },
        with: { user: { columns: { id: true, name: true, email: true, image: true } } },
      },
    },
  });
  if (allGroups.length === 0) return [];

  const asgs = await loadPublishedAssignments(allGroups.map((g) => g.id));
  const asgsByGroup = new Map<string, AssignmentLite[]>();
  for (const a of asgs) {
    const arr = asgsByGroup.get(a.groupId);
    if (arr) arr.push(a);
    else asgsByGroup.set(a.groupId, [a]);
  }

  const quizzes = await loadQuizzes(allGroups.map((g) => g.id));
  const quizzesByGroup = new Map<string, QuizLite[]>();
  for (const q of quizzes) {
    const arr = quizzesByGroup.get(q.groupId);
    if (arr) arr.push(q);
    else quizzesByGroup.set(q.groupId, [q]);
  }

  const internIds = [
    ...new Set(allGroups.flatMap((g) => g.memberships.map((m) => m.userId))),
  ];
  const subs = await loadSubmissions(
    asgs.map((a) => a.id),
    internIds,
  );
  const attempts = await loadBestAttempts(
    quizzes.map((q) => q.assessmentId),
    internIds,
  );
  const now = new Date();

  return allGroups.map((g) => {
    const groupAsgs = asgsByGroup.get(g.id) ?? [];
    const scored = g.memberships.map((m) => {
      const rows = scorecardRowsFor(
        m.userId,
        groupAsgs,
        subs,
        quizzesByGroup.get(g.id) ?? [],
        attempts,
      );
      const overdue = countOverdue(rows, now);
      const base = scoreIntern(rows);
      return {
        userId: m.userId,
        name: m.user?.name ?? null,
        email: m.user?.email ?? "",
        image: m.user?.image ?? null,
        ...base,
        overdue,
        atRisk: isAtRisk(base.gradePct, overdue),
      };
    });
    const entries = rankByXp(scored).map((e) => ({ ...e, isViewer: false }));
    return {
      groupId: g.id,
      groupName: g.name,
      status: g.status,
      internCount: g.memberships.length,
      atRiskCount: entries.filter((e) => e.atRisk).length,
      entries,
    };
  });
}
