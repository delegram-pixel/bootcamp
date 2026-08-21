import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { assignments, memberships, submissions } from "@/db/schema";
import type { SubmissionStatus } from "@/lib/submission-status";

/** One published assignment as it matters to a specific intern. */
export type InternAssignmentItem = {
  id: string;
  title: string;
  dueAt: Date | null;
  points: number | null;
  groupId: string;
  groupName: string;
  status: SubmissionStatus | null;
  score: number | null;
};

/**
 * Every published assignment across the intern's groups, each paired with that
 * intern's own submission status + score (null when they haven't started).
 * Sorted by due date ascending, which puts overdue work first and no-due-date
 * work last — the page buckets these into "needs attention / awaiting / graded".
 */
export async function getInternDashboard(
  userId: string,
): Promise<InternAssignmentItem[]> {
  const mine = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    columns: { groupId: true },
  });
  const groupIds = mine.map((m) => m.groupId);
  if (groupIds.length === 0) return [];

  const rows = await db.query.assignments.findMany({
    where: and(
      inArray(assignments.groupId, groupIds),
      eq(assignments.status, "published"),
    ),
    columns: { id: true, title: true, dueAt: true, points: true, groupId: true },
    with: { group: { columns: { name: true } } },
    orderBy: [asc(assignments.dueAt)],
  });
  if (rows.length === 0) return [];

  const subs = await db.query.submissions.findMany({
    where: and(
      eq(submissions.internId, userId),
      inArray(
        submissions.assignmentId,
        rows.map((r) => r.id),
      ),
    ),
    columns: { assignmentId: true, status: true },
    with: { grade: { columns: { score: true } } },
  });
  const byAssignment = new Map(subs.map((s) => [s.assignmentId, s]));

  return rows.map((r) => {
    const sub = byAssignment.get(r.id);
    return {
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      points: r.points,
      groupId: r.groupId,
      groupName: r.group.name,
      status: sub?.status ?? null,
      score: sub?.grade?.score ?? null,
    };
  });
}

/** A submission waiting to be graded, for the admin overview queue. */
export type GradingQueueItem = Awaited<
  ReturnType<typeof getGradingQueue>
>[number];

/**
 * Submissions still owed a grade (submitted or late), oldest first so the
 * longest-waiting intern is served first. `limit` caps the visible queue; the
 * true count comes from the overview's stat card.
 */
export async function getGradingQueue(limit = 8) {
  return db.query.submissions.findMany({
    where: inArray(submissions.status, ["submitted", "late"]),
    columns: { id: true, status: true, submittedAt: true },
    with: {
      intern: { columns: { id: true, name: true, email: true } },
      assignment: {
        columns: { id: true, title: true },
        with: { group: { columns: { id: true, name: true } } },
      },
    },
    orderBy: [asc(submissions.submittedAt)],
    limit,
  });
}
