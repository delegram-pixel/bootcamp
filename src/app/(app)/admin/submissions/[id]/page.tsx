import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, MessagesSquareIcon } from "lucide-react";

import { getSubmissionForGrading } from "@/db/queries/grading";
import { requireUser } from "@/lib/authz";
import { formatDateTime } from "@/lib/format";
import { submissionStatusMeta } from "@/lib/submission-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { GradingForm } from "@/components/admin/grading-form";
import { CommentThread } from "@/components/submission/comment-thread";
import { SubmissionItemList } from "@/components/submission/submission-item-list";

export const metadata = { title: "Grade submission" };

export default async function GradeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const submission = await getSubmissionForGrading(id);
  if (!submission) notFound();

  const { assignment, intern } = submission;
  const criteria = assignment.rubric?.criteria ?? [];
  const statusMeta = submissionStatusMeta[submission.status];
  const internName = intern.name ?? intern.email ?? "Intern";

  return (
    <>
      <Link
        href={`/admin/assignments/${assignment.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        {assignment.title}
      </Link>

      <PageHeader title={internName} description={assignment.title}>
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
      </PageHeader>

      <div className="text-muted-foreground mb-6 text-sm">
        {submission.submittedAt
          ? `Submitted ${formatDateTime(submission.submittedAt)}`
          : "Not submitted yet"}
      </div>

      <div className="space-y-8">
        {/* Submitted work */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Submitted work</h2>
          <SubmissionItemList items={submission.items} />
        </section>

        <Separator />

        {/* Grade */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium">
            {submission.grade ? "Grade" : "Grade this submission"}
          </h2>
          <Card>
            <CardContent className="py-4">
              <GradingForm
                submissionId={submission.id}
                criteria={criteria}
                points={assignment.points}
                status={submission.status}
                existing={
                  submission.grade
                    ? {
                        score: submission.grade.score,
                        criterionScores: submission.grade.criterionScores,
                      }
                    : null
                }
              />
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Discussion */}
        <section id="discussion" className="scroll-mt-24 space-y-3">
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
      </div>
    </>
  );
}
