import { notFound } from "next/navigation";
import { TrophyIcon } from "lucide-react";

import { getCohortLeaderboard } from "@/db/queries/scoring";
import { requireUser } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Leaderboard" };

export default async function CohortLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const board = await getCohortLeaderboard(user.id, id);
  if (!board) notFound();

  return (
    <>
      <BackLink href={`/groups/${board.group.id}`}>{board.group.name}</BackLink>
      <PageHeader
        title="Leaderboard"
        description={`${board.group.name} · ranked by XP earned across this cohort.`}
      />

      {board.entries.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="No interns yet"
          description="Once interns join this cohort and start earning XP, they'll be ranked here."
        />
      ) : (
        <LeaderboardTable rows={board.entries} />
      )}
    </>
  );
}
