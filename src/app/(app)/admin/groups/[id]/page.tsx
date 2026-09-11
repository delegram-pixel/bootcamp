import Link from "next/link";
import { notFound } from "next/navigation";
import { FileTextIcon, NotebookPenIcon, PlusIcon, UsersIcon } from "lucide-react";

import { getGroupDetail } from "@/db/queries/groups";
import { listAddableUsers } from "@/db/queries/users";
import { formatDate, dueLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { AddMemberDialog } from "@/components/admin/add-member-dialog";
import { MemberActions } from "@/components/admin/member-actions";
import { GroupActions } from "@/components/admin/group-actions";
import { GroupJoinLink } from "@/components/admin/group-join-link";
import { env } from "@/lib/env";

export const metadata = { title: "Group" };

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroupDetail(id);
  if (!group) notFound();

  const addableUsers = await listAddableUsers(id);

  // Mentors first, then interns; alphabetical within each.
  const members = [...group.memberships].sort((a, b) => {
    if (a.roleInGroup !== b.roleInGroup) return a.roleInGroup === "mentor" ? -1 : 1;
    return (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email);
  });

  return (
    <>
      <PageHeader
        title={group.name}
        description={group.description ?? undefined}
      >
        {group.status === "archived" ? <Badge variant="outline">archived</Badge> : null}
        <GroupActions
          group={{ id: group.id, name: group.name, description: group.description, status: group.status }}
          redirectOnDelete
        />
      </PageHeader>

      <div className="mb-6">
        <GroupJoinLink
          groupId={group.id}
          groupName={group.name}
          url={
            group.joinCode
              ? `${env.APP_URL.replace(/\/$/, "")}/join?code=${group.joinCode}`
              : null
          }
        />
      </div>

      {/* Roster */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <UsersIcon className="size-4" />
            Roster
            <span className="text-muted-foreground font-normal">({members.length})</span>
          </h2>
          <AddMemberDialog groupId={group.id} users={addableUsers} />
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No members yet"
            description="Add people who’ve signed up, or share the invite link above."
          />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {m.user.image ? <AvatarImage src={m.user.image} alt="" /> : null}
                          <AvatarFallback className="text-xs">
                            {initials(m.user.name, m.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {m.user.name ?? m.user.email}
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            {m.user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.roleInGroup === "mentor" ? "default" : "secondary"}>
                        {m.roleInGroup}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MemberActions
                        groupId={group.id}
                        userId={m.user.id}
                        name={m.user.name ?? m.user.email}
                        roleInGroup={m.roleInGroup}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Separator className="my-8" />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Tasks */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <FileTextIcon className="size-4" />
              Tasks
              <span className="text-muted-foreground font-normal">
                ({group.assignments.length})
              </span>
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/groups/${group.id}/assignments/new`}>
                <PlusIcon className="size-4" />
                New task
              </Link>
            </Button>
          </div>
          {group.assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks yet.</p>
          ) : (
            <ul className="space-y-2">
              {group.assignments.map((a) => {
                const due = dueLabel(a.dueAt);
                return (
                  <li key={a.id}>
                    <Link href={`/admin/assignments/${a.id}`} className="block">
                      <Card className="transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.title}</div>
                            <div className="text-muted-foreground text-xs">{due.text}</div>
                          </div>
                          <Badge variant={a.status === "published" ? "secondary" : "outline"}>
                            {a.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <NotebookPenIcon className="size-4" />
            Notes
            <span className="text-muted-foreground font-normal">({group.notes.length})</span>
          </h2>
          {group.notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {group.notes.map((n) => (
                <li key={n.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{n.title}</div>
                        <div className="text-muted-foreground text-xs">
                          {n.weekNumber != null ? `Week ${n.weekNumber} · ` : ""}
                          {formatDate(n.createdAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
