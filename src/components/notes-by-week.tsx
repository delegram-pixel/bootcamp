import { ChevronRightIcon } from "lucide-react";

import type { NoteAttachment } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { NoteAttachments } from "@/components/note-attachments";
import { NoteActions } from "@/components/admin/note-actions";

/** A note row as returned by the notes queries (with its group joined in). */
type NoteWithGroup = {
  id: string;
  groupId: string | null;
  title: string;
  bodyMd: string;
  weekNumber: number | null;
  topic: string | null;
  createdAt: Date;
  group: { name: string } | null;
  attachments: NoteAttachment[];
};

type WeekGroup = {
  key: string;
  label: string;
  weekNumber: number | null;
  notes: NoteWithGroup[];
};

/**
 * Groups notes into collapsible week sections, ordered by week ascending
 * (Week 1 before Week 2 regardless of post time). Weekless notes fall into a
 * "General" section shown last. The highest week is open by default.
 */
export function NotesByWeek({
  notes,
  isAdmin,
}: {
  notes: NoteWithGroup[];
  isAdmin: boolean;
}) {
  const byWeek = new Map<number, NoteWithGroup[]>();
  const general: NoteWithGroup[] = [];
  for (const note of notes) {
    if (note.weekNumber == null) {
      general.push(note);
    } else {
      const arr = byWeek.get(note.weekNumber) ?? [];
      arr.push(note);
      byWeek.set(note.weekNumber, arr);
    }
  }

  const groups: WeekGroup[] = [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, weekNotes]) => ({
      key: `week-${weekNumber}`,
      label: `Week ${weekNumber}`,
      weekNumber,
      notes: weekNotes,
    }));

  if (general.length) {
    groups.push({ key: "general", label: "General", weekNumber: null, notes: general });
  }

  // Open the highest-numbered week by default; if there are none, open General.
  const numbered = groups.filter((g) => g.weekNumber != null);
  const defaultOpenKey = numbered.length
    ? numbered[numbered.length - 1].key
    : groups[0]?.key;

  return (
    <div className="rounded-xl border">
      {groups.map((group) => (
        <details
          key={group.key}
          open={group.key === defaultOpenKey}
          className="group border-b px-4 last:border-b-0"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
            <span className="font-medium">{group.label}</span>
            <span className="text-muted-foreground text-sm font-normal">
              ({group.notes.length})
            </span>
          </summary>
          <div className="space-y-4 pb-4">
            {group.notes.map((note) => (
              <Card key={note.id} className="shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{note.title}</CardTitle>
                    <Badge variant={note.group ? "secondary" : "outline"}>
                      {note.group ? note.group.name : "All groups"}
                    </Badge>
                    {note.topic ? <Badge variant="outline">{note.topic}</Badge> : null}
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatDate(note.createdAt)}
                    </span>
                    {isAdmin ? (
                      <NoteActions note={{ id: note.id, title: note.title }} />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {note.bodyMd.trim() ? <Markdown>{note.bodyMd}</Markdown> : null}
                  <NoteAttachments attachments={note.attachments} />
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
