import "server-only";

import { desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { announcements, memberships } from "@/db/schema";

const withAuthorAndGroup = {
  author: { columns: { id: true, name: true, email: true, image: true } },
  group: { columns: { id: true, name: true } },
} as const;

/** Every announcement, newest first (admin view). */
export async function listAllAnnouncements() {
  return db.query.announcements.findMany({
    with: withAuthorAndGroup,
    orderBy: [desc(announcements.createdAt)],
  });
}

/** Announcements an intern can see: global (no group) + their groups', newest first. */
export async function getAnnouncementsForUser(userId: string) {
  const mine = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    columns: { groupId: true },
  });
  const groupIds = mine.map((m) => m.groupId);

  return db.query.announcements.findMany({
    where: or(
      isNull(announcements.groupId),
      groupIds.length ? inArray(announcements.groupId, groupIds) : undefined,
    ),
    with: withAuthorAndGroup,
    orderBy: [desc(announcements.createdAt)],
  });
}

export type AnnouncementListItem = Awaited<
  ReturnType<typeof listAllAnnouncements>
>[number];
