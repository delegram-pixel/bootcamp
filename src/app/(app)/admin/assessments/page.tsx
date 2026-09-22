import Link from "next/link";
import { ClipboardCheckIcon, LayersIcon } from "lucide-react";

import { getAdminAssessments } from "@/db/queries/assessments-admin";
import { requireAdmin } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Assessments" };

/**
 * Every module quiz, per cohort, with how many interns have sat it and how many
 * passed. The number that earns this page its place is the *shortfall* — the
 * interns who haven't taken it — which no other view can show, because a quiz
 * nobody has attempted simply doesn't appear anywhere else.
 */
export default async function AdminAssessmentsPage() {
  await requireAdmin();
  const quizzes = await getAdminAssessments();

  if (quizzes.length === 0) {
    return (
      <>
        <PageHeader
          title="Assessments"
          description="Who has taken each module quiz, and who hasn't."
        />
        <EmptyState
          icon={ClipboardCheckIcon}
          title="No assessments yet"
          description="Add an assessment to a cohort note and it will show up here."
        />
      </>
    );
  }

  // One section per cohort, alphabetical — the same shape the standings page
  // uses, so the two admin views read alike.
  const byCohort = new Map<string, { name: string; items: typeof quizzes }>();
  for (const q of quizzes) {
    const entry = byCohort.get(q.groupId);
    if (entry) entry.items.push(q);
    else byCohort.set(q.groupId, { name: q.groupName, items: [q] });
  }
  const cohorts = [...byCohort.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Who has taken each module quiz, and who hasn't."
      />

      <div className="space-y-10">
        {cohorts.map(([groupId, cohort]) => (
          <section key={groupId} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <LayersIcon className="size-4" />
                {cohort.name}
              </h2>
              <span className="text-muted-foreground text-sm">
                {cohort.items.length} assessment
                {cohort.items.length === 1 ? "" : "s"}
              </span>
            </div>

            <ul className="space-y-2">
              {cohort.items.map((q) => {
                const notTaken = q.internCount - q.takenCount;
                return (
                  <li key={q.assessmentId}>
                    <Link
                      href={`/admin/assessments/${q.assessmentId}`}
                      className="block"
                    >
                      <Card className="hover:border-primary/40 transition-colors">
                        <CardContent className="flex flex-wrap items-center gap-3 py-4">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {q.noteTitle}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {q.questionCount} question
                              {q.questionCount === 1 ? "" : "s"} · {q.total} point
                              {q.total === 1 ? "" : "s"} · {q.passPct}% to pass
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {q.takenCount} of {q.internCount} taken
                          </Badge>
                          <Badge variant="outline">{q.passedCount} passed</Badge>
                          {notTaken > 0 ? (
                            <Badge variant="destructive">
                              {notTaken} not taken
                            </Badge>
                          ) : null}
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
