"use client";

import { useState, useTransition } from "react";
import { MoreVerticalIcon, ArrowUpDownIcon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";

import { removeMember, updateMemberRole } from "@/lib/actions/members";
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

export function MemberActions({
  groupId,
  userId,
  name,
  roleInGroup,
}: {
  groupId: string;
  userId: string;
  name: string;
  roleInGroup: "mentor" | "intern";
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextRole = roleInGroup === "mentor" ? "intern" : "mentor";

  function changeRole() {
    startTransition(async () => {
      const res = await updateMemberRole({ groupId, userId, roleInGroup: nextRole });
      if (res.ok) toast.success(res.message ?? "Role updated");
      else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeMember({ groupId, userId });
      if (res.ok) {
        toast.success(res.message ?? "Member removed");
        setConfirmOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={changeRole} disabled={pending}>
            <ArrowUpDownIcon className="size-4" />
            Make {nextRole}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <UserMinusIcon className="size-4" />
            Remove from group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {name}?</DialogTitle>
            <DialogDescription>
              They’ll lose access to this group’s content. Their submissions stay,
              and you can add them back anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
