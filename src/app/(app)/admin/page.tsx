import Link from "next/link";
import { inArray, eq } from "drizzle-orm";
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  FileTextIcon,
  LayersIcon,
  UsersIcon,
} from "lucide-react";

import { db } from "@/db";
import { assignments, groups, submissions, users } from "@/db/schema";
import { getGradingQueue } from "@/db/queries/dashboard";
import { fromNow } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const [groupCount, internCount, publishedCount, awaitingCount, queue] =
    await Promise.all([
      db.$count(groups),
      db.$count(users, eq(users.role, "intern")),
      db.$count(assignments, eq(assignments.status, "published")),
      db.$count(submissions, inArray(submissions.status, ["submitted", "late"])),
      getGradingQueue(),
    ]);

  const stats = [
    { label: "Groups", value: groupCount, icon: LayersIcon, href: "/admin/groups" },
    { label: "Interns", value: internCount, icon: UsersIcon, href: "/admin/members" },
    { label: "Published tasks", value: publishedCount, icon: FileTextIcon, href: "/admin/assignments" },
    { label: "Awaiting grading", value: awaitingCount, icon: ClipboardCheckIcon, href: "#needs-grading" },
  ];

  const remaining = awaitingCount - queue.length;

  return (
    <>
      <PageHeader title="Overview" description="A snapshot across every cohort.">
        <Button asChild>
          <Link href="/admin/groups">Manage groups</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className="transition-colors group-hover:border-foreground/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription>{s.label}</CardDescription>
                  <s.icon className="text-muted-foreground size-4" />
                </div>
                <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <section id="needs-grading" className="mt-10 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ClipboardCheckIcon className="size-4" />
          Needs grading
          <span className="text-muted-foreground font-normal">({awaitingCount})</span>
        </h2>

        {queue.length === 0 ? (
          <EmptyState
            icon={CheckCircle2Icon}
            title="All caught up"
            description="No submissions are waiting to be graded."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {queue.map((item) => {
                  const internName =
                    item.intern.name ?? item.intern.email ?? "Intern";
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{internName}</span>
                          {item.status === "late" ? (
                            <Badge variant="destructive">Late</Badge>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="truncate">{item.assignment.title}</span>
                          <span aria-hidden>·</span>
                          <span>{item.assignment.group.name}</span>
                          <span aria-hidden>·</span>
                          <span>
                            submitted{" "}
                            {item.submittedAt ? fromNow(item.submittedAt) : "—"}
                          </span>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href={`/admin/submissions/${item.id}`}>Grade</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {remaining > 0 ? (
          <p className="text-muted-foreground text-sm">
            + {remaining} more awaiting grading — open a task to see its full
            queue.
          </p>
        ) : null}
      </section>
    </>
  );
}
