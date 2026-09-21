import Link from "next/link";
import { NotebookPenIcon, PlusIcon } from "lucide-react";

import { listAllNotes } from "@/db/queries/notes";
import { getModulePathsForIntern } from "@/db/queries/modules";
import { requireUser } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NotesByWeek } from "@/components/notes-by-week";
import { ModulePath } from "@/components/intern/module-path";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    // Interns see the gated path: every module in order, with its state.
    const paths = await getModulePathsForIntern(user.id);
    return (
      <>
        <PageHeader
          title="Modules"
          description="Work through these in order — pass each assessment to unlock the next."
        />
        <ModulePath paths={paths} />
      </>
    );
  }

  const notes = await listAllNotes();

  return (
    <>
      <PageHeader title="Notes" description="Every note across all groups.">
        <Button asChild>
          <Link href="/notes/new">
            <PlusIcon className="size-4" />
            New note
          </Link>
        </Button>
      </PageHeader>

      {notes.length === 0 ? (
        <EmptyState
          icon={NotebookPenIcon}
          title="No notes yet"
          description="Notes you post to a group — or to everyone — will appear here."
        >
          <Button asChild>
            <Link href="/notes/new">
              <PlusIcon className="size-4" />
              New note
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <NotesByWeek notes={notes} isAdmin />
      )}
    </>
  );
}
