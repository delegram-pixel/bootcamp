"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { notes } from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import {
  noteCreateSchema,
  noteUpdateSchema,
  type NoteFormInput,
  type NoteUpdateInput,
} from "@/lib/validations";

const ADMIN = { action: "manage", resource: { kind: "admin" } } as const;

function revalidateNotes(groupId?: string | null) {
  revalidatePath("/admin/notes");
  revalidatePath("/notes");
  revalidatePath("/dashboard");
  if (groupId) {
    revalidatePath(`/admin/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}`);
  }
}

export async function createNote(
  input: NoteFormInput,
): Promise<ActionResult<{ id: string }>> {
  return guardedAction(
    { ...ADMIN, schema: noteCreateSchema, input },
    async (data, userId) => {
      const groupId = data.groupId || null;
      const [row] = await db
        .insert(notes)
        .values({
          groupId,
          title: data.title,
          bodyMd: data.bodyMd,
          week: data.week || null,
          topic: data.topic || null,
          createdById: userId,
        })
        .returning({ id: notes.id });
      revalidateNotes(groupId);
      return ok({ id: row.id }, "Note posted");
    },
  );
}

export async function updateNote(input: NoteUpdateInput): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: noteUpdateSchema, input },
    async (data) => {
      const groupId = data.groupId || null;
      await db
        .update(notes)
        .set({
          groupId,
          title: data.title,
          bodyMd: data.bodyMd,
          week: data.week || null,
          topic: data.topic || null,
        })
        .where(eq(notes.id, data.id));
      revalidateNotes(groupId);
      return ok(undefined, "Note updated");
    },
  );
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteNote(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    const current = await db.query.notes.findFirst({
      where: eq(notes.id, data.id),
      columns: { groupId: true },
    });
    if (!current) return fail("That note no longer exists.");
    await db.delete(notes).where(eq(notes.id, data.id));
    revalidateNotes(current.groupId);
    return ok(undefined, "Note deleted");
  });
}
