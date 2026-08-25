import { notFound } from "next/navigation";
import {
  ClipboardListIcon,
  FileIcon,
  LinkIcon,
  MessagesSquareIcon,
  PaperclipIcon,
} from "lucide-react";

import { getAssignmentForIntern } from "@/db/queries/assignments";
import { getMySubmission } from "@/db/queries/submissions";
import { requireUser } from "@/lib/authz";
import { features } from "@/lib/env";
import { dueLabel, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { BackLink } from "@/components/back-link";
import { SubmissionComposer } from "@/components/intern/submission-composer";
import { GradeSummary } from "@/components/submission/grade-summary";
import { CommentThread } from "@/components/submission/comment-thread";

export const metadata = { title: "Assignment" };

export default async function AssignmentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const assignment = await getAssignmentForIntern(user.id, id);
  if (!assignment) notFound();

  const submission = await getMySubmission(user.id, id);

  const due = dueLabel(assignment.dueAt);
  const criteria = assignment.rubric?.criteria ?? [];
  const rubricTotal = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  const scoreDenominator = rubricTotal > 0 ? rubricTotal : assignment.points;

  return (
    <>
      <BackLink href={`/groups/${assignment.group.id}`}>
        {assignment.group.name}
      </BackLink>

      <PageHeader title={assignment.title}>
        {assignment.points != null ? (
          <Badge variant="outline">{assignment.points} pts</Badge>
        ) : null}
      </PageHeader>

      {assignment.dueAt ? (
        <div className="mb-6 space-y-2">
          <Countdown dueAtMs={assignment.dueAt.getTime()} />
          <div className="text-muted-foreground text-xs">
            Due {formatDateTime(assignment.dueAt)}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground mb-6 text-sm">No due date</div>
      )}

      <div className="space-y-8">
        {/* Instructions */}
        {assignment.descriptionMd.trim() ? (
          <Card>
            <CardContent className="py-4">
              <Markdown>{assignment.descriptionMd}</Markdown>
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">
            No instructions were added for this assignment.
          </p>
        )}

        {/* Attachments */}
        {assignment.attachments.length > 0 ? (
          <section className="space-y-3">
            <SectionHeading icon={PaperclipIcon}>Attachments</SectionHeading>
            <ul className="divide-y rounded-lg border">
              {assignment.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  {a.kind === "file" ? (
                    <FileIcon className="text-muted-foreground size-4 shrink-0" />
                  ) : (
                    <LinkIcon className="text-muted-foreground size-4 shrink-0" />
                  )}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary truncate text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Rubric */}
        {criteria.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeading icon={ClipboardListIcon}>
                How you’ll be graded
              </SectionHeading>
              <span className="text-muted-foreground text-sm">{rubricTotal} pts total</span>
            </div>
            <ul className="divide-y rounded-lg border">
              {criteria.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{c.label}</div>
                    {c.description ? (
                      <div className="text-muted-foreground text-sm">{c.description}</div>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {c.maxPoints} pts
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Separator />

        {/* Submission */}
        <SubmissionComposer
          assignmentId={assignment.id}
          status={submission?.status ?? null}
          submittedAt={submission?.submittedAt ?? null}
          items={submission?.items ?? []}
          uploadsEnabled={features.uploads}
          dueOver={due.tone === "over"}
        />

        {/* Grade — shown once the mentor has graded */}
        {submission?.grade ? (
          <div id="grade" className="scroll-mt-24">
            <GradeSummary
              score={submission.grade.score}
              total={scoreDenominator}
              gradedAt={submission.grade.gradedAt}
              criteria={criteria}
              criterionScores={submission.grade.criterionScores}
            />
          </div>
        ) : null}

        {/* Discussion — open whenever a submission exists */}
        {submission ? (
          <section id="discussion" className="scroll-mt-24 space-y-3">
            <SectionHeading icon={MessagesSquareIcon}>Discussion</SectionHeading>
            <CommentThread
              submissionId={submission.id}
              comments={submission.comments}
              currentUserId={user.id}
              canComment
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
