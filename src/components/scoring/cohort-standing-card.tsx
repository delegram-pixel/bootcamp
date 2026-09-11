import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { type LeaderboardEntry } from "@/db/queries/scoring";
import {
  LeaderboardTable,
  type LeaderboardRow,
} from "@/components/scoring/leaderboard-table";

/** How many top ranks to show before the viewer's own row. */
const TOP_N = 3;

/**
 * A dashboard-sized slice of one cohort's leaderboard: the top few, plus the
 * viewer's own row when they sit outside the top. Ranks are the real cohort
 * ranks, so a jump (3 → 7) shows the viewer exactly where they stand. The full
 * board is one click away.
 */
export function CohortStandingCard({
  groupId,
  groupName,
  entries,
}: {
  groupId: string;
  groupName: string;
  entries: LeaderboardEntry[];
}) {
  const top = entries.slice(0, TOP_N);
  const viewer = entries.find((e) => e.isViewer);
  // Append the viewer's row only when they're not already in the top slice.
  const rows: LeaderboardRow[] =
    viewer && !top.some((e) => e.isViewer) ? [...top, viewer] : top;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-sm font-medium">{groupName}</h3>
        <Link
          href={`/groups/${groupId}/leaderboard`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-sm"
        >
          Full leaderboard
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      <LeaderboardTable rows={rows} />
    </div>
  );
}
