import {
  ClipboardListIcon,
  LayersIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  NotebookPenIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Nav icons are keyed by a string so the link arrays stay serializable across
 * the Server→Client boundary (`AppNav` is a server component; `NavLink` and
 * `MobileNav` are client components). Passing the icon *component* itself would
 * break — functions aren't serializable in the RSC payload — so the server
 * sends a key and the client components look up the component here.
 */
export type NavIconKey =
  | "dashboard"
  | "assignments"
  | "notes"
  | "announcements"
  | "overview"
  | "groups"
  | "members";

export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  assignments: ClipboardListIcon,
  notes: NotebookPenIcon,
  announcements: MegaphoneIcon,
  overview: LayoutDashboardIcon,
  groups: LayersIcon,
  members: UsersIcon,
};
