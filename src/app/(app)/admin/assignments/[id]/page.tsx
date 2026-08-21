import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeftIcon,
  ClipboardListIcon,
  InboxIcon,
  PaperclipIcon,
} from "lucide-react";

import { getAssignmentManage } from "@/db/queries/assignments";
import { getAssignmentRoster } from "@/db/queries/grading";
import { features } from "@/lib/env";
import { dueLabel, formatDateTime, fromNow } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { AssignmentActions } from "@/components/admin/assignment-actions";
import { AttachmentManager } from "@/components/admin/attachment-manager";

export const metadata = { title: "Assignment" };

const SUB_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Draft", variant: "outline" },
  submitted: { label: "Submitted", variant: "secondary" },
  late: { label: "Late", variant: "destructive" },
  graded: { label: "Graded", variant: "default" },
  returned: { label: "Returned", variant: "outline" },
};

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function AssignmentManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await getAssignmentManage(id);
  if (!assignment) notFound();

  const roster = await getAssignmentRoster(id);

  const due = dueLabel(assignment.dueAt);
  const criteria = assignment.rubric?.criteria ?? [];
  const rubricTotal = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  const submissionCount = assignment.submissions.length;
  const scoreDenominator = rubricTotal > 0 ? rubricTotal : assignment.points;

  return (
    <>
      <Link
        href={`/admin/groups/${assignment.groupId}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        {assignment.group.name}
      </Link>

      <PageHeader
        title={assignment.title}
        description={`Created by ${assignment.createdBy.name ?? assignment.createdBy.email}`}
      >
        <Badge variant={assignment.status === "published" ? "secondary" : "outline"}>
          {assignment.status}
        </Badge>
        <AssignmentActions
          assignment={{
            id: assignment.id,
            groupId: assignment.groupId,
            title: assignment.title,
            status: assignment.status,
          }}
        />
      </PageHeader>

      {/* Meta strip */}
      <div className="text-muted-foreground mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span
          className={
            due.tone === "over" ? "text-destructive" : undefined
          }
        >
          {due.text}
        </span>
        <span>{assignment.points != null ? `${assignment.points} points` : "No points set"}</span>
        <span className="inline-flex items-center gap-1">
          <InboxIcon className="size-4" />
          {submissionCount} {submissionCount === 1 ? "submission" : "submissions"}
        </span>
        {assignment.status === "published" && assignment.publishedAt ? (
          <span>Published {formatDateTime(assignment.publishedAt)}</span>
        ) : null}
      </div>

      <div className="space-y-8">
        {/* Submissions grid */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <InboxIcon className="size-4" />
            Submissions
          </h2>
          {!roster || roster.roster.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No interns in this group yet.{" "}
              <Link
                href={`/admin/groups/${assignment.groupId}`}
                className="text-primary underline underline-offset-2"
              >
                Add members
              </Link>
              .
            </p>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.roster.map(({ intern, submission }) => {
                    const meta = submission
                      ? (SUB_STATUS[submission.status] ?? SUB_STATUS.draft)
                      : null;
                    const started = submission && submission.status !== "draft";
                    return (
                      <TableRow key={intern.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              {intern.image ? <AvatarImage src={intern.image} alt="" /> : null}
                              <AvatarFallback className="text-xs">
                                {initials(intern.name, intern.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {intern.name ?? intern.email}
                              </div>
                              <div className="text-muted-foreground truncate text-xs">
                                {intern.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {meta ? (
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not started</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {submission?.submittedAt ? fromNow(submission.submittedAt) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {submission?.grade
                            ? `${submission.grade.score}${scoreDenominator != null ? ` / ${scoreDenominator}` : ""}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {submission && started ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/submissions/${submission.id}`}>
                                {submission.status === "graded" ? "Review" : "Grade"}
                              </Link>
                            </Button>
                          ) : submission ? (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/admin/submissions/${submission.id}`}>View</Link>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <Separator />

        {/* Description */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Description</h2>
          {assignment.descriptionMd.trim() ? (
            <Card>
              <CardContent className="py-4">
                <Markdown>{assignment.descriptionMd}</Markdown>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">
              No description. <Link
                href={`/admin/assignments/${assignment.id}/edit`}
                className="text-primary underline underline-offset-2"
              >Add one</Link>.
            </p>
          )}
        </section>

        <Separator />

        {/* Attachments */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <PaperclipIcon className="size-4" />
            Attachments
          </h2>
          <AttachmentManager
            assignmentId={assignment.id}
            attachments={assignment.attachments}
            uploadsEnabled={features.uploads}
          />
        </section>

        <Separator />

        {/* Rubric */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <ClipboardListIcon className="size-4" />
              Rubric
            </h2>
            {criteria.length > 0 ? (
              <span className="text-muted-foreground text-sm">{rubricTotal} pts total</span>
            ) : null}
          </div>
          {criteria.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No rubric. Grading will be a single score with comments.{" "}
              <Link
                href={`/admin/assignments/${assignment.id}/edit`}
                className="text-primary underline underline-offset-2"
              >
                Add criteria
              </Link>
              .
            </p>
          ) : (
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
          )}
        </section>
      </div>
    </>
  );
}
