"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { noteAttachments, notes } from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import { revalidateNoteEditor, revalidateNoteViews } from "@/lib/revalidate-notes";
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

/**
 * Where a new note lands in its cohort's module path when the admin leaves the
 * position blank: one past the end of that path. Global notes are numbered
 * among themselves, so every cohort's path still starts at 1.
 */
async function nextPosition(groupId: string | null): Promise<number> {
  const rows = await db.query.notes.findMany({
    where: groupId ? eq(notes.groupId, groupId) : isNull(notes.groupId),
    columns: { position: true },
    orderBy: [desc(notes.position)],
    limit: 1,
  });
  return (rows[0]?.position ?? 0) + 1;
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
          position: data.position ? Number(data.position) : await nextPosition(groupId),
          topic: data.topic || null,
          createdById: userId,
        })
        .returning({ id: notes.id });
      revalidateNoteViews(groupId);
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
          // Blank on edit keeps the note where it is, so an admin editing copy
          // can't silently reshuffle the path.
          ...(data.position ? { position: Number(data.position) } : {}),
          topic: data.topic || null,
        })
        .where(eq(notes.id, data.id));
      // The note's own page, not just the lists — the title, body, topic and
      // week it shows all just changed.
      revalidateNoteEditor(data.id, groupId);
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
    // Purge the reader and editor entries too, so a cached module page can't
    // outlive the note it was built from.
    revalidateNoteEditor(data.id, current.groupId);
    return ok(undefined, "Note deleted");
  });
}

/* ---------------------------------------------------------- attachments */

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
      revalidateNoteEditor(data.noteId, note.groupId);
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
      revalidateNoteEditor(data.noteId, note.groupId);
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
      revalidateNoteEditor(data.noteId, note?.groupId ?? null);
      return ok(undefined, "Attachment removed");
    },
  );
}
