import type { ComponentType, ReactNode } from "react";

/**
 * A section title with an optional leading icon and count. Larger and bolder
 * than a plain label so page structure is scannable at a glance. Shared by the
 * dashboard, assignments, group, and assignment pages so every section reads
 * the same way.
 */
export function SectionHeading({
  icon: Icon,
  children,
  count,
}: {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  count?: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold">
      {Icon ? <Icon className="text-muted-foreground size-4" /> : null}
      {children}
      {count != null ? (
        <span className="text-muted-foreground text-sm font-normal">({count})</span>
      ) : null}
    </h2>
  );
}
