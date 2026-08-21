"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MegaphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { createAnnouncement } from "@/lib/actions/announcements";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_GROUPS = "__all__";

type GroupOption = { id: string; name: string };

export function AnnouncementComposer({ groups }: { groups: GroupOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState(ALL_GROUPS);
  const [body, setBody] = useState("");

  function post() {
    startTransition(async () => {
      const res = await createAnnouncement({ groupId, bodyMd: body });
      if (res.ok) {
        toast.success(res.message ?? "Announcement posted");
        setBody("");
        setGroupId(ALL_GROUPS);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="ann-audience">Audience</Label>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger id="ann-audience">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ann-body">Message</Label>
        <Textarea
          id="ann-body"
          rows={4}
          placeholder="Share an update with your interns… (markdown supported)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" disabled={pending || body.trim() === ""} onClick={post}>
          <MegaphoneIcon className="size-4" />
          {pending ? "Posting…" : "Post announcement"}
        </Button>
      </div>
    </div>
  );
}
