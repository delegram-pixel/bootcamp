import Link from "next/link";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  LockIcon,
  NotebookPenIcon,
} from "lucide-react";

import type { ModuleListItem, ModulePaths } from "@/db/queries/modules";
import type { ModuleState } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { NoteAttachments } from "@/components/note-attachments";

/** Collapse a flat, ordered module list into its week sections. */
function byWeek(modules: ModuleListItem[]) {
  const weeks = new Map<number, ModuleListItem[]>();
  const general: ModuleListItem[] = [];
  for (const m of modules) {
    if (m.weekNumber == null) general.push(m);
    else weeks.set(m.weekNumber, [...(weeks.get(m.weekNumber) ?? []), m]);
  }
  type Section = {
    key: string;
    label: string;
    weekNumber: number | null;
    items: ModuleListItem[];
  };
  const groups: Section[] = [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, items]) => ({
      key: `week-${weekNumber}`,
      label: `Week ${weekNumber}`,
      weekNumber,
      items,
    }));
  if (general.length) {
    groups.push({
      key: "general",
      label: "General",
      weekNumber: null,
      items: general,
    });
  }
  // Open the newest week — the one an intern is most likely working in.
  const numbered = groups.filter((g) => g.weekNumber != null);
  const defaultOpen = numbered.length
    ? numbered[numbered.length - 1].key
    : groups[0]?.key;
  return { groups, defaultOpen };
}

/**
 * The intern's module path: the whole curriculum, in order, with every title
 * visible and the state of each one shown. Locked modules are listed but not
 * linked — and the detail loader refuses them anyway, so the lock is not just a
 * missing link.
 */
export function ModulePath({ paths }: { paths: ModulePaths }) {
  const hasAnything =
    paths.cohorts.some((c) => c.modules.length > 0) || paths.reference.length > 0;

  if (!hasAnything) {
    return (
      <EmptyState
        icon={NotebookPenIcon}
        title="No modules yet"
        description="Your mentors haven't published any modules yet."
      />
    );
  }

  return (
    <div className="space-y-10">
      {paths.cohorts
        .filter((c) => c.modules.length > 0)
        .map((cohort) => {
          const { groups, defaultOpen } = byWeek(cohort.modules);
          return (
            <section key={cohort.group.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{cohort.group.name}</h2>
                <Badge variant={cohort.passed === cohort.total ? "default" : "secondary"}>
                  {cohort.passed} of {cohort.total} passed
                </Badge>
              </div>

              <div className="rounded-xl border">
                {groups.map((group) => (
                  <details
                    key={group.key}
                    open={group.key === defaultOpen}
                    className="group border-b px-4 last:border-b-0"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                      <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-open:rotate-90" />
                      <span className="font-medium">{group.label}</span>
                      <span className="text-muted-foreground text-sm font-normal">
                        ({group.items.length})
                      </span>
                    </summary>
                    <ol className="space-y-2 pb-4">
                      {group.items.map((m) => (
                        <ModuleRow
                          key={m.id}
                          module={m}
                          // The position within the cohort, so gaps in the stored
                          // `position` don't show up as gaps in the numbering.
                          number={cohort.modules.indexOf(m) + 1}
                        />
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>
          );
        })}

      {paths.reference.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Reference material</h2>
            <Badge variant="outline">Always open</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Shared reading that isn&rsquo;t part of any module path.
          </p>
          <ol className="space-y-2">
            {paths.reference.map((m) => (
              <ModuleRow key={m.id} module={m} number={null} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function stateBadge(module: ModuleListItem) {
  switch (module.state) {
    case "passed":
      return (
        <Badge className="gap-1">
          <CheckCircle2Icon className="size-3" />
          Passed {module.bestPct}%
        </Badge>
      );
    case "unlocked":
      return module.assessmentId ? (
        <Badge variant="secondary">
          {module.attempted ? `Retake — best ${module.bestPct}%` : "Take assessment"}
        </Badge>
      ) : (
        <Badge variant="outline">Reading</Badge>
      );
    case "locked":
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <LockIcon className="size-3" />
          Locked
        </Badge>
      );
  }
}

function ModuleRow({
  module,
  number,
}: {
  module: ModuleListItem;
  number: number | null;
}) {
  const locked = module.state === "locked";

  const inner = (
    <>
      {number != null ? (
        <span
          className={
            locked
              ? "text-muted-foreground w-5 shrink-0 text-sm tabular-nums"
              : "text-muted-foreground w-5 shrink-0 text-sm tabular-nums"
          }
        >
          {number}.
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={
            locked
              ? "text-muted-foreground block truncate font-medium"
              : "block truncate font-medium"
          }
        >
          {module.title}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {[
            module.topic,
            module.assessmentId ? `${module.questionCount} questions` : null,
          ]
            .filter(Boolean)
            .join(" · ") || " "}
        </span>
      </span>
      {stateBadge(module)}
    </>
  );

  if (locked) {
    return (
      <li className="bg-muted/30 text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
        {inner}
      </li>
    );
  }

  // Resources sit *outside* the Link: `NoteAttachments` renders anchors of its
  // own, and an <a> nested inside an <a> is invalid HTML. The row keeps its
  // shape and the chips land just beneath it. Locked modules get none — they
  // can't be opened, so there is nothing to hand over yet.
  return (
    <li className="space-y-2">
      <Link
        href={`/notes/${module.id}`}
        className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
      >
        {inner}
      </Link>
      {module.attachments.length > 0 ? (
        <div className="px-1">
          <NoteAttachments attachments={module.attachments} />
        </div>
      ) : null}
    </li>
  );
}

/** A small end-of-path marker for the module detail page. */
export function NextModuleLink({
  next,
}: {
  next: { id: string; title: string; state: ModuleState } | null;
}) {
  if (!next) return null;
  const locked = next.state === "locked";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">Next up</div>
        <div className={locked ? "text-muted-foreground truncate font-medium" : "truncate font-medium"}>
          {next.title}
        </div>
      </div>
      {locked ? (
        <Badge variant="outline" className="gap-1">
          <LockIcon className="size-3" />
          Pass this module to unlock
        </Badge>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href={`/notes/${next.id}`}>Continue</Link>
        </Button>
      )}
    </div>
  );
}
