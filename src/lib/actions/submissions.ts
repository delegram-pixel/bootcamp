"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { assignments, submissionItems, submissions } from "@/db/schema";
import {
  getCurrentUser,
  authorize,
  ForbiddenError,
} from "@/lib/authz";
import {
  ok,
  fail,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/actions/types";
import { recordScoringMilestones } from "@/lib/scoring-events";
import {
  assignmentRefSchema,
  removeSubmissionItemSchema,
  submissionFileSchema,
  submissionGithubSchema,
  submissionLinkSchema,
  submissionTextSchema,
  type AssignmentRefInput,
  type RemoveSubmissionItemInput,
  type SubmissionFileInput,
  type SubmissionGithubInput,
  type SubmissionLinkInput,
  type SubmissionTextInput,
} from "@/lib/validations";

/**
 * Shared gate for every submission mutation. Unlike `guardedAction`, the resource
 * here (`{ kind: "submission", groupId }`) can only be built *after* we know which
 * assignment — and therefore which group — the write targets. So we validate, load
 * the assignment (must be published), then run the single central `authorize()`
 * check before touching anything. The client is never trusted for the group,
 * the ownership, or (below) the resulting status.
 */
type AssignmentCtx = {
  id: string;
  groupId: string;
  dueAt: Date | null;
  status: "draft" | "published";
};

async function withSubmissionAuth<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  input: unknown,
  run: (
    data: z.infer<TSchema>,
    userId: string,
    assignment: AssignmentCtx,
  ) => Promise<ActionResult<TResult>>,
): Promise<ActionResult<TResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("You're not signed in.");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }
  const data = parsed.data;
  const assignmentId = (data as { assignmentId: string }).assignmentId;

  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
    columns: { id: true, groupId: true, dueAt: true, status: true },
  });
  if (!assignment || assignment.status !== "published") {
    return fail("This assignment isn't open for submissions.");
  }

  try {
    await authorize(user, "submit", {
      kind: "submission",
      internId: user.id,
      groupId: assignment.groupId,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return fail(e.message);
    throw e;
  }

  try {
    return await run(data, user.id, assignment);
  } catch (e) {
    console.error("Submission action failed:", e);
    return fail("Something went wrong. Please try again.");
  }
}

/** Find (or lazily create) the caller's draft submission for an assignment. */
async function ensureSubmission(assignmentId: string, userId: string) {
  const existing = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.assignmentId, assignmentId),
      eq(submissions.internId, userId),
    ),
    columns: { id: true, status: true },
  });
  if (existing) return existing;

  try {
    const [row] = await db
      .insert(submissions)
      .values({ assignmentId, internId: userId, status: "draft" })
      .returning({ id: submissions.id, status: submissions.status });
    return row;
  } catch {
    // The unique (assignmentId, internId) constraint fired — another tab beat us
    // to it. Re-read and use that row.
    const row = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.internId, userId),
      ),
      columns: { id: true, status: true },
    });
    if (!row) throw new Error("Could not open a submission");
    return row;
  }
}

const GRADED_LOCK = "This submission has been graded and can no longer be edited.";

async function touch(submissionId: string) {
  await db
    .update(submissions)
    .set({ updatedAt: new Date() })
    .where(eq(submissions.id, submissionId));
}

function revalidateSubmission(assignmentId: string) {
  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath("/dashboard");
  // Seams for the Phase 5 admin grading surfaces (no-ops until those exist).
  revalidatePath(`/admin/assignments/${assignmentId}`);
  revalidatePath(`/admin/assignments/${assignmentId}/submissions`);
}

