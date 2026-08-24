import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { listGroups } from "@/db/queries/groups";
import { requireAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { NoteForm } from "@/components/admin/note-form";

export const metadata = { title: "New note" };

export default async function NewNotePage() {
  await requireAdmin();
  const groups = await listGroups();
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <Link
        href="/notes"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        Notes
      </Link>
      <PageHeader
        title="New note"
        description="Share a lesson note or resource. Post to one group or to everyone."
      />
      <div className="max-w-3xl">
        <NoteForm groups={groupOptions} />
      </div>
    </>
  );
}
