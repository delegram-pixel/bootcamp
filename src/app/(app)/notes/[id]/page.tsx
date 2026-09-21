import { notFound } from "next/navigation";
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  LockIcon,
  NotebookPenIcon,
  RotateCcwIcon,
} from "lucide-react";

import { getModuleForIntern } from "@/db/queries/modules";
import { requireUser } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";
import { NoteAttachments } from "@/components/note-attachments";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { BackLink } from "@/components/back-link";
import { AssessmentForm } from "@/components/intern/assessment-form";
import { NextModuleLink } from "@/components/intern/module-path";

export const metadata = { title: "Module" };

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // Gating lives in the loader: a locked module (or one in a cohort the intern
  // isn't in) comes back null, so it is unreachable by URL — not merely hidden.
  const mod = await getModuleForIntern(user.id, id);
  if (!mod) notFound();

  const { note, assessment } = mod;

  return (
    <>
      <BackLink href="/notes">Modules</BackLink>

      <PageHeader title={note.title}>
        {note.group ? <Badge variant="secondary">{note.group.name}</Badge> : null}
        {note.topic ? <Badge variant="outline">{note.topic}</Badge> : null}
        {note.weekNumber != null ? (
          <Badge variant="outline">Week {note.weekNumber}</Badge>
        ) : null}
        {mod.state === "passed" ? (
          <Badge className="gap-1">
            <CheckCircle2Icon className="size-3" />
            Passed {mod.bestPct}%
          </Badge>
        ) : null}
      </PageHeader>

      <div className="max-w-3xl space-y-8">
        {note.bodyMd.trim() ? (
          <Card>
            <CardContent className="py-4">
              <Markdown>{note.bodyMd}</Markdown>
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">
            This module has no reading yet.
          </p>
        )}

        {note.attachments.length > 0 ? (
          <section className="space-y-3">
            <SectionHeading icon={NotebookPenIcon}>Resources</SectionHeading>
            <NoteAttachments attachments={note.attachments} />
          </section>
        ) : null}

        {assessment ? (
          <>
            <Separator />

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeading icon={ClipboardCheckIcon}>
                  Assessment
                </SectionHeading>
                <span className="text-muted-foreground text-sm">
                  {assessment.questions.length} questions · {assessment.total} points
                  · {assessment.passPct}% to pass
                </span>
              </div>

              {mod.attempted ? (
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      Your best attempt: {mod.bestScore}/{mod.bestTotal} ({mod.bestPct}
                      %)
                    </span>
                    <Badge variant={mod.passed ? "default" : "destructive"}>
                      {mod.passed ? "Passed" : "Not passed"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {mod.passed
                      ? "This module is complete. Your best score counts toward your grade."
                      : `You need ${assessment.passPct}% on a single attempt. Retakes are unlimited — only your best score counts.`}
                  </p>
                </div>
              ) : null}

              {/* Passing is the goal, not a lock: the quiz stays reachable behind
                  a disclosure so a passed module reads as done without hiding
                  the retake. */}
              {mod.passed ? (
                <details className="rounded-lg border px-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <RotateCcwIcon className="size-4" />
                    Retake the assessment
                  </summary>
                  <div className="pb-4">
                    <AssessmentForm
                      assessmentId={assessment.id}
                      questions={assessment.questions}
                      passPct={assessment.passPct}
                    />
                  </div>
                </details>
              ) : (
                <AssessmentForm
                  assessmentId={assessment.id}
                  questions={assessment.questions}
                  passPct={assessment.passPct}
                />
              )}
            </section>
          </>
        ) : note.groupId != null ? (
          <>
            <Separator />
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <NotebookPenIcon className="size-4" />
              This module has no assessment — it&rsquo;s reading only, so it
              can&rsquo;t hold you up.
            </p>
          </>
        ) : null}

        <NextModuleLink next={mod.next} />

        {mod.state === "unlocked" && assessment && !mod.passed ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <LockIcon className="size-3" />
            Pass this assessment to unlock the next module.
          </p>
        ) : null}
      </div>
    </>
  );
}
