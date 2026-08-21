"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, type Database } from "@/db";
import {
  assignmentAttachments,
  assignments,
  rubricCriteria,
  rubrics,
} from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import { groupInternRecipients, notify } from "@/lib/notify";
import { AssignmentPublishedEmail } from "@/lib/email/templates";
import { dueLabel } from "@/lib/format";
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  attachmentFileSchema,
  attachmentLinkSchema,
  type AssignmentCreateInput,
  type AssignmentUpdateInput,
  type AttachmentFileInput,
  type AttachmentLinkInput,
  type CriterionInput,
} from "@/lib/validations";

// Content authoring is admin-only; interns can never reach these. The finer
// per-group/status rule in authorize() gates intern *reads*, not these writes.
const ADMIN = { action: "manage", resource: { kind: "admin" } } as const;

function revalidateAssignment(assignmentId: string, groupId?: string) {
  revalidatePath(`/admin/assignments/${assignmentId}`);
  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath("/admin/groups");
  revalidatePath("/dashboard");
  if (groupId) {
    revalidatePath(`/admin/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}`);
  }
}

/** Replace a rubric's criteria to match `criteria` (drops the rubric when empty). */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function syncRubric(
  tx: Tx,
  assignmentId: string,
  criteria: CriterionInput[],
) {
  const existing = await tx.query.rubrics.findFirst({
    where: eq(rubrics.assignmentId, assignmentId),
    columns: { id: true },
  });

  if (criteria.length === 0) {
    if (existing) await tx.delete(rubrics).where(eq(rubrics.id, existing.id));
    return;
  }

  let rubricId = existing?.id;
  if (!rubricId) {
    const [row] = await tx
      .insert(rubrics)
      .values({ assignmentId })
      .returning({ id: rubrics.id });
    rubricId = row.id;
  } else {
    // v1: replace criteria wholesale. (Pre-grading this is safe; once grading
    // lands we'd upsert by id to preserve criterion scores.)
    await tx.delete(rubricCriteria).where(eq(rubricCriteria.rubricId, rubricId));
  }

  await tx.insert(rubricCriteria).values(
    criteria.map((c, i) => ({
      rubricId: rubricId!,
      label: c.label,
      description: c.description || null,
      maxPoints: c.maxPoints,
      order: i,
    })),
  );
}

export async function createAssignment(
  input: AssignmentCreateInput,
): Promise<ActionResult<{ id: string }>> {
  return guardedAction(
    { ...ADMIN, schema: assignmentCreateSchema, input },
    async (data, userId) => {
      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(assignments)
          .values({
            groupId: data.groupId,
            title: data.title,
            descriptionMd: data.descriptionMd,
            dueAt: data.dueAt,
            points: data.points,
            status: "draft",
            createdById: userId,
          })
          .returning({ id: assignments.id });
        await syncRubric(tx, row.id, data.criteria);
        return row.id;
      });
      revalidateAssignment(id, data.groupId);
      return ok({ id }, "Assignment created");
    },
  );
}

export async function updateAssignment(
  input: AssignmentUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  return guardedAction(
    { ...ADMIN, schema: assignmentUpdateSchema, input },
    async (data) => {
      const current = await db.query.assignments.findFirst({
        where: eq(assignments.id, data.id),
        columns: { groupId: true },
      });
      if (!current) return fail("That assignment no longer exists.");

      await db.transaction(async (tx) => {
        await tx
          .update(assignments)
          .set({
            title: data.title,
            descriptionMd: data.descriptionMd,
            dueAt: data.dueAt,
            points: data.points,
            updatedAt: new Date(),
          })
          .where(eq(assignments.id, data.id));
        await syncRubric(tx, data.id, data.criteria);
      });
      revalidateAssignment(data.id, current.groupId);
      return ok({ id: data.id }, "Assignment saved");
    },
  );
}

const idSchema = z.object({ id: z.string().min(1) });

export async function publishAssignment(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    const current = await db.query.assignments.findFirst({
      where: eq(assignments.id, data.id),
      columns: { groupId: true, publishedAt: true, title: true, dueAt: true },
      with: { group: { columns: { name: true } } },
    });
    if (!current) return fail("That assignment no longer exists.");
    const firstPublish = current.publishedAt == null;
    await db
      .update(assignments)
      .set({ status: "published", publishedAt: current.publishedAt ?? new Date() })
      .where(eq(assignments.id, data.id));

    // Notify group interns on first publish only (re-publishing a draft is quiet).
    if (firstPublish) {
      const recipients = await groupInternRecipients(current.groupId);
      const due = current.dueAt ? dueLabel(current.dueAt).text : null;
      await notify(recipients, {
        type: "assignment_published",
        payload: {
          title: current.title,
          assignmentId: data.id,
          groupId: current.groupId,
        },
        email: (r) => ({
          to: r.email!,
          subject: `New assignment: ${current.title}`,
          react: AssignmentPublishedEmail({
            name: r.name,
            assignmentTitle: current.title,
            groupName: current.group.name,
            dueText: due,
            assignmentId: data.id,
          }),
        }),
      });
    }

    revalidateAssignment(data.id, current.groupId);
    return ok(undefined, "Assignment published");
  });
}

export async function unpublishAssignment(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    const current = await db.query.assignments.findFirst({
      where: eq(assignments.id, data.id),
      columns: { groupId: true },
    });
    if (!current) return fail("That assignment no longer exists.");
    await db
      .update(assignments)
      .set({ status: "draft" })
      .where(eq(assignments.id, data.id));
    revalidateAssignment(data.id, current.groupId);
    return ok(undefined, "Moved back to draft");
  });
}

export async function deleteAssignment(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult<{ groupId: string }>> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    const current = await db.query.assignments.findFirst({
      where: eq(assignments.id, data.id),
      columns: { groupId: true },
    });
    if (!current) return fail("That assignment no longer exists.");
    // Cascades remove rubric, criteria, attachments, submissions.
    await db.delete(assignments).where(eq(assignments.id, data.id));
    revalidateAssignment(data.id, current.groupId);
    return ok({ groupId: current.groupId }, "Assignment deleted");
  });
}

/* ---------------------------------------------------------- attachments */

export async function addAttachmentLink(
  input: AttachmentLinkInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: attachmentLinkSchema, input },
    async (data) => {
      await db.insert(assignmentAttachments).values({
        assignmentId: data.assignmentId,
        kind: "link",
        label: data.label,
        url: data.url,
      });
      revalidateAssignment(data.assignmentId);
      return ok(undefined, "Link added");
    },
  );
}

export async function addAttachmentFile(
  input: AttachmentFileInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: attachmentFileSchema, input },
    async (data) => {
      await db.insert(assignmentAttachments).values({
        assignmentId: data.assignmentId,
        kind: "file",
        label: data.label,
        url: data.url,
        fileKey: data.fileKey,
        mime: data.mime ?? null,
        size: data.size ?? null,
      });
      revalidateAssignment(data.assignmentId);
      return ok(undefined, "File added");
    },
  );
}

const removeAttachmentSchema = z.object({
  id: z.string().min(1),
  assignmentId: z.string().min(1),
});

export async function removeAttachment(
  input: z.infer<typeof removeAttachmentSchema>,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: removeAttachmentSchema, input },
    async (data) => {
      await db
        .delete(assignmentAttachments)
        .where(
          and(
            eq(assignmentAttachments.id, data.id),
            eq(assignmentAttachments.assignmentId, data.assignmentId),
          ),
        );
      revalidateAssignment(data.assignmentId);
      return ok(undefined, "Attachment removed");
    },
  );
}
