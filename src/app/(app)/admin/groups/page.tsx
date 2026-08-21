import Link from "next/link";
import { LayersIcon, UsersIcon, FileTextIcon, ArrowRightIcon } from "lucide-react";

import { listGroupsWithCounts } from "@/db/queries/groups";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CreateGroupDialog } from "@/components/admin/create-group-dialog";
import { GroupActions } from "@/components/admin/group-actions";

export const metadata = { title: "Groups" };

export default async function AdminGroupsPage() {
  const groups = await listGroupsWithCounts();

  return (
    <>
      <PageHeader title="Groups" description="Cohorts you're running.">
        <CreateGroupDialog />
      </PageHeader>

      {groups.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No groups yet"
          description="Create your first cohort to start adding interns and assignments."
        >
          <CreateGroupDialog />
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="leading-tight">
                    <Link href={`/admin/groups/${g.id}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {g.status === "archived" ? (
                      <Badge variant="outline">archived</Badge>
                    ) : null}
                    <GroupActions group={{ id: g.id, name: g.name, description: g.description, status: g.status }} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {g.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{g.description}</p>
                ) : (
                  <p className="text-muted-foreground/60 text-sm italic">No description</p>
                )}
              </CardContent>
              <CardFooter className="text-muted-foreground flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <UsersIcon className="size-4" />
                  {g.internCount} intern{g.internCount === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileTextIcon className="size-4" />
                  {g.assignmentCount}
                </span>
                <Link
                  href={`/admin/groups/${g.id}`}
                  className="text-foreground ml-auto flex items-center gap-1 font-medium hover:underline"
                >
                  Open
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
