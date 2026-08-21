import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  comments,
  memberships,
  rubricCriteria,
  submissionItems,
  submissions,
} from "@/db/schema";

/**
 * Everything the grading screen needs for one submission: the intern, the
 * assignment (+ group + rubric criteria), the submitted items, any existing
 * grade (+ per-criterion scores), and the comment thread with authors.
 * Authorization runs at the action/page — this query just gathers the data.
 */
export async function getSubmissionForGrading(submissionId: string) {
  return db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    with: {
      intern: { columns: { id: true, name: true, email: true, image: true } },
      assignment: {
        columns: { id: true, title: true, groupId: true, points: true, dueAt: true },
        with: {
          group: { columns: { id: true, name: true } },
          rubric: {
            with: { criteria: { orderBy: [asc(rubricCriteria.order)] } },
          },
        },
      },
      items: { orderBy: [asc(submissionItems.createdAt)] },
      grade: { with: { criterionScores: true } },
      comments: {
        with: { author: { columns: { id: true, name: true, email: true, image: true } } },
        orderBy: [asc(comments.createdAt)],
      },
    },
  });
}

export type SubmissionForGrading = NonNullable<
  Awaited<ReturnType<typeof getSubmissionForGrading>>
>;

/**
 * The admin submission grid for an assignment: every intern in the group paired
 * with their submission (or null if they haven't started). Mentors in the group
 * are excluded — the grid tracks who owes work. Returns null if the assignment
 * doesn't exist.
 */
export async function getAssignmentRoster(assignmentId: string) {
  const asg = await db.query.assignments.findFirst({
    where: (a, { eq }) => eq(a.id, assignmentId),
    columns: { id: true, groupId: true, title: true, points: true, dueAt: true },
    with: {
      rubric: { with: { criteria: { columns: { maxPoints: true } } } },
      submissions: {
        with: {
          grade: { columns: { score: true, gradedAt: true } },
          items: { columns: { id: true } },
        },
      },
    },
  });
  if (!asg) return null;

  const members = await db.query.memberships.findMany({
    where: and(
      eq(memberships.groupId, asg.groupId),
      eq(memberships.roleInGroup, "intern"),
    ),
    with: { user: { columns: { id: true, name: true, email: true, image: true } } },
    orderBy: [asc(memberships.createdAt)],
  });

  const byIntern = new Map(asg.submissions.map((s) => [s.internId, s]));
  const rubricTotal = (asg.rubric?.criteria ?? []).reduce(
    (sum, c) => sum + c.maxPoints,
    0,
  );

  const roster = members.map((m) => ({
    intern: m.user,
    submission: byIntern.get(m.user.id) ?? null,
  }));

  return { assignment: asg, roster, rubricTotal };
}
