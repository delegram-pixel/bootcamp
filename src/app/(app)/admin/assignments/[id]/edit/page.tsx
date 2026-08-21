import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { getAssignmentForEdit } from "@/db/queries/assignments";
import { toDateTimeLocalValue } from "@/lib/format";
import { type AssignmentFormInput } from "@/lib/validations";
import { PageHeader } from "@/components/page-header";
import { AssignmentForm } from "@/components/admin/assignment-form";

export const metadata = { title: "Edit assignment" };

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await getAssignmentForEdit(id);
  if (!assignment) notFound();

  const initial: AssignmentFormInput = {
    title: assignment.title,
    descriptionMd: assignment.descriptionMd,
    dueAt: toDateTimeLocalValue(assignment.dueAt),
    points: assignment.points != null ? String(assignment.points) : "",
    criteria: (assignment.rubric?.criteria ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      maxPoints: c.maxPoints,
      description: c.description ?? "",
    })),
  };

  return (
    <>
      <Link
        href={`/admin/assignments/${assignment.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        {assignment.title}
      </Link>
      <PageHeader title="Edit assignment" description="Changes are visible to interns as soon as you save (if published)." />
      <div className="max-w-3xl">
        <AssignmentForm mode="edit" assignmentId={assignment.id} initial={initial} />
      </div>
    </>
  );
}
