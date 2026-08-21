"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { announcements, groups } from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import {
  allInternRecipients,
  groupInternRecipients,
  notify,
} from "@/lib/notify";
import { AnnouncementEmail } from "@/lib/email/templates";
import {
  announcementCreateSchema,
  type AnnouncementCreateInput,
} from "@/lib/validations";

const ADMIN = { action: "manage", resource: { kind: "admin" } } as const;

function revalidateAnnouncements() {
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}

/** A short, single-line preview of the body for the notification list. */
function snippet(bodyMd: string, max = 60): string {
  const flat = bodyMd.replace(/[#*_>`~-]/g, "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export async function createAnnouncement(
  input: AnnouncementCreateInput,
): Promise<ActionResult<{ id: string }>> {
  return guardedAction(
    { ...ADMIN, schema: announcementCreateSchema, input },
    async (data, userId) => {
      const groupId =
        data.groupId && data.groupId !== "__all__" ? data.groupId : null;

      const [row] = await db
        .insert(announcements)
        .values({ groupId, authorId: userId, bodyMd: data.bodyMd })
        .returning({ id: announcements.id });

      // Fan out to the audience: one group's interns, or every intern if global.
      const group = groupId
        ? await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
            columns: { name: true },
          })
        : null;
      const audience = group?.name ?? "All groups";
      const recipients = groupId
        ? await groupInternRecipients(groupId)
        : await allInternRecipients();

      await notify(recipients, {
        type: "announcement",
        payload: { title: snippet(data.bodyMd), announcementId: row.id, groupId },
        excludeUserId: userId,
        email: (r) => ({
          to: r.email!,
          subject: `Announcement · ${audience}`,
          react: AnnouncementEmail({ audience, bodyMd: data.bodyMd }),
        }),
      });

      revalidateAnnouncements();
      return ok({ id: row.id }, "Announcement posted");
    },
  );
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteAnnouncement(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    const current = await db.query.announcements.findFirst({
      where: eq(announcements.id, data.id),
      columns: { id: true },
    });
    if (!current) return fail("That announcement no longer exists.");
    await db.delete(announcements).where(eq(announcements.id, data.id));
    revalidateAnnouncements();
    return ok(undefined, "Announcement deleted");
  });
}
