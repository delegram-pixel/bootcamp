import Link from "next/link";
import { ClipboardListIcon, FileTextIcon, PlusIcon } from "lucide-react";

import { listAssignmentsByGroupForAdmin } from "@/db/queries/assignments";
import { dueLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";

export const metadata = { title: "Tasks" };

// Admin is enforced by the /admin layout; this page just reads and groups.
export default async function AdminAssignmentsPage() {
  const groups = await listAssignmentsByGroupForAdmin();

  // Active cohorts first, archived last; alphabetical within each (the query
  // already sorts by name, and Array.sort is stable).
  const ordered = [...groups].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "archived" ? 1 : -1,
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Every task across your cohorts, and what's waiting to be graded."
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={ClipboardListIcon}
          title="No cohorts yet"
          description="Create a group first, then you can add tasks to it."
        />
      ) : (
        <div className="space-y-10">
          {ordered.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SectionHeading icon={FileTextIcon} count={group.assignments.length}>
                    {group.name}
                  </SectionHeading>
                  {group.status === "archived" ? (
                    <Badge variant="outline">archived</Badge>
                  ) : null}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/groups/${group.id}/assignments/new`}>
                    <PlusIcon className="size-4" />
                    New task
                  </Link>
                </Button>
              </div>

              {group.assignments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tasks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {group.assignments.map((a) => {
                    const due = dueLabel(a.dueAt);
                    const awaiting = a.submissions.filter(
                      (s) => s.status === "submitted" || s.status === "late",
                    ).length;
                    const graded = a.submissions.filter(
                      (s) => s.status === "graded",
                    ).length;
                    return (
                      <li key={a.id}>
                        <Link href={`/admin/assignments/${a.id}`} className="block">
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
                              <div className="flex shrink-0 items-center gap-2">
                                {awaiting > 0 ? (
                                  <Badge>{awaiting} to grade</Badge>
                                ) : graded > 0 ? (
                                  <span className="text-muted-foreground text-xs">
                                    all graded
                                  </span>
                                ) : null}
                                <Badge
                                  variant={
                                    a.status === "published" ? "secondary" : "outline"
                                  }
                                >
                                  {a.status}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
