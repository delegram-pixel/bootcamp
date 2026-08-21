import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeftIcon,
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
import { dueLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
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
      <Link
        href={`/groups/${assignment.group.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        {assignment.group.name}
      </Link>

      <PageHeader title={assignment.title}>
        {assignment.points != null ? (
          <Badge variant="outline">{assignment.points} pts</Badge>
        ) : null}
      </PageHeader>

      <div
        className={`mb-6 text-sm ${
          due.tone === "over" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {due.text}
      </div>

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
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <PaperclipIcon className="size-4" />
              Attachments
            </h2>
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
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <ClipboardListIcon className="size-4" />
                How you’ll be graded
              </h2>
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
          <GradeSummary
            score={submission.grade.score}
            total={scoreDenominator}
            gradedAt={submission.grade.gradedAt}
            criteria={criteria}
            criterionScores={submission.grade.criterionScores}
          />
        ) : null}

        {/* Discussion — open whenever a submission exists */}
        {submission ? (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <MessagesSquareIcon className="size-4" />
              Discussion
            </h2>
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
