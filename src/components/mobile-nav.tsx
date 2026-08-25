"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ICONS, type NavIconKey } from "@/components/nav-icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The primary nav collapsed into a hamburger + slide-over for small screens.
 * Mirrors the desktop `NavLink` active-detection so the highlighted item
 * matches whichever surface is showing. Each link is wrapped in `SheetClose`
 * so tapping it navigates *and* dismisses the sheet.
 */
export function MobileNav({
  links,
}: {
  links: { href: string; label: string; icon?: NavIconKey }[];
}) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname.startsWith(l.href));
            const Icon = l.icon ? NAV_ICONS[l.icon] : null;
            return (
              <SheetClose asChild key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {Icon ? <Icon className="size-4" /> : null}
                  {l.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
