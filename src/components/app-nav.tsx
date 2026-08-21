import Link from "next/link";
import { BellIcon, GraduationCapIcon } from "lucide-react";

import type { SessionUser } from "@/lib/authz";
import { getUnreadNotificationCount } from "@/db/queries/notifications";
import { MobileNav } from "@/components/mobile-nav";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const internLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/notes", label: "Notes" },
  { href: "/announcements", label: "Announcements" },
];

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/members", label: "Members" },
  { href: "/notes", label: "Notes" },
  { href: "/announcements", label: "Announcements" },
];

export async function AppNav({ user }: { user: SessionUser }) {
  const links = user.role === "admin" ? adminLinks : internLinks;
  const unread = await getUnreadNotificationCount(user.id).catch(() => 0);

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4">
        <MobileNav links={links} />

        <Link href="/" className="mr-3 flex items-center gap-2 font-semibold">
          <GraduationCapIcon className="size-5" />
          <span className="hidden sm:inline">Intern Portal</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            className="hover:bg-muted relative flex size-8 items-center justify-center rounded-md"
          >
            <BellIcon className="size-4" />
            {unread > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-medium">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <ThemeToggle />
          <UserMenu
            name={user.name}
            email={user.email}
            image={user.image}
            role={user.role}
          />
        </div>
      </div>
    </header>
  );
}
