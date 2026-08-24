"use client";

import { useState, useTransition } from "react";
import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  PowerOffIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { disableJoinCode, generateJoinCode } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Admin panel on the group detail page: create / copy / rotate / disable the
 * cohort's shareable invite link. `url` is built server-side (null when the
 * group has no active code); after each action the page revalidates and this
 * re-renders with the fresh `url`.
 */
export function GroupJoinLink({
  groupId,
  groupName,
  url,
}: {
  groupId: string;
  groupName: string;
  url: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function generate() {
    startTransition(async () => {
      const res = await generateJoinCode({ id: groupId });
      if (res.ok) toast.success(res.message ?? "Invite link ready");
      else toast.error(res.error);
    });
  }

  function disable() {
    startTransition(async () => {
      const res = await disableJoinCode({ id: groupId });
      if (res.ok) toast.success(res.message ?? "Invite link turned off");
      else toast.error(res.error);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy — select the link and copy manually.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="size-4" />
          Invite link
        </CardTitle>
        <CardDescription>
          {url
            ? `Anyone with this link can join ${groupName} as an intern. Share it in your class channel; regenerate to invalidate the old one.`
            : "Create a shareable link so students can join this cohort themselves — no per-person invite needed."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {url ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input readOnly value={url} className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={copy}
                aria-label="Copy invite link"
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={generate}
                disabled={pending}
              >
                <RefreshCwIcon className="size-4" />
                Regenerate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={disable}
                disabled={pending}
              >
                <PowerOffIcon className="size-4" />
                Turn off
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" onClick={generate} disabled={pending}>
            <LinkIcon className="size-4" />
            {pending ? "Creating…" : "Create invite link"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
