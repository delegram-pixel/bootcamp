import Link from "next/link";
import { BellIcon, GraduationCapIcon } from "lucide-react";

import type { SessionUser } from "@/lib/authz";
import { getUnreadNotificationCount } from "@/db/queries/notifications";
import { MobileNav } from "@/components/mobile-nav";
import { NavLink } from "@/components/nav-link";
import { type NavIconKey } from "@/components/nav-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

type NavItem = { href: string; label: string; icon: NavIconKey; exact?: boolean };

const internLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/assignments", label: "Assignments", icon: "assignments" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/notes", label: "Notes", icon: "notes" },
  { href: "/announcements", label: "Announcements", icon: "announcements" },
];

const adminLinks: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/groups", label: "Groups", icon: "groups" },
  { href: "/admin/members", label: "Members", icon: "members" },
  { href: "/admin/assignments", label: "Assignments", icon: "assignments" },
  { href: "/admin/standings", label: "Standings", icon: "standings" },
  { href: "/notes", label: "Notes", icon: "notes" },
  { href: "/announcements", label: "Announcements", icon: "announcements" },
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
            <NavLink key={l.href} href={l.href} icon={l.icon} exact={l.exact}>
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
