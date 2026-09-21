import "server-only";

import { asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  assessmentOptions,
  assessmentQuestions,
  memberships,
  noteAttachments,
  notes,
} from "@/db/schema";

/** Attachments ordered oldest-first, so display order is stable across reloads. */
const withAttachments = {
  attachments: { orderBy: [asc(noteAttachments.createdAt)] },
};

/**
 * The quiz as the **authoring** UI needs it: questions and options in their
 * display order, and `isCorrect` included. Only admins reach this — the
 * intern-facing loader in `queries/modules.ts` deliberately omits the answer key.
 */
const withAssessment = {
  assessment: {
    with: {
      questions: {
        orderBy: [asc(assessmentQuestions.order)],
        with: {
          options: { orderBy: [asc(assessmentOptions.order)] },
        },
      },
    },
  },
};

/** Notes visible to an intern: global notes + notes in their groups. */
export async function getNotesForUser(userId: string) {
  const mine = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    columns: { groupId: true },
  });
  const groupIds = mine.map((m) => m.groupId);

  return db.query.notes.findMany({
    where: or(
      isNull(notes.groupId),
      groupIds.length ? inArray(notes.groupId, groupIds) : undefined,
    ),
    with: { group: true, ...withAttachments },
    orderBy: [desc(notes.createdAt)],
  });
}

export async function listAllNotes() {
  return db.query.notes.findMany({
    with: { group: true, ...withAttachments },
    orderBy: [desc(notes.createdAt)],
  });
}

export async function getNotesForGroup(groupId: string) {
  return db.query.notes.findMany({
    where: eq(notes.groupId, groupId),
    orderBy: [desc(notes.createdAt)],
  });
}

export async function getNote(id: string) {
  return db.query.notes.findFirst({
    where: eq(notes.id, id),
    with: { ...withAttachments, ...withAssessment },
  });
}
