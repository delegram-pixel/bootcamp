import "server-only";

import { asc, eq, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { memberships, users } from "@/db/schema";

/** All users with the groups they belong to — for the admin members view. */
export async function listUsersWithGroups() {
  const rows = await db.query.users.findMany({
    orderBy: [asc(users.name)],
    with: {
      memberships: {
        columns: { roleInGroup: true },
        with: { group: { columns: { id: true, name: true, status: true } } },
      },
    },
  });
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    image: u.image,
    groups: u.memberships
      .filter((m) => m.group)
      .map((m) => ({ ...m.group, roleInGroup: m.roleInGroup })),
  }));
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase()),
  });
}

/**
 * Registered users who are NOT yet in this group — the people an admin can add.
 * New accounts come from self-registration (the invite link) or "Invite intern",
 * so adding a member is now just attaching someone who already exists.
 */
export async function listAddableUsers(groupId: string) {
  const current = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.groupId, groupId));
  const memberIds = current.map((m) => m.userId);

  return db.query.users.findMany({
    where: memberIds.length ? notInArray(users.id, memberIds) : undefined,
    orderBy: [asc(users.name)],
    columns: { id: true, name: true, email: true, image: true, role: true },
  });
}
