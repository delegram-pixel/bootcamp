import "server-only";

import { and, asc, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { assignments, groups, memberships, notes } from "@/db/schema";

/** Groups the user belongs to, with their per-group role attached. */
export async function getMyGroups(userId: string) {
  const rows = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    with: { group: true },
    orderBy: [desc(memberships.createdAt)],
  });
  return rows
    .filter((r) => r.group)
    .map((r) => ({ ...r.group, roleInGroup: r.roleInGroup }));
}

/** All groups (admin). */
export async function listGroups() {
  return db.query.groups.findMany({ orderBy: [asc(groups.name)] });
}

/** All groups with member/assignment counts, for the admin groups index. */
export async function listGroupsWithCounts() {
  const rows = await db.query.groups.findMany({
    orderBy: [asc(groups.name)],
    with: {
      memberships: { columns: { id: true, roleInGroup: true } },
      assignments: { columns: { id: true, status: true } },
    },
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    status: g.status,
    createdAt: g.createdAt,
    internCount: g.memberships.filter((m) => m.roleInGroup === "intern").length,
    mentorCount: g.memberships.filter((m) => m.roleInGroup === "mentor").length,
    assignmentCount: g.assignments.length,
    publishedCount: g.assignments.filter((a) => a.status === "published").length,
  }));
}

export async function getGroup(groupId: string) {
  return db.query.groups.findFirst({ where: eq(groups.id, groupId) });
}

/**
 * Resolve a cohort invite code to its group — only *active* groups are joinable.
 * Used by the public /join self-registration flow, so it returns just what that
 * flow needs (id + name), never the roster.
 */
export async function getGroupByJoinCode(code: string) {
  return db.query.groups.findFirst({
    where: and(eq(groups.joinCode, code), eq(groups.status, "active")),
    columns: { id: true, name: true, status: true },
  });
}

/** Full group detail: roster (members + users), assignments, and notes. */
export async function getGroupDetail(groupId: string) {
  return db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: {
      memberships: {
        with: { user: true },
        orderBy: [asc(memberships.createdAt)],
      },
      assignments: {
        columns: { id: true, title: true, status: true, dueAt: true, points: true },
        orderBy: [desc(assignments.createdAt)],
      },
      notes: { columns: { id: true, title: true, week: true, createdAt: true } },
    },
  });
}

/**
 * The intern-facing group home: the group itself (only if `userId` is a member),
 * its *published* assignments, and the notes visible here (this group + global).
 * Returns null when the user isn't a member — the page turns that into notFound().
 */
export async function getGroupForIntern(userId: string, groupId: string) {
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)),
    columns: { id: true, roleInGroup: true },
  });
  if (!membership) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: {
      assignments: {
        where: eq(assignments.status, "published"),
        columns: { id: true, title: true, dueAt: true, points: true, publishedAt: true },
        orderBy: [asc(assignments.dueAt)],
      },
    },
  });
  if (!group) return null;

  const visibleNotes = await db.query.notes.findMany({
    where: or(isNull(notes.groupId), eq(notes.groupId, groupId)),
    orderBy: [desc(notes.createdAt)],
  });

  return { ...group, notes: visibleNotes, roleInGroup: membership.roleInGroup };
}
