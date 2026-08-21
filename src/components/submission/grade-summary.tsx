import { CheckCircle2Icon } from "lucide-react";

import { fromNow } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

type Criterion = {
  id: string;
  label: string;
  description: string | null;
  maxPoints: number;
};

type Score = { criterionId: string; points: number; comment: string | null };

/**
 * Read-only grade breakdown shown to the intern (and reusable elsewhere). When
 * the assignment has a rubric, it lists each criterion's points + comment; with
 * no rubric it's a single overall score. `total` is the denominator (rubric sum
 * or the assignment's points).
 */
export function GradeSummary({
  score,
  total,
  gradedAt,
  criteria,
  criterionScores,
}: {
  score: number;
  total: number | null;
  gradedAt: Date | null;
  criteria: Criterion[];
  criterionScores: Score[];
}) {
  const byCriterion = new Map(criterionScores.map((s) => [s.criterionId, s]));

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-500" />
          Grade
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{score}</span>
          {total != null ? (
            <span className="text-muted-foreground text-sm">/ {total} pts</span>
          ) : (
            <span className="text-muted-foreground text-sm">pts</span>
          )}
        </div>
      </div>

      {criteria.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {criteria.map((c) => {
            const s = byCriterion.get(c.id);
            return (
              <li key={c.id} className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    {c.description ? (
                      <div className="text-muted-foreground text-xs">{c.description}</div>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {s ? s.points : 0} / {c.maxPoints}
                  </Badge>
                </div>
                {s?.comment ? (
                  <p className="text-muted-foreground text-sm">{s.comment}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {gradedAt ? (
        <p className="text-muted-foreground text-xs">Graded {fromNow(gradedAt)}</p>
      ) : null}
    </div>
  );
}
