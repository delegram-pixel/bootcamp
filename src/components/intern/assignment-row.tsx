import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import type { InternAssignmentItem } from "@/db/queries/dashboard";
import { dueLabel } from "@/lib/format";
import { submissionStatusMeta } from "@/lib/submission-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function StatusBadge({ item }: { item: InternAssignmentItem }) {
  if (item.status === null) {
    return <Badge variant="outline">Not started</Badge>;
  }
  const meta = submissionStatusMeta[item.status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/**
 * A single assignment as a tappable card row: title + status, then group, due
 * date, and points (or the score once graded). Shared by the dashboard and the
 * Assignments page so a row means the same thing wherever it appears.
 */
export function AssignmentRow({
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
        <Card className="hover:border-primary/40 transition-colors">
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
