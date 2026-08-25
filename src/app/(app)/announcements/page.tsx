import { MegaphoneIcon } from "lucide-react";

import {
  getAnnouncementsForUser,
  listAllAnnouncements,
} from "@/db/queries/announcements";
import { listGroups } from "@/db/queries/groups";
import { requireUser } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-header";
import { AnnouncementComposer } from "@/components/admin/announcement-composer";
import { AnnouncementDeleteButton } from "@/components/admin/announcement-delete-button";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const [announcements, groups] = await Promise.all([
    isAdmin ? listAllAnnouncements() : getAnnouncementsForUser(user.id),
    isAdmin ? listGroups() : Promise.resolve([]),
  ]);
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <PageHeader
        title="Announcements"
        description={
          isAdmin
            ? "Broadcast an update to a single group — or to everyone."
            : "Updates from your mentors."
        }
      />

      {isAdmin ? (
        <div className="mb-6">
          <AnnouncementComposer groups={groupOptions} />
        </div>
      ) : null}

      {announcements.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title="No announcements yet"
          description={
            isAdmin
              ? "Anything you post above will show up here and notify the audience."
              : "When your mentors post an update, it'll appear here."
          }
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} id={`announcement-${a.id}`} className="scroll-mt-24">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={a.group ? "secondary" : "outline"}>
                    {a.group ? a.group.name : "All groups"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {a.author?.name ?? "A mentor"} · {formatDate(a.createdAt)}
                  </span>
                  {isAdmin ? <AnnouncementDeleteButton id={a.id} /> : null}
                </div>
              </CardHeader>
              <CardContent>
                <Markdown>{a.bodyMd}</Markdown>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
