import Link from "next/link";
import { ChevronRightIcon, RouteIcon } from "lucide-react";

import type { ModulePaths } from "@/db/queries/modules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The modules an intern can act on right now, surfaced on the dashboard.
 *
 * This exists because a quiz score joins the same cumulative pool as a grade, so
 * an attempted-but-failed module reads as "graded" to `progress()` — which would
 * let it quietly disappear from every dashboard bucket while still holding the
 * rest of the path shut. Pulling straight from the gating layer is what keeps
 * "you still need to retake this" visible where the intern actually lands.
 *
 * Only *unlocked* modules qualify: a locked one is blocked behind an earlier
 * unpassed module that is already listed, and one without a quiz can never gate.
 */
export function ModuleAttention({ paths }: { paths: ModulePaths }) {
  const open = paths.cohorts.flatMap((cohort) =>
    cohort.modules
      .filter((m) => m.state === "unlocked" && m.assessmentId != null)
      .map((m) => ({ module: m, cohortName: cohort.group.name })),
  );

  // Nothing actionable → no section at all, rather than an empty shell.
  if (open.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="text-muted-foreground size-4" />
          <h2 className="text-sm font-medium">Your modules</h2>
          <Badge variant="secondary">{open.length}</Badge>
        </div>
        <Link
          href="/notes"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          View the full path
        </Link>
      </div>

      <ul className="space-y-2">
        {open.map(({ module, cohortName }) => (
          <li key={module.id}>
            <Link href={`/notes/${module.id}`} className="block">
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{module.title}</span>
                      <Badge variant={module.attempted ? "destructive" : "secondary"}>
                        {module.attempted
                          ? `Retake — best ${module.bestPct}%`
                          : "Take assessment"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {[
                        cohortName,
                        `${module.questionCount} question${
                          module.questionCount === 1 ? "" : "s"
                        }`,
                        `${module.passPct}% to pass`,
                      ].join(" · ")}
                    </p>
                  </div>
                  <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
