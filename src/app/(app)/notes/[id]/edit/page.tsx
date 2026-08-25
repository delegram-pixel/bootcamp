import { notFound } from "next/navigation";
import { PaperclipIcon } from "lucide-react";

import { getNote } from "@/db/queries/notes";
import { listGroups } from "@/db/queries/groups";
import { requireAdmin } from "@/lib/authz";
import { features } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Separator } from "@/components/ui/separator";
import { NoteForm } from "@/components/admin/note-form";
import { NoteAttachmentManager } from "@/components/admin/note-attachment-manager";

export const metadata = { title: "Edit note" };

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [note, groups] = await Promise.all([getNote(id), listGroups()]);
  if (!note) notFound();
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <BackLink href="/notes">Notes</BackLink>
      <PageHeader
        title="Edit note"
        description="Update this note’s content, audience, or week."
      />
      <div className="max-w-3xl space-y-8">
        <NoteForm
          groups={groupOptions}
          note={{
            id: note.id,
            title: note.title,
            bodyMd: note.bodyMd,
            groupId: note.groupId,
            weekNumber: note.weekNumber,
            topic: note.topic,
          }}
        />

        <Separator />

        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <PaperclipIcon className="size-4" />
              Resources
            </h2>
            <p className="text-muted-foreground text-sm">
              Files, images, and links shown with this note. Saved as you add them —
              no need to press Save.
            </p>
          </div>
          <NoteAttachmentManager
            noteId={note.id}
            attachments={note.attachments}
            uploadsEnabled={features.uploads}
          />
        </section>
      </div>
    </>
  );
}
