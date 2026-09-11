"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  comments,
  criterionScores,
  grades,
  submissions,
} from "@/db/schema";
import {
  getCurrentUser,
  authorize,
  ForbiddenError,
  type Action,
} from "@/lib/authz";
import {
  ok,
  fail,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/actions/types";
import {
  adminRecipients,
  notify,
  type Recipient,
} from "@/lib/notify";
import { currentLevel, recordScoringMilestones } from "@/lib/scoring-events";
import {
  GradedEmail,
  ReturnedEmail,
} from "@/lib/email/templates";
import {
  commentCreateSchema,
  gradeSubmissionSchema,
  submissionRefSchema,
  type CommentCreateInput,
  type GradeSubmissionInput,
  type SubmissionRefInput,
} from "@/lib/validations";

/**
 * Shared gate for every grading / comment mutation. The resource
 * (`{ kind: "submission", internId, groupId }`) is data-dependent — it can only
 * be built after loading the submission — so we validate, load the submission
 * (with its assignment's group + rubric), then run the single central
 * `authorize()` for the given action:
 *   - "grade"  → admin only (interns are rejected up front in `can()`).
 *   - "create" → the owning intern OR an admin (the comment thread).
 * The client is never trusted for the group, the owner, or the score.
 */
type GradingCtx = {
  submissionId: string;
  internId: string;
  intern: Recipient;
  status: "draft" | "submitted" | "late" | "graded" | "returned";
  assignmentId: string;
  assignmentTitle: string;
  groupId: string;
  points: number | null;
  criteria: { id: string; maxPoints: number }[];
};

async function withGradingAuth<TSchema extends z.ZodType, TResult>(
  action: Action,
  schema: TSchema,
  input: unknown,
  run: (
    data: z.infer<TSchema>,
    userId: string,
    ctx: GradingCtx,
  ) => Promise<ActionResult<TResult>>,
): Promise<ActionResult<TResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("You're not signed in.");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }
  const data = parsed.data;
  const submissionId = (data as { submissionId: string }).submissionId;

  const sub = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { id: true, internId: true, status: true, assignmentId: true },
    with: {
      intern: { columns: { id: true, email: true, name: true } },
      assignment: {
        columns: { id: true, title: true, groupId: true, points: true },
        with: { rubric: { with: { criteria: { columns: { id: true, maxPoints: true } } } } },
      },
    },
  });
  if (!sub) return fail("Submission not found.");

  try {
    await authorize(user, action, {
      kind: "submission",
      internId: sub.internId,
      groupId: sub.assignment.groupId,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return fail(e.message);
    throw e;
  }

  const ctx: GradingCtx = {
    submissionId: sub.id,
    internId: sub.internId,
    intern: sub.intern,
    status: sub.status,
    assignmentId: sub.assignmentId,
    assignmentTitle: sub.assignment.title,
    groupId: sub.assignment.groupId,
    points: sub.assignment.points,
    criteria: sub.assignment.rubric?.criteria ?? [],
  };

  try {
    return await run(data, user.id, ctx);
  } catch (e) {
    console.error("Grading action failed:", e);
    return fail("Something went wrong. Please try again.");
  }
}

function revalidateSubmission(ctx: Pick<GradingCtx, "submissionId" | "assignmentId">) {
  revalidatePath(`/admin/submissions/${ctx.submissionId}`);
  revalidatePath(`/admin/assignments/${ctx.assignmentId}`);
  revalidatePath(`/assignments/${ctx.assignmentId}`);
  revalidatePath("/dashboard");
}

/* --------------------------------------------------------------- grade */

export async function gradeSubmission(
  input: GradeSubmissionInput,
): Promise<ActionResult> {
  return withGradingAuth("grade", gradeSubmissionSchema, input, async (data, userId, ctx) => {
    if (ctx.status === "draft") {
      return fail("This intern hasn't submitted anything to grade yet.");
    }

    // Derive the score server-side — never from the client.
    let score: number;
    if (ctx.criteria.length > 0) {
      const byId = new Map(ctx.criteria.map((c) => [c.id, c]));
      if (data.criteria.length !== ctx.criteria.length) {
        return fail("Score every rubric criterion before saving.");
      }
      for (const cs of data.criteria) {
        const c = byId.get(cs.criterionId);
        if (!c) return fail("That criterion doesn't belong to this rubric.");
        if (cs.points > c.maxPoints) {
          return fail(`A criterion score exceeds its maximum of ${c.maxPoints}.`);
        }
      }
      score = data.criteria.reduce((sum, cs) => sum + cs.points, 0);
    } else {
      if (data.overallScore == null) return fail("Enter a score.");
      if (ctx.points != null && data.overallScore > ctx.points) {
        return fail(`The score can't exceed ${ctx.points} points.`);
      }
      score = data.overallScore;
    }

    // Capture the intern's level before this grade lands, so we can tell
    // afterward whether it pushed them across a threshold.
    const previousLevel = await currentLevel(ctx.internId);

    // Upsert the grade (one per submission), then replace its criterion scores.
    const now = new Date();
    const [grade] = await db
      .insert(grades)
      .values({ submissionId: ctx.submissionId, score, gradedById: userId })
      .onConflictDoUpdate({
        target: grades.submissionId,
        set: { score, gradedById: userId, gradedAt: now },
      })
      .returning({ id: grades.id });

    await db.delete(criterionScores).where(eq(criterionScores.gradeId, grade.id));
    if (data.criteria.length > 0) {
      await db.insert(criterionScores).values(
        data.criteria.map((cs) => ({
          gradeId: grade.id,
          criterionId: cs.criterionId,
          points: cs.points,
          comment: cs.comment ? cs.comment : null,
        })),
      );
    }

    await db
      .update(submissions)
      .set({ status: "graded", updatedAt: now })
      .where(eq(submissions.id, ctx.submissionId));

    // Optional written feedback goes onto the shared comment thread.
    if (data.feedback && data.feedback.trim()) {
      await db.insert(comments).values({
        submissionId: ctx.submissionId,
        authorId: userId,
        bodyMd: data.feedback.trim(),
      });
    }

    // Notify the intern (in-app bell + email). Best-effort — never blocks the grade.
    const total =
      ctx.criteria.length > 0
        ? ctx.criteria.reduce((sum, c) => sum + c.maxPoints, 0)
        : ctx.points;
    await notify([ctx.intern], {
      type: "graded",
      payload: {
        title: ctx.assignmentTitle,
        assignmentId: ctx.assignmentId,
        submissionId: ctx.submissionId,
        score,
      },
      email: (r) => ({
        to: r.email!,
        subject: `Graded: ${ctx.assignmentTitle}`,
        react: GradedEmail({
          name: r.name,
          assignmentTitle: ctx.assignmentTitle,
          score,
          total,
          assignmentId: ctx.assignmentId,
        }),
      }),
    });

    // Award any newly-earned badges and a level-up if this grade crossed a
    // threshold. Best-effort — recomputed from the just-written state, wrapped
    // so it can never block or roll back the grade.
    await recordScoringMilestones({ intern: ctx.intern, previousLevel });

    revalidateSubmission(ctx);
    return ok(undefined, `Graded — ${score} pts`);
  });
}

export async function returnForRevision(
  input: SubmissionRefInput,
): Promise<ActionResult> {
  return withGradingAuth("grade", submissionRefSchema, input, async (_data, _userId, ctx) => {
    if (ctx.status === "draft" || ctx.status === "returned") {
      return fail("There's nothing submitted to return.");
    }
    await db
      .update(submissions)
      .set({ status: "returned", updatedAt: new Date() })
      .where(eq(submissions.id, ctx.submissionId));

    // Notify the intern their work was sent back.
    await notify([ctx.intern], {
      type: "returned",
      payload: {
        title: ctx.assignmentTitle,
        assignmentId: ctx.assignmentId,
        submissionId: ctx.submissionId,
      },
      email: (r) => ({
        to: r.email!,
        subject: `Sent back for revision: ${ctx.assignmentTitle}`,
        react: ReturnedEmail({
          name: r.name,
          assignmentTitle: ctx.assignmentTitle,
          assignmentId: ctx.assignmentId,
        }),
      }),
    });

    revalidateSubmission(ctx);
    return ok(undefined, "Sent back for revision");
  });
}

/* ------------------------------------------------------------- comments */

export async function addComment(
  input: CommentCreateInput,
): Promise<ActionResult> {
  // "create" on the submission — allowed for the owning intern and for admins,
  // so both sides of the thread run through the same central check.
  return withGradingAuth("create", commentCreateSchema, input, async (data, userId, ctx) => {
    await db.insert(comments).values({
      submissionId: ctx.submissionId,
      authorId: userId,
      bodyMd: data.bodyMd,
    });

    // Notify the other side of the thread (in-app only — comments are chatty).
    // Intern commented → ping the mentors; mentor commented → ping the intern.
    const actorIsIntern = userId === ctx.internId;
    const recipients = actorIsIntern ? await adminRecipients() : [ctx.intern];
    await notify(recipients, {
      type: "comment",
      payload: {
        title: ctx.assignmentTitle,
        assignmentId: ctx.assignmentId,
        submissionId: ctx.submissionId,
      },
      excludeUserId: userId,
    });

    revalidateSubmission(ctx);
    return ok(undefined, "Comment posted");
  });
}
