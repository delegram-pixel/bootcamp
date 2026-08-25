import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "lucide-react";

/**
 * A consistent "back to …" link for the top of detail pages, so students never
 * feel stranded. Mirrors the muted → foreground hover used elsewhere.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
    >
      <ChevronLeftIcon className="size-4" />
      {children}
    </Link>
  );
}
