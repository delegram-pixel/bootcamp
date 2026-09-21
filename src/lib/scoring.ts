/**
 * Scoring & standing — the PURE computation layer (no `server-only`, no DB).
 *
 * Everything an intern's standing needs is a deterministic function of their
 * graded work, so it lives here and is shared by server pages and (later)
 * client bits alike — the same split as `submission-status.ts`. DB gathering
 * happens in `src/db/queries/scoring.ts`; this file never imports the database.
 *
 * Score math (locked with the user): CUMULATIVE POINTS — Σ earned ÷ Σ possible.
 * Assignments with no total (no points and no rubric) are excluded from the
 * percentage denominator, but their earned points still count toward XP.
 */
import {
  internActionState,
  needsAction,
  type SubmissionStatus,
} from "@/lib/submission-status";

/* --------------------------------------------------------------- tunables */

/** XP awarded on top of earned points for submitting on or before the due date. */
export const XP_ON_TIME_BONUS = 10;
/** XP awarded on top of earned points for a perfect score (earned === possible). */
export const XP_PERFECT_BONUS = 25;
/**
 * Cumulative-XP thresholds. Level N is reached at `LEVEL_THRESHOLDS[N-1]` XP.
 * Beyond the last threshold the intern is at max level.
 */
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1900, 2600];

/* ------------------------------------------------------------------ types */

/** One assignment as it bears on an intern's standing. Decoupled from DB rows. */
export type ScorecardRow = {
  status: SubmissionStatus | null;
  /** The grade's score, or null until graded. */
  score: number | null;
  /** The assignment's total (rubric sum or `points`), or null if it has none. */
  total: number | null;
  dueAt: Date | null;
  submittedAt: Date | null;
};

/* -------------------------------------------------------------- grade (%) */

/** Rubric sum wins when present; else the assignment's flat `points`; else none. */
export function assignmentTotal(
  points: number | null,
  rubricMaxSum: number | null,
): number | null {
  if (rubricMaxSum != null && rubricMaxSum > 0) return rubricMaxSum;
  return points ?? null;
}

export type OverallGrade = { earned: number; possible: number; pct: number | null };

/**
 * Cumulative standing across graded work. Rows without a denominator (no total)
 * are skipped — there's nothing to be "out of". `pct` is null when nothing
 * gradeable has been graded yet, so the UI can render a clean placeholder.
 */
export function overallGrade(rows: ScorecardRow[]): OverallGrade {
  let earned = 0;
  let possible = 0;
  for (const r of rows) {
    if (r.status !== "graded" || r.score == null) continue;
    if (r.total == null || r.total <= 0) continue;
    earned += r.score;
    possible += r.total;
  }
  return {
    earned,
    possible,
    pct: possible > 0 ? Math.round((earned / possible) * 100) : null,
  };
}

/* ---------------------------------------------------------------- progress */

export type Progress = {
  total: number;
  /** not_started + in_progress + returned — needs the intern to act. */
  todo: number;
  /** submitted or late — waiting on a grade. */
  awaiting: number;
  graded: number;
  /** awaiting + graded — submitted at least once. */
  done: number;
  completionPct: number;
};

