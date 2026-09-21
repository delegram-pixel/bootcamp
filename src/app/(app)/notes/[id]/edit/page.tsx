import { notFound } from "next/navigation";
import { ClipboardCheckIcon, PaperclipIcon } from "lucide-react";

import { getNote } from "@/db/queries/notes";
import { listGroups } from "@/db/queries/groups";
import { requireAdmin } from "@/lib/authz";
import { features } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { Separator } from "@/components/ui/separator";
import { NoteForm } from "@/components/admin/note-form";
import { NoteAttachmentManager } from "@/components/admin/note-attachment-manager";
import { AssessmentEditor } from "@/components/admin/assessment-editor";

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
  const isCohort = note.groupId != null;

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
            position: note.position,
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

        <Separator />

        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <ClipboardCheckIcon className="size-4" />
              Assessment
            </h2>
            <p className="text-muted-foreground text-sm">
              {isCohort ? (
                <>
                  A quiz at the end of this module. Interns must reach the pass
                  mark to unlock the next one, and their best score counts toward
                  their grade. Saved as you edit — no need to press Save.
                </>
              ) : (
                <>
                  Global notes are shared reference reading, so they sit outside
                  every cohort&rsquo;s path and can&rsquo;t carry a quiz. Set an
                  audience above to give this note a path to gate.
                </>
              )}
            </p>
          </div>
          {isCohort ? (
            <AssessmentEditor
              noteId={note.id}
              assessment={
                note.assessment
                  ? {
                      id: note.assessment.id,
                      passPct: note.assessment.passPct,
                      questions: note.assessment.questions.map((q) => ({
                        id: q.id,
                        prompt: q.prompt,
                        points: q.points,
                        options: q.options.map((o) => ({
                          id: o.id,
                          label: o.label,
                          isCorrect: o.isCorrect,
                        })),
                      })),
                    }
                  : null
              }
            />
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              Audience is currently <span className="text-foreground">All groups</span>.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
