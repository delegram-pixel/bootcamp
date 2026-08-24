"use client";

import { useMemo, useState, useTransition } from "react";
import { SearchIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { addMembers } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AddableUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "admin" | "intern";
};

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AddMemberDialog({
  groupId,
  users,
}: {
  groupId: string;
  users: AddableUser[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"intern" | "mentor">("intern");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setSelected(new Set());
    setQuery("");
    setRole("intern");
  }

  function onSubmit() {
    const userIds = [...selected];
    if (userIds.length === 0) return;
    startTransition(async () => {
      const res = await addMembers({ groupId, userIds, roleInGroup: role });
      if (res.ok) {
        toast.success(res.message ?? "Members added");
        setOpen(false);
        reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlusIcon className="size-4" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Add people who’ve already signed up. New interns join themselves with the
            invite link.
          </DialogDescription>
        </DialogHeader>

        {users.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Everyone who’s signed up is already in this group. Share the invite link to
            bring in more people.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No one matches “{query}”.
                </p>
              ) : (
                filtered.map((u) => (
                  <label
                    key={u.id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md p-2"
                  >
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggle(u.id)}
                    />
                    <Avatar className="size-8">
                      {u.image ? <AvatarImage src={u.image} alt="" /> : null}
                      <AvatarFallback className="text-xs">
                        {initials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {u.name ?? u.email}
                        </span>
                        {u.role === "admin" ? (
                          <Badge variant="outline" className="text-[10px]">
                            admin
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {u.email}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm">Add as</span>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "intern" | "mentor")}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intern">Intern</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={pending || selected.size === 0}>
            {pending
              ? "Adding…"
              : selected.size > 0
                ? `Add ${selected.size} ${selected.size === 1 ? "member" : "members"}`
                : "Add members"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
