import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { assignments, memberships, rubricCriteria } from "@/db/schema";

/** For the admin manage page: full assignment with group, rubric, attachments, submissions. */
export async function getAssignmentManage(id: string) {
  return db.query.assignments.findFirst({
    where: eq(assignments.id, id),
    with: {
      group: { columns: { id: true, name: true, status: true } },
      createdBy: { columns: { id: true, name: true, email: true } },
      attachments: { orderBy: (a, { asc }) => [asc(a.createdAt)] },
      rubric: {
        with: { criteria: { orderBy: [asc(rubricCriteria.order)] } },
      },
      submissions: { columns: { id: true, status: true } },
    },
  });
}

/** Raw shape the edit form needs (fields + rubric criteria + attachments). */
export async function getAssignmentForEdit(id: string) {
  return db.query.assignments.findFirst({
    where: eq(assignments.id, id),
    with: {
      attachments: { orderBy: (a, { asc }) => [asc(a.createdAt)] },
      rubric: {
        with: { criteria: { orderBy: [asc(rubricCriteria.order)] } },
      },
    },
  });
}

export async function listAssignmentsForGroup(groupId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.groupId, groupId),
    orderBy: [desc(assignments.createdAt)],
  });
}

/**
 * An assignment as an intern may see it: must be published AND in a group the
 * intern belongs to. Returns null otherwise. Authorization still runs through
 * `authorize()` at the page — this query just scopes the data.
 */
export async function getAssignmentForIntern(userId: string, id: string) {
  const row = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, id), eq(assignments.status, "published")),
    with: {
      group: { columns: { id: true, name: true } },
      attachments: { orderBy: (a, { asc }) => [asc(a.createdAt)] },
      rubric: {
        with: { criteria: { orderBy: [asc(rubricCriteria.order)] } },
      },
    },
  });
  if (!row) return null;

  const member = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.groupId, row.groupId)),
    columns: { id: true },
  });
  return member ? row : null;
}