/** Pull { repo, prNumber, commitSha } out of a GitHub URL — the auto-grade seam. */
function parseGithub(raw: string): Record<string, unknown> {
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    const meta: Record<string, unknown> = { host: u.hostname };
    if (parts.length >= 2) meta.repo = `${parts[0]}/${parts[1]}`;
    const pull = parts.indexOf("pull");
    if (pull >= 0 && parts[pull + 1]) {
      const n = Number(parts[pull + 1]);
      if (Number.isInteger(n)) meta.prNumber = n;
    }
    const commit = parts.indexOf("commit");
    if (commit >= 0 && parts[commit + 1]) meta.commitSha = parts[commit + 1];
    return meta;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------- add items */

export async function addSubmissionText(
  input: SubmissionTextInput,
): Promise<ActionResult> {
  return withSubmissionAuth(submissionTextSchema, input, async (data, userId) => {
    const sub = await ensureSubmission(data.assignmentId, userId);
    if (sub.status === "graded") return fail(GRADED_LOCK);
    await db.insert(submissionItems).values({
      submissionId: sub.id,
      kind: "text",
      content: data.content,
    });
    await touch(sub.id);
    revalidateSubmission(data.assignmentId);
    return ok(undefined, "Added to your submission");
  });
}

export async function addSubmissionLink(
  input: SubmissionLinkInput,
): Promise<ActionResult> {
  return withSubmissionAuth(submissionLinkSchema, input, async (data, userId) => {
    const sub = await ensureSubmission(data.assignmentId, userId);
    if (sub.status === "graded") return fail(GRADED_LOCK);
    await db.insert(submissionItems).values({
      submissionId: sub.id,
      kind: "link",
      url: data.url,
      content: data.label ? data.label : null,
    });
    await touch(sub.id);
    revalidateSubmission(data.assignmentId);
    return ok(undefined, "Link added");
  });
}

export async function addSubmissionGithub(
  input: SubmissionGithubInput,
): Promise<ActionResult> {
  return withSubmissionAuth(submissionGithubSchema, input, async (data, userId) => {
    const sub = await ensureSubmission(data.assignmentId, userId);
    if (sub.status === "graded") return fail(GRADED_LOCK);
    await db.insert(submissionItems).values({
      submissionId: sub.id,
      kind: "github",
      url: data.url,
      content: data.note ? data.note : null,
      metaJson: parseGithub(data.url),
    });
    await touch(sub.id);
    revalidateSubmission(data.assignmentId);
    return ok(undefined, "GitHub link added");
  });
}

export async function addSubmissionFile(
  input: SubmissionFileInput,
): Promise<ActionResult> {
  return withSubmissionAuth(submissionFileSchema, input, async (data, userId) => {
    const sub = await ensureSubmission(data.assignmentId, userId);
    if (sub.status === "graded") return fail(GRADED_LOCK);
    await db.insert(submissionItems).values({
      submissionId: sub.id,
      kind: "file",
      url: data.url,
      fileKey: data.fileKey,
      content: data.name,
      mime: data.mime ?? null,
      size: data.size ?? null,
    });
    await touch(sub.id);
    revalidateSubmission(data.assignmentId);
    return ok(undefined, "File added");
  });
}

export async function removeSubmissionItem(
  input: RemoveSubmissionItemInput,
): Promise<ActionResult> {
  return withSubmissionAuth(
    removeSubmissionItemSchema,
    input,
    async (data, userId) => {
      const sub = await db.query.submissions.findFirst({
        where: and(
          eq(submissions.assignmentId, data.assignmentId),
          eq(submissions.internId, userId),
        ),
        columns: { id: true, status: true },
      });
      if (!sub) return fail("Nothing to remove.");
      if (sub.status === "graded") return fail(GRADED_LOCK);
      // Scoped to this submission so an intern can't delete someone else's item.
      await db
        .delete(submissionItems)
        .where(
          and(
            eq(submissionItems.id, data.id),
            eq(submissionItems.submissionId, sub.id),
          ),
        );
      await touch(sub.id);
      revalidateSubmission(data.assignmentId);
      return ok(undefined, "Item removed");
    },
  );
}

/* ------------------------------------------------------ submit / withdraw */

export async function submitSubmission(
  input: AssignmentRefInput,
): Promise<ActionResult> {
  return withSubmissionAuth(
    assignmentRefSchema,
    input,
    async (data, userId, assignment) => {
      const sub = await db.query.submissions.findFirst({
        where: and(
          eq(submissions.assignmentId, data.assignmentId),
          eq(submissions.internId, userId),
        ),
        columns: { id: true, status: true },
        with: { items: { columns: { id: true } } },
      });
      if (!sub) return fail("Add something to your submission first.");
      if (sub.status === "graded") return fail("This submission has already been graded.");
      if (sub.items.length === 0) {
        return fail("Add at least one item before submitting.");
      }

      // Status is DERIVED here, server-side, from the due date — the client never
      // sends it. On time → "submitted"; past the deadline → "late".
      const now = new Date();
      const status =
        assignment.dueAt && now.getTime() > assignment.dueAt.getTime()
          ? "late"
          : "submitted";

      await db
        .update(submissions)
        .set({ status, submittedAt: now, updatedAt: now })
        .where(eq(submissions.id, sub.id));

      // A submission can newly satisfy submission-based badges (first
      // submission, a weekly streak, polyglot, all-caught-up). Best-effort and
      // no level check — XP only moves on grading. The intern is the actor, so
      // they're the one notified.
      await recordScoringMilestones({
        intern: { id: userId, email: null, name: null },
      });

      // Seam: Phase 6 notifies the group's mentors here.
      revalidateSubmission(data.assignmentId);
      return ok(
        undefined,
        status === "late" ? "Submitted — after the due date" : "Submitted",
      );
    },
  );
}

export async function withdrawSubmission(
  input: AssignmentRefInput,
): Promise<ActionResult> {
  return withSubmissionAuth(assignmentRefSchema, input, async (data, userId) => {
    const sub = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.assignmentId, data.assignmentId),
        eq(submissions.internId, userId),
      ),
      columns: { id: true, status: true },
    });
    if (!sub) return fail("Nothing to withdraw.");
    if (sub.status !== "submitted" && sub.status !== "late") {
      return fail("Only a submitted assignment can be moved back to draft.");
    }
    await db
      .update(submissions)
      .set({ status: "draft", submittedAt: null, updatedAt: new Date() })
      .where(eq(submissions.id, sub.id));
    revalidateSubmission(data.assignmentId);
    return ok(undefined, "Moved back to draft — edit and resubmit when ready");
  });
}
