import Link from "next/link";
import { UsersIcon } from "lucide-react";

import { listUsersWithGroups } from "@/db/queries/users";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { InviteInternDialog } from "@/components/admin/invite-intern-dialog";

export const metadata = { title: "Members" };

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function AdminMembersPage() {
  const users = await listUsersWithGroups();

  return (
    <>
      <PageHeader title="Members" description="Everyone across your cohorts.">
        <InviteInternDialog />
      </PageHeader>

      {users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No members yet"
          description="Invite an intern to get started."
        >
          <InviteInternDialog />
        </EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Groups</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {u.image ? <AvatarImage src={u.image} alt="" /> : null}
                        <AvatarFallback className="text-xs">
                          {initials(u.name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name ?? u.email}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.groups.length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.groups.map((g) => (
                          <Link key={g.id} href={`/admin/groups/${g.id}`}>
                            <Badge variant="outline" className="hover:bg-accent">
                              {g.name}
                              <span className="text-muted-foreground ml-1">
                                · {g.roleInGroup}
                              </span>
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
