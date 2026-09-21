import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Cache invalidation for note/module authoring, shared by `actions/notes.ts` and
 * `actions/assessments.ts`.
 *
 * Kept out of the action files because a `"use server"` module may only *export*
 * async server actions — a plain helper can't be re-exported from there, and
 * duplicating the path list is how "I forgot to revalidate X" bugs start. Every
 * reader of a note's content, and every view that shows a standing, has to be
 * here: adding a quiz question moves the grade denominator, so a quiz edit
 * changes what `/progress`, the cohort leaderboard and the admin standings show.
 */
export function revalidateNoteViews(groupId?: string | null) {
  revalidatePath("/admin/notes");
  revalidatePath("/notes");
  revalidatePath("/dashboard");
  // Quizzes contribute to the cumulative grade pool, so anyone's numbers move.
  revalidatePath("/progress");
  revalidatePath("/admin/standings");
  if (groupId) {
    revalidatePath(`/admin/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/leaderboard`);
  }
}

/**
 * Every surface that shows one specific note: the module page an intern reads,
 * its own edit page (where the authoring panels live), and the list/standing
 * views that a change to it moves.
 *
 * The reader path matters as much as the editor one — adding a link, editing
 * the body, or changing a quiz question all change what `/notes/[id]` renders,
 * so leaving it out serves a stale module page to whoever opens it next.
 */
export function revalidateNoteEditor(noteId: string, groupId: string | null) {
  revalidatePath(`/notes/${noteId}`);
  revalidatePath(`/notes/${noteId}/edit`);
  revalidateNoteViews(groupId);
}
