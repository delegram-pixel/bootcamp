"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVerticalIcon, PencilIcon, ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteGroup, setGroupStatus } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditGroupDialog } from "@/components/admin/edit-group-dialog";

type Group = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
};

export function GroupActions({
  group,
  redirectOnDelete = false,
}: {
  group: Group;
  redirectOnDelete?: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const archived = group.status === "archived";

  function toggleArchive() {
    startTransition(async () => {
      const res = await setGroupStatus({
        id: group.id,
        status: archived ? "active" : "archived",
      });
      if (res.ok) toast.success(res.message ?? "Updated");
      else toast.error(res.error);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteGroup({ id: group.id });
      if (res.ok) {
        toast.success(res.message ?? "Group deleted");
        setConfirmOpen(false);
        if (redirectOnDelete) router.push("/admin/groups");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Group actions">
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <PencilIcon className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleArchive} disabled={pending}>
            {archived ? (
              <>
                <ArchiveRestoreIcon className="size-4" />
                Restore
              </>
            ) : (
              <>
                <ArchiveIcon className="size-4" />
                Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditGroupDialog group={group} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{group.name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the group and everything in it — memberships,
              assignments, submissions, and grades. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
