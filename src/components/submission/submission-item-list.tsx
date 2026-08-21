import {
  FileIcon,
  GitPullRequest as GithubIcon,
  LinkIcon,
  TypeIcon,
} from "lucide-react";

import { formatBytes } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

type Kind = "file" | "text" | "link" | "github";

export type DisplayItem = {
  id: string;
  kind: Kind;
  content: string | null;
  url: string | null;
  mime: string | null;
  size: number | null;
  metaJson: Record<string, unknown> | null;
};

const KIND_META: Record<Kind, { label: string; Icon: typeof FileIcon }> = {
  file: { label: "File", Icon: FileIcon },
  text: { label: "Text", Icon: TypeIcon },
  link: { label: "Link", Icon: LinkIcon },
  github: { label: "GitHub", Icon: GithubIcon },
};

/** Read-only render of a submission's items — used on the grading screen. */
export function SubmissionItemList({ items }: { items: DisplayItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        This submission has no items.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => {
        const { Icon, label } = KIND_META[item.kind];
        const meta = (item.metaJson ?? {}) as { repo?: string; prNumber?: number };
        return (
          <li key={item.id} className="flex items-start gap-3 p-3">
            <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              {item.kind === "text" ? (
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              ) : (
                <>
                  <a
                    href={item.url ?? "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {item.content ||
                      (item.kind === "github" && meta.repo ? meta.repo : item.url) ||
                      label}
                  </a>
                  <div className="text-muted-foreground truncate text-xs">
                    {item.kind === "github"
                      ? [meta.repo, meta.prNumber ? `PR #${meta.prNumber}` : null]
                          .filter(Boolean)
                          .join(" · ") || item.url
                      : item.kind === "file"
                        ? [item.mime, item.size != null ? formatBytes(item.size) : null]
                            .filter(Boolean)
                            .join(" · ") || "File"
                        : item.url}
                  </div>
                </>
              )}
            </div>
            <Badge variant="outline" className="shrink-0">
              {label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
