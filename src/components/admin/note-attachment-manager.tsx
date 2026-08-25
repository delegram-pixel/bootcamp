"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileIcon,
  ImageIcon,
  LinkIcon,
  PaperclipIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import type { NoteAttachment } from "@/db/schema";
import {
  addNoteAttachmentLink,
  removeNoteAttachment,
} from "@/lib/actions/notes";
import {
  noteAttachmentLinkSchema,
  type NoteAttachmentLinkInput,
} from "@/lib/validations";
import { applyFieldErrors } from "@/lib/apply-field-errors";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NoteAttachmentFileUpload } from "@/components/admin/note-attachment-file-upload";

function isImage(a: NoteAttachment) {
  return a.kind === "file" && !!a.mime && a.mime.startsWith("image/");
}

export function NoteAttachmentManager({
  noteId,
  attachments,
  uploadsEnabled,
}: {
  noteId: string;
  attachments: NoteAttachment[];
  uploadsEnabled: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();
  const [adding, startAdding] = useTransition();

  const form = useForm<NoteAttachmentLinkInput>({
    resolver: zodResolver(noteAttachmentLinkSchema),
    defaultValues: { noteId, label: "", url: "" },
  });

  function onAddLink(values: NoteAttachmentLinkInput) {
    startAdding(async () => {
      const res = await addNoteAttachmentLink(values);
      if (res.ok) {
        toast.success(res.message ?? "Link added");
        form.reset({ noteId, label: "", url: "" });
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  function onRemove(id: string) {
    setPendingId(id);
    startRemoving(async () => {
      const res = await removeNoteAttachment({ id, noteId });
      if (res.ok) toast.success(res.message ?? "Removed");
      else toast.error(res.error);
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {attachments.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <PaperclipIcon className="size-4" />
          No files, images, or links yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              {isImage(a) ? (
                <ImageIcon className="text-muted-foreground size-4 shrink-0" />
              ) : a.kind === "file" ? (
                <FileIcon className="text-muted-foreground size-4 shrink-0" />
              ) : (
                <LinkIcon className="text-muted-foreground size-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary block truncate text-sm font-medium underline-offset-2 hover:underline"
                >
                  {a.label}
                </a>
                <div className="text-muted-foreground truncate text-xs">
                  {a.kind === "file"
                    ? [a.mime, a.size != null ? formatBytes(a.size) : null]
                        .filter(Boolean)
                        .join(" · ") || "File"
                    : a.url}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${a.label}`}
                disabled={removing && pendingId === a.id}
                onClick={() => onRemove(a.id)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onAddLink)}
            className="flex flex-1 flex-wrap items-start gap-2"
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem className="min-w-40 flex-1">
                  <FormLabel className="sr-only">Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Label (e.g. Slides)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem className="min-w-48 flex-1">
                  <FormLabel className="sr-only">URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="outline" size="sm" disabled={adding}>
              <PlusIcon className="size-4" />
              Add link
            </Button>
          </form>
        </Form>

        {uploadsEnabled ? <NoteAttachmentFileUpload noteId={noteId} /> : null}
      </div>

      {!uploadsEnabled ? (
        <p className="text-muted-foreground text-xs">
          File uploads need <code className="text-foreground">UPLOADTHING_TOKEN</code>.
          Link resources work without it.
        </p>
      ) : null}
    </div>
  );
}
