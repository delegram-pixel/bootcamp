import { AlertTriangleIcon, LayersIcon, TrophyIcon } from "lucide-react";

import { getAdminCohortStandings } from "@/db/queries/scoring";
import { requireAdmin } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Standings" };

export default async function AdminStandingsPage() {
  await requireAdmin();
  const cohorts = await getAdminCohortStandings();

  const totalAtRisk = cohorts.reduce((sum, c) => sum + c.atRiskCount, 0);

  if (cohorts.length === 0) {
    return (
      <>
        <PageHeader
          title="Standings"
          description="Every cohort, ranked by XP, with at-risk interns flagged."
        />
        <EmptyState
          icon={TrophyIcon}
          title="No cohorts yet"
          description="Create a group and publish assignments to start tracking standings."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Standings"
        description="Every cohort, ranked by XP, with at-risk interns flagged."
      >
        {totalAtRisk > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangleIcon className="size-3" />
            {totalAtRisk} at risk
          </Badge>
        ) : null}
      </PageHeader>

      <div className="space-y-10">
        {cohorts.map((c) => (
          <section key={c.groupId} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <LayersIcon className="size-4" />
                {c.groupName}
              </h2>
              <span className="text-muted-foreground text-sm">
                {c.internCount} intern{c.internCount === 1 ? "" : "s"}
              </span>
              {c.status === "archived" ? (
                <Badge variant="outline">Archived</Badge>
              ) : null}
              {c.atRiskCount > 0 ? (
                <Badge variant="destructive" className="ml-auto gap-1">
                  <AlertTriangleIcon className="size-3" />
                  {c.atRiskCount} at risk
                </Badge>
              ) : null}
            </div>

            {c.entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No interns in this cohort yet.
              </p>
            ) : (
              <LeaderboardTable rows={c.entries} showRisk />
            )}
          </section>
        ))}
      </div>
    </>
  );
}
