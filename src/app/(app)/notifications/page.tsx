import Link from "next/link";
import {
  BellIcon,
  ChevronRightIcon,
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

/**
 * Where a notification points. Most lead to the assignment it's about; a
 * `comment` goes to wherever that user reads the thread (admins → the grading
 * screen, interns → their assignment view). Section anchors (`#grade`,
 * `#discussion`, `#announcement-…`) drop the reader right at the relevant part.
 * Returns null when the payload lacks the id we'd need to build the link.
 */
function notificationHref(
  type: NotificationType,
  payload: Record<string, unknown> | null,
  isAdmin: boolean,
): string | null {
  const p = payload ?? {};
  const assignmentId = typeof p.assignmentId === "string" ? p.assignmentId : null;
  const submissionId = typeof p.submissionId === "string" ? p.submissionId : null;
  const announcementId = typeof p.announcementId === "string" ? p.announcementId : null;

  switch (type) {
    case "assignment_published":
    case "due_soon":
    case "returned":
      return assignmentId ? `/assignments/${assignmentId}` : null;
    case "graded":
      return assignmentId ? `/assignments/${assignmentId}#grade` : null;
    case "comment":
      if (isAdmin) {
        return submissionId ? `/admin/submissions/${submissionId}#discussion` : null;
      }
      return assignmentId ? `/assignments/${assignmentId}#discussion` : null;
    case "announcement":
      return announcementId
        ? `/announcements#announcement-${announcementId}`
        : "/announcements";
  }
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
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
            const href = notificationHref(n.type, n.payloadJson, isAdmin);

            const body = (
              <>
                <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{describe(n.type, n.payloadJson)}</p>
                  <p className="text-muted-foreground text-xs">{fromNow(n.createdAt)}</p>
                </div>
                {unread || href ? (
                  <div className="flex items-center gap-2 self-center">
                    {unread ? (
                      <span
                        aria-label="Unread"
                        className="bg-primary size-2 shrink-0 rounded-full"
                      />
                    ) : null}
                    {href ? (
                      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : null}
                  </div>
                ) : null}
              </>
            );

            return (
              <li key={n.id} className={cn(unread && "bg-muted/40")}>
                {href ? (
                  <Link
                    href={href}
                    className="hover:bg-muted/60 flex items-start gap-3 p-4 transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
