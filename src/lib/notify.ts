import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { memberships, notifications, users, type NotificationType } from "@/db/schema";
import { sendEmail, type EmailMessage } from "@/lib/email/send";

export type Recipient = { id: string; email: string | null; name: string | null };

/* -------------------------------------------------- recipient resolvers */

/** Interns of a group (mentors excluded — they don't get "you were assigned" pings). */
export async function groupInternRecipients(groupId: string): Promise<Recipient[]> {
  const rows = await db.query.memberships.findMany({
    where: and(
      eq(memberships.groupId, groupId),
      eq(memberships.roleInGroup, "intern"),
    ),
    with: { user: { columns: { id: true, email: true, name: true } } },
  });
  return rows.map((r) => r.user);
}

/** Every intern in the portal — for a global (all-groups) announcement. */
export async function allInternRecipients(): Promise<Recipient[]> {
  return db.query.users.findMany({
    where: eq(users.role, "intern"),
    columns: { id: true, email: true, name: true },
  });
}

/** Admins — the mentor side of a comment thread. */
export async function adminRecipients(): Promise<Recipient[]> {
  return db.query.users.findMany({
    where: eq(users.role, "admin"),
    columns: { id: true, email: true, name: true },
  });
}

export async function recipientsById(ids: string[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  return db.query.users.findMany({
    where: inArray(users.id, ids),
    columns: { id: true, email: true, name: true },
  });
}

/* -------------------------------------------------------------- notify */

type NotifyOptions = {
  type: NotificationType;
  payload: Record<string, unknown>;
  /** Per-recipient email; omit for in-app-only. Return null to skip one recipient. */
  email?: (r: Recipient) => EmailMessage | null;
  /** Don't notify the actor who triggered the event. */
  excludeUserId?: string;
};

/**
 * Record in-app notifications for `recipients` and, when email is configured,
 * send each their email. Best-effort by design: the whole thing is wrapped so a
 * failure here never propagates into (and rolls back) the calling mutation.
 * Returns how many in-app notifications were written.
 */
export async function notify(
  recipients: Recipient[],
  opts: NotifyOptions,
): Promise<number> {
  try {
    // De-dupe by id and drop the actor.
    const seen = new Set<string>();
    const targets = recipients.filter((r) => {
      if (!r?.id || r.id === opts.excludeUserId || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    if (targets.length === 0) return 0;

    await db.insert(notifications).values(
      targets.map((r) => ({
        userId: r.id,
        type: opts.type,
        payloadJson: opts.payload,
      })),
    );

    if (opts.email) {
      await Promise.allSettled(
        targets.map((r) => {
          const msg = opts.email!(r);
          if (!msg || !r.email) return Promise.resolve();
          return sendEmail(msg);
        }),
      );
    }

    return targets.length;
  } catch (e) {
    console.error("notify() failed (non-fatal):", e);
    return 0;
  }
}
