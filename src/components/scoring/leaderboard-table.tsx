import { AlertTriangleIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/scoring/info-hint";

/** The subset of a leaderboard/standing entry this table renders. */
export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  xp: number;
  level: number;
  gradePct: number | null;
  isViewer?: boolean;
  /** Admin standings only: past-due work + the at-risk flag. */
  overdue?: number;
  atRisk?: boolean;
};

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * A cohort ranked by XP. One series of numbers per person, so a plain table
 * reads better than any chart. The viewer's own row is highlighted; when
 * `showRisk` is set (admin standings) an extra column surfaces overdue work and
 * the at-risk flag. Server component — Table/Avatar are the only client bits.
 */
export function LeaderboardTable({
  rows,
  showRisk = false,
}: {
  rows: LeaderboardRow[];
  showRisk?: boolean;
}) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Intern</TableHead>
            <TableHead className="text-right">Level</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center justify-end gap-1">
                Grade
                <InfoHint label="How grade is calculated">
                  Points earned ÷ points possible across graded work.
                  Assignments with no point value are excluded.
                </InfoHint>
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center justify-end gap-1">
                XP
                <InfoHint label="How XP and ranking work">
                  Ranked by XP — the points scored, plus bonuses for on-time
                  (+10) and perfect (+25) work. It rewards volume, so more graded
                  work can outrank a higher grade&nbsp;%.
                </InfoHint>
              </span>
            </TableHead>
            {showRisk ? (
              <TableHead className="text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  Status
                  <InfoHint label="What at-risk means">
                    Flagged at-risk when the overall grade is under 60%, or 2 or
                    more assignments are overdue.
                  </InfoHint>
                </span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.userId}
              className={cn(r.isViewer && "bg-muted/50")}
              data-state={r.isViewer ? "selected" : undefined}
            >
              <TableCell className="text-center font-medium tabular-nums">
                {r.rank}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    {r.image ? <AvatarImage src={r.image} alt="" /> : null}
                    <AvatarFallback className="text-xs">
                      {initials(r.name, r.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {r.name ?? r.email}
                      </span>
                      {r.isViewer ? (
                        <Badge variant="secondary" className="shrink-0">
                          You
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {r.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.level}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.gradePct == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${r.gradePct}%`
                )}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {r.xp}
              </TableCell>
              {showRisk ? (
                <TableCell className="text-right">
                  {r.atRisk ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangleIcon className="size-3" />
                      At risk
                      {r.overdue && r.overdue > 0 ? (
                        <span className="tabular-nums">· {r.overdue} overdue</span>
                      ) : null}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">On track</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
