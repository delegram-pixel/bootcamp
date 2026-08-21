import { and, eq, gt, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { assignments, notifications, submissions } from "@/db/schema";
import { env } from "@/lib/env";
import { fromNow } from "@/lib/format";
import { groupInternRecipients, notify } from "@/lib/notify";
import { DueSoonEmail } from "@/lib/email/templates";

// Always run fresh — this reads the Authorization header and the current time.
export const dynamic = "force-dynamic";

/** How far ahead counts as "due soon". */
const WINDOW_MS = 48 * 60 * 60 * 1000;

/** Submission states that mean the intern is done — don't nag them. */
const HANDLED = new Set(["submitted", "late", "graded"]);

/**
 * Daily reminder sweep (Vercel Cron → GET). For every published assignment due
 * within the next 48h, ping each group intern who hasn't submitted yet and
 * hasn't already been reminded for that assignment.
 *
 * Guarded by CRON_SECRET when set (Vercel sends `Authorization: Bearer <secret>`);
 * when unset — local dev — it's open so you can hit it by hand.
 */
export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const soon = new Date(now.getTime() + WINDOW_MS);

  const dueSoon = await db.query.assignments.findMany({
    where: and(
      eq(assignments.status, "published"),
      gt(assignments.dueAt, now),
      lte(assignments.dueAt, soon),
    ),
    columns: { id: true, title: true, groupId: true, dueAt: true },
  });

  let notified = 0;

  for (const a of dueSoon) {
    const recipients = await groupInternRecipients(a.groupId);
    if (recipients.length === 0) continue;
    const ids = recipients.map((r) => r.id);

    // Interns who've already turned something in (or been graded) — skip them.
    const subs = await db.query.submissions.findMany({
      where: and(
        eq(submissions.assignmentId, a.id),
        inArray(submissions.internId, ids),
      ),
      columns: { internId: true, status: true },
    });
    const handled = new Set(
      subs.filter((s) => HANDLED.has(s.status)).map((s) => s.internId),
    );

    // Interns already reminded for THIS assignment — don't ping twice.
    const priorPings = await db.query.notifications.findMany({
      where: and(
        eq(notifications.type, "due_soon"),
        inArray(notifications.userId, ids),
      ),
      columns: { userId: true, payloadJson: true },
    });
    const reminded = new Set(
      priorPings
        .filter(
          (n) =>
            (n.payloadJson as { assignmentId?: string } | null)?.assignmentId ===
            a.id,
        )
        .map((n) => n.userId),
    );

    const targets = recipients.filter(
      (r) => !handled.has(r.id) && !reminded.has(r.id),
    );
    if (targets.length === 0) continue;

    const dueText = `due ${fromNow(a.dueAt)}`;
    notified += await notify(targets, {
      type: "due_soon",
      payload: { title: a.title, assignmentId: a.id, groupId: a.groupId },
      email: (r) => ({
        to: r.email!,
        subject: `Due soon: ${a.title}`,
        react: DueSoonEmail({
          name: r.name,
          assignmentTitle: a.title,
          dueText,
          assignmentId: a.id,
        }),
      }),
    });
  }

  return Response.json({
    ok: true,
    assignmentsDueSoon: dueSoon.length,
    notified,
  });
}
