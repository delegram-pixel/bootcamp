import { notFound } from "next/navigation";
import { UsersIcon } from "lucide-react";

import { getAdminAssessmentRoster } from "@/db/queries/assessments-admin";
import { requireAdmin } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { AssessmentRosterTable } from "@/components/admin/assessment-roster-table";

export const metadata = { title: "Assessment" };

export default async function AdminAssessmentRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const roster = await getAdminAssessmentRoster(id);
  if (!roster) notFound();

  const { assessment, rows, takenCount, passedCount } = roster;
  const notTaken = rows.length - takenCount;

  return (
    <>
      <BackLink href="/admin/assessments">Assessments</BackLink>

      <PageHeader
        title={assessment.noteTitle}
        description={`${assessment.questionCount} question${
          assessment.questionCount === 1 ? "" : "s"
        } · ${assessment.total} point${
          assessment.total === 1 ? "" : "s"
        } · ${assessment.passPct}% to pass`}
      >
        <Badge variant="secondary">{assessment.groupName}</Badge>
        <Badge variant="outline">
          {takenCount} of {rows.length} taken
        </Badge>
        <Badge variant="outline">{passedCount} passed</Badge>
        {notTaken > 0 ? (
          <Badge variant="destructive">{notTaken} not taken</Badge>
        ) : null}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No interns in this cohort"
          description="Once interns join the cohort they'll be listed here, taken or not."
        />
      ) : (
        <AssessmentRosterTable rows={rows} />
      )}
    </>
  );
}
