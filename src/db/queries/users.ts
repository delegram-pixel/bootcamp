import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

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
