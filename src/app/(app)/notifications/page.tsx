import {
  BellIcon,
  FileTextIcon,
  GraduationCapIcon,
  MessageSquareIcon,
  MegaphoneIcon,
  ClockIcon,
  Undo2Icon,
} from "lucide-react";

import type { NotificationType } from "@/db/schema";
import { listNotifications } from "@/db/queries/notifications";
import { requireUser } from "@/lib/authz";
import { cn } from "@/lib/utils";
import { fromNow } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read";

export const metadata = { title: "Notifications" };

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  assignment_published: FileTextIcon,
  graded: GraduationCapIcon,
  returned: Undo2Icon,
  comment: MessageSquareIcon,
  announcement: MegaphoneIcon,
  due_soon: ClockIcon,
};

/** Turn a notification's type + payload into a one-line message. */
function describe(type: NotificationType, payload: Record<string, unknown> | null): string {
  const p = payload ?? {};
  const title = typeof p.title === "string" ? p.title : undefined;
  switch (type) {
    case "assignment_published":
      return title ? `New assignment: ${title}` : "A new assignment was published";
    case "graded":
      return title ? `Your submission for ${title} was graded` : "A submission was graded";
    case "returned":
      return title ? `${title} was sent back for revision` : "A submission was returned for revision";
    case "comment":
      return title ? `New comment on ${title}` : "You have a new comment";
    case "announcement":
      return title ? `Announcement: ${title}` : "A new announcement was posted";
    case "due_soon":
      return title ? `Due soon: ${title}` : "An assignment is due soon";
  }
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <>
      <PageHeader title="Notifications" description="Grades, comments, and what's coming due.">
        {hasUnread ? <MarkAllReadButton /> : null}
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={BellIcon}
          title="You're all caught up"
          description="Notifications about assignments, grades, and comments will show up here."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? BellIcon;
            const unread = !n.readAt;
            return (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4",
                  unread && "bg-muted/40",
                )}
              >
                <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{describe(n.type, n.payloadJson)}</p>
                  <p className="text-muted-foreground text-xs">{fromNow(n.createdAt)}</p>
                </div>
                {unread ? (
                  <span
                    aria-label="Unread"
                    className="bg-primary mt-2 size-2 shrink-0 rounded-full"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
