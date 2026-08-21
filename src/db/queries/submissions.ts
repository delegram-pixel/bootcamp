import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { comments, submissionItems, submissions } from "@/db/schema";

/**
 * The current intern's submission for an assignment (with its items, grade, and
 * comment thread), or null if they haven't started one. Scoped by
 * (assignmentId, internId) — the unique pair — so it can only ever return the
 * caller's own work. Authorization still runs at the page/action; this query
 * just narrows the data.
 */
export async function getMySubmission(userId: string, assignmentId: string) {
  return db.query.submissions.findFirst({
    where: and(
      eq(submissions.assignmentId, assignmentId),
      eq(submissions.internId, userId),
    ),
    with: {
      items: { orderBy: [asc(submissionItems.createdAt)] },
      grade: { with: { criterionScores: true } },
      comments: {
        with: { author: { columns: { id: true, name: true, email: true, image: true } } },
        orderBy: [asc(comments.createdAt)],
      },
    },
  });
}

export type MySubmission = NonNullable<Awaited<ReturnType<typeof getMySubmission>>>;
