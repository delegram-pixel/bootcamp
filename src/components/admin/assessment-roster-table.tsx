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
import { formatDate } from "@/lib/format";
import type { RosterRow } from "@/db/queries/assessments-admin";

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * Every intern in a quiz's cohort, takers first. Server component — Table and
 * Avatar are the only client bits.
 *
 * The point of this table is the *bottom* of it: interns who haven't sat the
 * quiz at all. They start from membership rather than from attempts, so a
 * non-taker is a row with an em-dash instead of an absence, and the "Not taken"
 * badge says so in words — the muted styling is reinforcement, not the signal.
 */
export function AssessmentRosterTable({ rows }: { rows: RosterRow[] }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Intern</TableHead>
            <TableHead className="text-right">Best</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Result</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            <TableHead className="text-right">Last sat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    {r.image ? <AvatarImage src={r.image} alt="" /> : null}
                    <AvatarFallback className="text-xs">
                      {initials(r.name, r.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.name ?? r.email}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {r.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.bestPct == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  `${r.bestPct}%`
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {r.bestScore == null ? "—" : `${r.bestScore}/${r.bestTotal}`}
              </TableCell>
              <TableCell className="text-right">
                {r.attempts === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not taken
                  </Badge>
                ) : r.passed ? (
                  <Badge>Passed</Badge>
                ) : (
                  <Badge variant="destructive">Not passed</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.attempts === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  r.attempts
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-sm">
                {r.lastAttemptAt ? formatDate(r.lastAttemptAt) : "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
