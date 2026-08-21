"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (res.ok) {
        toast.success(res.message ?? "Marked all as read");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClick}>
      <CheckCheckIcon className="size-4" />
      Mark all as read
    </Button>
  );
}
