import { LockIcon } from "lucide-react";

import { BADGES, type BadgeKey } from "@/lib/scoring";
import { BADGE_ICONS } from "@/components/badge-icons";
import { cn } from "@/lib/utils";

/**
 * The whole badge registry rendered at once: earned badges lit, locked ones
 * dimmed with a lock, so an intern can see what's still to come. Earned/locked
 * is decided server-side (`evaluateBadges`) and passed in — this only renders.
 * Identity never rides on color alone: every badge carries its icon and label.
 */
export function BadgeGrid({ earned }: { earned: BadgeKey[] }) {
  const earnedSet = new Set(earned);
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BADGES.map((badge) => {
        const isEarned = earnedSet.has(badge.key);
        const Icon = isEarned ? BADGE_ICONS[badge.icon] : LockIcon;
        return (
          <li
            key={badge.key}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              isEarned ? "bg-card" : "border-dashed bg-muted/40",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                isEarned
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="space-y-0.5">
              <p
                className={cn(
                  "text-sm font-medium",
                  isEarned ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {badge.label}
              </p>
              <p className="text-muted-foreground text-xs">{badge.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
