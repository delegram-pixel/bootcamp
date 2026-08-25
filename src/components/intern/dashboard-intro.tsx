"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ClipboardListIcon,
  MegaphoneIcon,
  NotebookPenIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const KEY = "portal-intro-dismissed";

// A tiny same-tab pub/sub: the native `storage` event only fires in *other*
// tabs, so we notify our own subscribers when this tab dismisses the banner.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function isDismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage unavailable (e.g. private mode) → don't nag
  }
}

const LINKS = [
  {
    href: "/assignments",
    icon: ClipboardListIcon,
    title: "Assignments",
    blurb: "Everything you need to do, in one place.",
  },
  {
    href: "/notes",
    icon: NotebookPenIcon,
    title: "Notes",
    blurb: "Lesson notes and resources, by week.",
  },
  {
    href: "/announcements",
    icon: MegaphoneIcon,
    title: "Announcements",
    blurb: "Updates from your mentors.",
  },
];

/**
 * A one-time orientation card for new interns pointing at the main
 * destinations. Dismissal is remembered in localStorage. `useSyncExternalStore`
 * renders nothing on the server and during hydration (server snapshot = true),
 * then syncs to the real value — so a previously-dismissed banner never flashes.
 */
export function DashboardIntro() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Ignore — worst case the banner reappears next load.
    }
    listeners.forEach((l) => l());
  }

  return (
    <Card className="border-primary/30 bg-primary/5 relative mb-8">
      <CardContent className="py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 size-7"
        >
          <XIcon className="size-4" />
        </Button>
        <p className="pr-8 font-medium">New here? Here’s where things live.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="hover:bg-background/60 flex items-start gap-2 rounded-lg p-2 transition-colors"
              >
                <Icon className="text-primary mt-0.5 size-4 shrink-0" />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{l.title}</span>
                  <span className="text-muted-foreground block text-xs">
                    {l.blurb}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
