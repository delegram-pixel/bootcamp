"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { noteAttachments, notes } from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import {
  noteCreateSchema,
  noteUpdateSchema,
  noteAttachmentFileSchema,
  noteAttachmentLinkSchema,
  removeNoteAttachmentSchema,
  type NoteAttachmentFileInput,
  type NoteAttachmentLinkInput,
  type NoteFormInput,
  type NoteUpdateInput,
  type RemoveNoteAttachmentInput,
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
          weekNumber: data.weekNumber ? Number(data.weekNumber) : null,
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
          weekNumber: data.weekNumber ? Number(data.weekNumber) : null,
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

/* ---------------------------------------------------------- attachments */

/** Revalidate the note's edit page (where the manager lives) plus the reader views. */
function revalidateNoteAttachments(noteId: string, groupId: string | null) {
  revalidatePath(`/notes/${noteId}/edit`);
  revalidateNotes(groupId);
}

export async function addNoteAttachmentLink(
  input: NoteAttachmentLinkInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: noteAttachmentLinkSchema, input },
    async (data) => {
      const note = await db.query.notes.findFirst({
        where: eq(notes.id, data.noteId),
        columns: { groupId: true },
      });
      if (!note) return fail("That note no longer exists.");
      await db.insert(noteAttachments).values({
        noteId: data.noteId,
        kind: "link",
        label: data.label,
        url: data.url,
      });
      revalidateNoteAttachments(data.noteId, note.groupId);
      return ok(undefined, "Link added");
    },
  );
}

export async function addNoteAttachmentFile(
  input: NoteAttachmentFileInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: noteAttachmentFileSchema, input },
    async (data) => {
      const note = await db.query.notes.findFirst({
        where: eq(notes.id, data.noteId),
        columns: { groupId: true },
      });
      if (!note) return fail("That note no longer exists.");
      await db.insert(noteAttachments).values({
        noteId: data.noteId,
        kind: "file",
        label: data.label,
        url: data.url,
        fileKey: data.fileKey,
        mime: data.mime ?? null,
        size: data.size ?? null,
      });
      revalidateNoteAttachments(data.noteId, note.groupId);
      return ok(undefined, "File added");
    },
  );
}

export async function removeNoteAttachment(
  input: RemoveNoteAttachmentInput,
): Promise<ActionResult> {
  return guardedAction(
    { ...ADMIN, schema: removeNoteAttachmentSchema, input },
    async (data) => {
      const note = await db.query.notes.findFirst({
        where: eq(notes.id, data.noteId),
        columns: { groupId: true },
      });
      await db
        .delete(noteAttachments)
        .where(
          and(
            eq(noteAttachments.id, data.id),
            eq(noteAttachments.noteId, data.noteId),
          ),
        );
      revalidateNoteAttachments(data.noteId, note?.groupId ?? null);
      return ok(undefined, "Attachment removed");
    },
  );
}
