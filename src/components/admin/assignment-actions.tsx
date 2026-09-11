"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  MoreVerticalIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteAssignment,
  publishAssignment,
  unpublishAssignment,
} from "@/lib/actions/assignments";
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

type Assignment = {
  id: string;
  groupId: string;
  title: string;
  status: "draft" | "published";
};

export function AssignmentActions({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const published = assignment.status === "published";

  function togglePublish() {
    startTransition(async () => {
      const res = published
        ? await unpublishAssignment({ id: assignment.id })
        : await publishAssignment({ id: assignment.id });
      if (res.ok) toast.success(res.message ?? "Updated");
      else toast.error(res.error);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteAssignment({ id: assignment.id });
      if (res.ok) {
        toast.success(res.message ?? "Task deleted");
        setConfirmOpen(false);
        router.push(`/admin/groups/${assignment.groupId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant={published ? "outline" : "default"}
        onClick={togglePublish}
        disabled={pending}
      >
        {published ? (
          <>
            <Undo2Icon className="size-4" />
            Unpublish
          </>
        ) : (
          <>
            <SendIcon className="size-4" />
            Publish
          </>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Task actions">
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/assignments/${assignment.id}/edit`}>
              <PencilIcon className="size-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{assignment.title}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the task, its rubric, attachments, and
              any submissions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
