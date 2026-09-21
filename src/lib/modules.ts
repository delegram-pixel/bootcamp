/**
 * Module gating — the PURE progression layer (no `server-only`, no DB).
 *
 * A "module" is a cohort note. Modules form one ordered path per cohort, and a
 * module only opens once every *gating* module before it has been passed. This
 * is deliberately kept apart from `scoring.ts`:
 *
 *  - `scoring.ts` answers "what is this intern's grade?" from a flat list of
 *    graded work. Gating answers "what may they open next?" from an ordered
 *    list. Same data, different question.
 *  - Keeping them separate is what lets a *failed* attempt still count toward
 *    the grade (best score in the cumulative pool, per the locked design) while
 *    the module itself stays shut. Nothing here reads `ScorecardRow` or
 *    `SubmissionStatus`, so neither concern can leak into the other.
 *
 * A note with no assessment can never gate, but it is still *locked* while an
 * earlier gating module is unpassed — "don't move on" applies to the whole path,
 * not just to the quizzes.
 */

export type ModuleState = "locked" | "unlocked" | "passed";

/** One note reduced to everything gating depends on. */
export type ModuleNode = {
  noteId: string;
  /** Order within its cohort. Gaps and ties are both harmless. */
  position: number;
  /** null when the note has no (usable) assessment — it can never gate. */
  assessmentId: string | null;
  /** The best attempt as a percentage, or null when never attempted. */
  bestPct: number | null;
  /** True when the best attempt met the note's pass mark. */
  passed: boolean;
};

/**
 * The state of every node, returned in **input order** so `states[i]` pairs
 * with `nodes[i]`. Ordering is resolved internally by `position`.
 *
 * A node is `passed` when its own best attempt cleared the bar, `locked` while
 * any earlier gating node is unpassed, and `unlocked` otherwise. The first node
 * is therefore always reachable, and a failed module stays `unlocked` — you can
 * always go back and retake the one you're stuck on.
 */
export function moduleStates(nodes: ModuleNode[]): ModuleState[] {
  // Sort by position only; Array#sort is stable, so ties keep the caller's
  // order. We walk the sorted order but write results back by original index.
  const order = nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.position - b.node.position);

  const states: ModuleState[] = new Array(nodes.length);
  let gateOpen = true;

  for (const { node, index } of order) {
    if (node.passed) {
      states[index] = "passed";
    } else {
      states[index] = gateOpen ? "unlocked" : "locked";
    }
    // A gating module that hasn't been passed shuts the path for everything
    // after it — permanently, until it is passed.
    if (node.assessmentId != null && !node.passed) gateOpen = false;
  }

  return states;
}

/** One sitting, reduced to what the best-of rule inspects. */
export type AttemptLike = {
  assessmentId: string;
  score: number;
  total: number;
  submittedAt: Date;
};

/**
 * Is `a` a better sitting than `b`? Ranked by *percentage* first — the honest
 * reading of "best score" for a quiz, and the only comparison that stays fair
 * if an admin edits question points between two sittings (each attempt
 * snapshots its own `total`). Raw score then breaks percentage ties, and the
 * most recent sitting breaks those.
 *
 * Exported so the grade pool and the gate resolve "best" by the same rule —
 * if they disagreed, an intern could be shown a passed module whose score
 * counted differently toward their grade.
 */
export function isBetterAttempt(a: AttemptLike, b: AttemptLike): boolean {
  const ap = attemptPct(a.score, a.total);
  const bp = attemptPct(b.score, b.total);
  if (ap !== bp) return ap > bp;
  if (a.score !== b.score) return a.score > b.score;
  return a.submittedAt > b.submittedAt;
}

/** Reduce a sitting list to the best one per assessment. */
export function bestByAssessment<T extends AttemptLike>(rows: T[]): Map<string, T> {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.assessmentId);
    if (!cur || isBetterAttempt(r, cur)) best.set(r.assessmentId, r);
  }
  return best;
}

/** One attempt as a whole-number percentage, guarded against a zero total. */
export function attemptPct(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}

/** Whether a best-attempt percentage clears the module's pass mark. */
export function passedAt(bestPct: number | null, passPct: number): boolean {
  return bestPct != null && bestPct >= passPct;
}

export type ModuleProgress = {
  total: number;
  passed: number;
  /** Open, not yet passed — including a module awaiting a retake. */
  unlocked: number;
  locked: number;
  /** Modules passed as a share of the path; 0 for an empty path. */
  pct: number;
};

export function moduleProgress(states: ModuleState[]): ModuleProgress {
  let passed = 0;
  let unlocked = 0;
  let locked = 0;
  for (const s of states) {
    if (s === "passed") passed++;
    else if (s === "unlocked") unlocked++;
    else locked++;
  }
  const total = states.length;
  return {
    total,
    passed,
    unlocked,
    locked,
    pct: total > 0 ? Math.round((passed / total) * 100) : 0,
  };
}

/**
 * Index of the module the intern should be working on — the first open one —
 * or -1 when the path is empty or fully passed.
 */
export function currentModuleIndex(states: ModuleState[]): number {
  return states.findIndex((s) => s === "unlocked");
}
