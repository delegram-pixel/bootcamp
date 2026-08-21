"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/authz";
import { ok, fail, type ActionResult } from "@/lib/actions/types";

/** Mark all of the current user's unread notifications as read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("You're not signed in.");

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
      );
    revalidatePath("/notifications");
    return ok(undefined, "Marked all as read");
  } catch (e) {
    console.error("markAllNotificationsRead failed:", e);
    return fail("Couldn't update your notifications. Please try again.");
  }
}
