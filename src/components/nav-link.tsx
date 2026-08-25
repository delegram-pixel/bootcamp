"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ICONS, type NavIconKey } from "@/components/nav-icons";

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: NavIconKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}`));
  const Icon = icon ? NAV_ICONS[icon] : null;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Link>
  );
}
