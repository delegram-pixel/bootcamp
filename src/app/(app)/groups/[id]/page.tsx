import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, FileTextIcon, NotebookPenIcon, TrophyIcon } from "lucide-react";

import { getGroupForIntern } from "@/db/queries/groups";
import { requireUser } from "@/lib/authz";
import { dueLabel, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Group" };

export default async function GroupHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const group = await getGroupForIntern(user.id, id);
  if (!group) notFound();

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <PageHeader title={group.name} description={group.description ?? undefined}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/groups/${group.id}/leaderboard`}>
            <TrophyIcon className="size-4" />
            Leaderboard
          </Link>
        </Button>
        <Badge variant="secondary">You’re a {group.roleInGroup} here</Badge>
      </PageHeader>

      <div className="space-y-10">
        {/* Tasks */}
        <section className="space-y-3">
          <SectionHeading icon={FileTextIcon} count={group.assignments.length}>
            Tasks
          </SectionHeading>
          {group.assignments.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="No tasks yet"
              description="When your mentor publishes a task, it shows up here."
            />
          ) : (
            <ul className="space-y-2">
              {group.assignments.map((a) => {
                const due = dueLabel(a.dueAt);
                return (
                  <li key={a.id}>
                    <Link href={`/assignments/${a.id}`} className="block">
                      <Card className="transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.title}</div>
                            <div
                              className={`text-xs ${
                                due.tone === "over"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {due.text}
                              {a.points != null ? ` · ${a.points} pts` : ""}
                            </div>
                          </div>
                          <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="space-y-3">
          <SectionHeading icon={NotebookPenIcon} count={group.notes.length}>
            Notes
          </SectionHeading>
          {group.notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notes shared yet.</p>
          ) : (
            <div className="space-y-4">
              {group.notes.map((note) => (
                <Card key={note.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{note.title}</CardTitle>
                      {note.groupId === null ? (
                        <Badge variant="outline">All groups</Badge>
                      ) : null}
                      {note.weekNumber != null ? (
                        <Badge variant="outline">Week {note.weekNumber}</Badge>
                      ) : null}
                      {note.topic ? <Badge variant="outline">{note.topic}</Badge> : null}
                      <span className="text-muted-foreground ml-auto text-xs">
                        {formatDate(note.createdAt)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Markdown>{note.bodyMd}</Markdown>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
