import { FileIcon, LinkIcon } from "lucide-react";

import type { NoteAttachment } from "@/db/schema";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";

function isImage(a: NoteAttachment) {
  return a.kind === "file" && !!a.mime && a.mime.startsWith("image/");
}

/**
 * Rich inline rendering of a note's resources: images show in-page, other files
 * become download buttons, and links become chips. Read-only — authoring lives
 * in NoteAttachmentManager on the edit page.
 */
export function NoteAttachments({
  attachments,
}: {
  attachments: NoteAttachment[];
}) {
  if (attachments.length === 0) return null;

  const images = attachments.filter(isImage);
  const files = attachments.filter((a) => a.kind === "file" && !isImage(a));
  const links = attachments.filter((a) => a.kind === "link");

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <a
              key={img.id}
              href={img.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.label}
                loading="lazy"
                className="max-h-80 w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <Button key={file.id} asChild variant="outline" size="sm">
              <a href={file.url} target="_blank" rel="noreferrer noopener">
                <FileIcon className="size-4" />
                <span className="max-w-52 truncate">{file.label}</span>
                {file.size != null ? (
                  <span className="text-muted-foreground text-xs">
                    {formatBytes(file.size)}
                  </span>
                ) : null}
              </a>
            </Button>
          ))}
        </div>
      ) : null}

      {links.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors"
            >
              <LinkIcon className="size-3.5 shrink-0" />
              <span className="max-w-52 truncate">{link.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
