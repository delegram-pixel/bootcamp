import Link from "next/link";
import { NotebookPenIcon, PlusIcon } from "lucide-react";

import { getNotesForUser, listAllNotes } from "@/db/queries/notes";
import { listGroups } from "@/db/queries/groups";
import { requireUser } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { NoteActions } from "@/components/admin/note-actions";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const [notes, groups] = await Promise.all([
    isAdmin ? listAllNotes() : getNotesForUser(user.id),
    isAdmin ? listGroups() : Promise.resolve([]),
  ]);
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

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
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{note.title}</CardTitle>
                  <Badge variant={note.group ? "secondary" : "outline"}>
                    {note.group ? note.group.name : "All groups"}
                  </Badge>
                  {note.week ? <Badge variant="outline">{note.week}</Badge> : null}
                  {note.topic ? <Badge variant="outline">{note.topic}</Badge> : null}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {formatDate(note.createdAt)}
                  </span>
                  {isAdmin ? (
                    <NoteActions
                      note={{
                        id: note.id,
                        title: note.title,
                        bodyMd: note.bodyMd,
                        groupId: note.groupId,
                        week: note.week,
                        topic: note.topic,
                      }}
                      groups={groupOptions}
                    />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <Markdown>{note.bodyMd}</Markdown>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
