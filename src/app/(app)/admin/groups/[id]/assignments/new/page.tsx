import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { getGroup } from "@/db/queries/groups";
import { PageHeader } from "@/components/page-header";
import { AssignmentForm } from "@/components/admin/assignment-form";

export const metadata = { title: "New assignment" };

export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  return (
    <>
      <Link
        href={`/admin/groups/${group.id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        {group.name}
      </Link>
      <PageHeader
        title="New assignment"
        description={`Create a draft for ${group.name}. It stays hidden from interns until you publish it.`}
      />
      <div className="max-w-3xl">
        <AssignmentForm mode="create" groupId={group.id} />
      </div>
    </>
  );
}
