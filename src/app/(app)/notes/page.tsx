import Link from "next/link";
import { NotebookPenIcon, PlusIcon } from "lucide-react";

import { getNotesForUser, listAllNotes } from "@/db/queries/notes";
import { requireUser } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NotesByWeek } from "@/components/notes-by-week";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const notes = isAdmin ? await listAllNotes() : await getNotesForUser(user.id);

  return (
    <>
      <PageHeader
        title="Notes"
        description={
          isAdmin
            ? "Every note across all groups."
            : "Lesson notes and resources shared with your groups."
        }
      >
        {isAdmin ? (
          <Button asChild>
            <Link href="/notes/new">
              <PlusIcon className="size-4" />
              New note
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {notes.length === 0 ? (
        <EmptyState
          icon={NotebookPenIcon}
          title="No notes yet"
          description={
            isAdmin
              ? "Notes you post to a group — or to everyone — will appear here."
              : "Your mentors haven't shared any notes yet."
          }
        >
          {isAdmin ? (
            <Button asChild>
              <Link href="/notes/new">
                <PlusIcon className="size-4" />
                New note
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <NotesByWeek notes={notes} isAdmin={isAdmin} />
      )}
    </>
  );
}
