import Link from "next/link";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  LayersIcon,
  ListTodoIcon,
  SparklesIcon,
} from "lucide-react";

import { getInternDashboard, type InternAssignmentItem } from "@/db/queries/dashboard";
import { getMyGroups } from "@/db/queries/groups";
import { requireUser } from "@/lib/authz";
import { dueLabel } from "@/lib/format";
import {
  internActionState,
  needsAction,
  submissionStatusMeta,
} from "@/lib/submission-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Dashboard" };

function StatusBadge({ item }: { item: InternAssignmentItem }) {
  if (item.status === null) {
    return <Badge variant="outline">Not started</Badge>;
  }
  const meta = submissionStatusMeta[item.status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function AssignmentRow({
  item,
  showScore = false,
}: {
  item: InternAssignmentItem;
  showScore?: boolean;
}) {
  const due = dueLabel(item.dueAt);
  return (
    <li>
      <Link href={`/assignments/${item.id}`} className="block">
        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{item.title}</span>
                <StatusBadge item={item} />
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span>{item.groupName}</span>
                <span aria-hidden>·</span>
                <span className={due.tone === "over" ? "text-destructive" : undefined}>
                  {due.text}
                </span>
                {showScore && item.score != null ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-foreground font-medium">
                      Scored {item.score}
                      {item.points != null ? `/${item.points}` : ""}
                    </span>
                  </>
                ) : item.points != null ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{item.points} pts</span>
                  </>
                ) : null}
              </div>
            </div>
            <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}

function SectionHeading({
  icon: Icon,
  children,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-medium">
      <Icon className="size-4" />
      {children}
      {count != null ? (
        <span className="text-muted-foreground font-normal">({count})</span>
      ) : null}
    </h2>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [items, groups] = await Promise.all([
    getInternDashboard(user.id),
    getMyGroups(user.id),
  ]);

  const firstName = user.name?.split(" ")[0];
  const attention = items.filter((i) => needsAction(internActionState(i.status)));
  const awaiting = items.filter((i) => internActionState(i.status) === "awaiting");
  const graded = items.filter((i) => internActionState(i.status) === "graded");

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Dashboard"}
        description="What needs your attention, and where your work stands."
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No groups yet"
          description="An admin will add you to a group soon. Check back later."
        />
      ) : (
        <div className="space-y-10">
          {/* What's due */}
          <section className="space-y-3">
            <SectionHeading icon={ListTodoIcon} count={attention.length}>
              Needs your attention
            </SectionHeading>
            {attention.length === 0 ? (
              <EmptyState
                icon={SparklesIcon}
                title="You're all caught up"
                description="Nothing due right now. New assignments will show up here."
              />
            ) : (
              <ul className="space-y-2">
                {attention.map((item) => (
                  <AssignmentRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          {/* Awaiting feedback */}
          {awaiting.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading icon={ClockIcon} count={awaiting.length}>
                Awaiting feedback
              </SectionHeading>
              <ul className="space-y-2">
                {awaiting.map((item) => (
                  <AssignmentRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Graded */}
          {graded.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading icon={CheckCircle2Icon} count={graded.length}>
                Graded
              </SectionHeading>
              <ul className="space-y-2">
                {graded.map((item) => (
                  <AssignmentRow key={item.id} item={item} showScore />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Groups */}
          <section className="space-y-3">
            <SectionHeading icon={LayersIcon}>Your groups</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="block">
                  <Card className="hover:border-primary/40 h-full transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>{g.name}</CardTitle>
                        <Badge variant={g.status === "active" ? "secondary" : "outline"}>
                          {g.status}
                        </Badge>
                      </div>
                      {g.description ? (
                        <CardDescription className="line-clamp-2">
                          {g.description}
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
