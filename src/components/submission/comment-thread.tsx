"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendHorizonalIcon } from "lucide-react";
import { toast } from "sonner";

import { addComment } from "@/lib/actions/grading";
import { fromNow } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";

type Author = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type ThreadComment = {
  id: string;
  bodyMd: string;
  createdAt: Date;
  author: Author;
};

function initials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * The comment thread on a submission. Both the mentor and the owning intern can
 * post (server-side `authorize()` decides); `canComment` only governs whether
 * the composer renders.
 */
export function CommentThread({
  submissionId,
  comments,
  currentUserId,
  canComment,
}: {
  submissionId: string;
  comments: ThreadComment[];
  currentUserId: string;
  canComment: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function post() {
    startTransition(async () => {
      const res = await addComment({ submissionId, bodyMd: body });
      if (res.ok) {
        toast.success(res.message ?? "Comment posted");
        setBody("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const mine = c.author.id === currentUserId;
            return (
              <li key={c.id} className="flex items-start gap-3">
                <Avatar className="size-8 shrink-0">
                  {c.author.image ? <AvatarImage src={c.author.image} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {initials(c.author.name, c.author.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {mine ? "You" : (c.author.name ?? c.author.email)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {fromNow(c.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <Markdown>{c.bodyMd}</Markdown>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canComment ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            placeholder="Write a comment… (markdown supported)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={pending || body.trim() === ""}
              onClick={post}
            >
              <SendHorizonalIcon className="size-4" />
              Post comment
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