/** Bucket every assignment by the intern's action state and tally completion. */
export function progress(rows: ScorecardRow[]): Progress {
  let todo = 0;
  let awaiting = 0;
  let graded = 0;
  for (const r of rows) {
    const state = internActionState(r.status);
    if (state === "graded") graded++;
    else if (state === "awaiting") awaiting++;
    else todo++;
  }
  const total = rows.length;
  const done = awaiting + graded;
  return {
    total,
    todo,
    awaiting,
    graded,
    done,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/* --------------------------------------------------------------- at-risk */

/** Below this overall grade %, an intern is flagged at-risk on admin standings. */
export const AT_RISK_GRADE_PCT = 60;
/** …or at/above this many overdue assignments. */
export const AT_RISK_OVERDUE = 2;

/**
 * Published assignments already past their due date that still need the intern
 * to act — nothing submitted, a lingering draft, or sent back for revision.
 * Assignments with no due date can't be overdue.
 */
export function countOverdue(rows: ScorecardRow[], now: Date = new Date()): number {
  let n = 0;
  for (const r of rows) {
    if (r.dueAt == null || r.dueAt >= now) continue;
    if (needsAction(internActionState(r.status))) n++;
  }
  return n;
}

/** At-risk = failing-grade territory, or a pile of overdue work. */
export function isAtRisk(gradePct: number | null, overdue: number): boolean {
  if (gradePct != null && gradePct < AT_RISK_GRADE_PCT) return true;
  return overdue >= AT_RISK_OVERDUE;
}

/* --------------------------------------------------------------- xp & level */

/** True when submitted on/before the due date (or the assignment has no due date). */
export function submittedOnTime(row: Pick<ScorecardRow, "dueAt" | "submittedAt">): boolean {
  if (row.dueAt == null) return true;
  return row.submittedAt != null && row.submittedAt <= row.dueAt;
}

/** XP from a single row: earned points + on-time and perfect-score bonuses. */
export function xpForRow(row: ScorecardRow): number {
  if (row.status !== "graded" || row.score == null) return 0;
  let xp = Math.max(0, row.score);
  if (submittedOnTime(row)) xp += XP_ON_TIME_BONUS;
  if (row.total != null && row.total > 0 && row.score >= row.total) {
    xp += XP_PERFECT_BONUS;
  }
  return xp;
}

export function totalXp(rows: ScorecardRow[]): number {
  return rows.reduce((sum, r) => sum + xpForRow(r), 0);
}

/* ------------------------------------------------------------ quiz rows */

/** The minimum a quiz needs to contribute a scorecard row. */
export type QuizScore = {
  assessmentId: string;
  /** Sum of the quiz's question points — its share of `possible`. */
  total: number;
};

/** The best sitting for one (intern, quiz) pair, as the row math needs it. */
export type QuizAttemptScore = {
  score: number;
  total: number;
  submittedAt: Date;
};

/**
 * One scorecard row per quiz, so module assessments land in the *same*
 * cumulative pool as assignments.
 *
 * A quiz with **any** attempt counts as graded work: the locked design says the
 * best score counts toward the grade, so a 20/30 sitting puts 20 in `earned`
 * and 30 in `possible` whether or not it cleared the pass mark. Keeping the
 * module shut is the gating layer's job (`lib/modules.ts`), which is why a
 * failed-but-scored quiz doesn't have to masquerade as un-graded here.
 *
 * `dueAt` is always null — quizzes have no deadline, so they never register as
 * overdue, and `submittedOnTime` treats them as on time.
 *
 * Pure and exported so the scorecard's own numbers can be reproduced exactly by
 * a verification script, rather than by a re-implementation of this rule.
 */
export function quizRowsFor(
  internId: string,
  quizzes: QuizScore[],
  attempts: Map<string, QuizAttemptScore>,
): ScorecardRow[] {
  return quizzes.map((q): ScorecardRow => {
    const a = attempts.get(`${internId}:${q.assessmentId}`);
    return {
      status: a ? "graded" : null,
      score: a?.score ?? null,
      total: q.total,
      dueAt: null,
      submittedAt: a?.submittedAt ?? null,
    };
  });
}

export type LevelInfo = {
  level: number;
  xp: number;
  levelStartXp: number;
  /** XP required for the next level, or null at max level. */
  nextLevelXp: number | null;
  intoLevel: number;
  span: number | null;
  /** 0–100 progress toward the next level; 100 at max level. */
  pctToNext: number;
};

export function levelInfo(xp: number): LevelInfo {
  const t = LEVEL_THRESHOLDS;
  let i = 0;
  while (i + 1 < t.length && t[i + 1] <= xp) i++;
  const levelStartXp = t[i];
  const nextLevelXp = i + 1 < t.length ? t[i + 1] : null;
  const intoLevel = xp - levelStartXp;
  const span = nextLevelXp != null ? nextLevelXp - levelStartXp : null;
  const pctToNext =
    span != null && span > 0 ? Math.min(100, Math.round((intoLevel / span) * 100)) : 100;
  return { level: i + 1, xp, levelStartXp, nextLevelXp, intoLevel, span, pctToNext };
}

/* --------------------------------------------------------------- streak */

/**
 * Absolute Monday-aligned week index for a date (weeks since the Unix epoch).
 * Computed in UTC, so the week boundary is Monday 00:00 UTC — good enough for a
 * bootcamp streak; an intern well east/west of UTC could see a week flip a few
 * hours off their local Monday. (The TZ caveat noted in the plan.)
 */
function weekIndex(d: Date): number {
  const day = Math.floor(d.getTime() / 86_400_000);
  // Unix day 0 (1970-01-01) was a Thursday; +3 shifts the boundary to Monday.
  return Math.floor((day + 3) / 7);
}

/**
 * Consecutive ISO-weeks with at least one submission, counting back from the
 * current week. A one-week grace keeps a streak alive mid-week: if nothing has
 * been submitted *this* week yet but last week had activity, the run still
 * counts. Returns 0 once a fully empty week breaks the chain.
 */
export function weeklyStreak(submittedDates: Date[], now: Date = new Date()): number {
  if (submittedDates.length === 0) return 0;
  const weeks = new Set(submittedDates.map(weekIndex));
  const current = weekIndex(now);
  let anchor: number;
  if (weeks.has(current)) anchor = current;
  else if (weeks.has(current - 1)) anchor = current - 1;
  else return 0;
  let streak = 0;
  for (let w = anchor; weeks.has(w); w--) streak++;
  return streak;
}

/* --------------------------------------------------------------- badges */

/**
 * Icon key for a badge, resolved to a Lucide component in `badge-icons.ts`.
 * Kept as a string (not the component) so this pure module never imports the
 * icon library — the same Server→Client-safe trick as `nav-icons.ts`.
 */
export type BadgeIconKey =
  | "send"
  | "check"
  | "star"
  | "trending-up"
  | "flame"
  | "check-check"
  | "layers"
  | "zap";

export type BadgeKey =
  | "first-submission"
  | "first-graded"
  | "perfect-score"
  | "high-flyer"
  | "on-a-roll"
  | "all-caught-up"
  | "polyglot"
  | "xp-500";

/** Everything a badge predicate may inspect — all derived, nothing stored. */
export type BadgeContext = {
  grade: OverallGrade;
  progress: Progress;
  xp: number;
  streakWeeks: number;
  /** Distinct submission-item kinds used (file/text/link/github). */
  itemKindCount: number;
  /** True if any single graded assignment scored full marks. */
  hasPerfectScore: boolean;
};

export type BadgeDef = {
  key: BadgeKey;
  label: string;
  description: string;
  icon: BadgeIconKey;
  predicate: (ctx: BadgeContext) => boolean;
};

/**
 * Badge registry — the single source of truth for both earned and locked
 * badges; array order is display order. Predicates are pure functions of a
 * `BadgeContext`, so the UI can show earned *and* locked (what's next) without
 * any per-badge storage. (Persisting *newly* earned badges for notifications is
 * Phase 4; nothing here needs the DB.)
 */
export const BADGES: readonly BadgeDef[] = [
  {
    key: "first-submission",
    label: "First submission",
    description: "Submitted your first task.",
    icon: "send",
    predicate: (c) => c.progress.done >= 1,
  },
  {
    key: "first-graded",
    label: "On the board",
    description: "Received your first grade.",
    icon: "check",
    predicate: (c) => c.progress.graded >= 1,
  },
  {
    key: "perfect-score",
    label: "Flawless",
    description: "Earned full marks on a task.",
    icon: "star",
    predicate: (c) => c.hasPerfectScore,
  },
  {
    key: "high-flyer",
    label: "High flyer",
    description: "90%+ overall across 3 or more graded tasks.",
    icon: "trending-up",
    predicate: (c) => c.grade.pct != null && c.grade.pct >= 90 && c.progress.graded >= 3,
  },
  {
    key: "on-a-roll",
    label: "On a roll",
    description: "Submitted work three weeks running.",
    icon: "flame",
    predicate: (c) => c.streakWeeks >= 3,
  },
  {
    key: "all-caught-up",
    label: "All caught up",
    description: "Nothing left needing your attention.",
    icon: "check-check",
    predicate: (c) => c.progress.total > 0 && c.progress.todo === 0,
  },
  {
    key: "polyglot",
    label: "Polyglot",
    description: "Submitted in three or more different formats.",
    icon: "layers",
    predicate: (c) => c.itemKindCount >= 3,
  },
  {
    key: "xp-500",
    label: "500 club",
    description: "Banked 500 XP.",
    icon: "zap",
    predicate: (c) => c.xp >= 500,
  },
];

/** Keys of every badge whose predicate the context satisfies, in registry order. */
export function evaluateBadges(ctx: BadgeContext): BadgeKey[] {
  return BADGES.filter((b) => b.predicate(ctx)).map((b) => b.key);
}
