"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { addNoteAttachmentFile } from "@/lib/actions/notes";
import { useUploadThing } from "@/lib/uploadthing/client";
import { Button } from "@/components/ui/button";

/**
 * File/image uploads via UploadThing. Only rendered when uploads are configured
 * (features.uploads). The upload endpoint enforces admin auth server-side, and
 * the row is persisted through the authorized `addNoteAttachmentFile` action —
 * the client never writes to the DB directly.
 */
export function NoteAttachmentFileUpload({ noteId }: { noteId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);

  const { startUpload } = useUploadThing("noteAttachment", {
    onClientUploadComplete: (files) => {
      setUploading(false);
      startSaving(async () => {
        for (const f of files) {
          const res = await addNoteAttachmentFile({
            noteId,
            label: f.name,
            url: f.serverData.url,
            fileKey: f.serverData.key,
            mime: f.type || undefined,
            size: f.size,
          });
          if (!res.ok) toast.error(res.error);
        }
        toast.success(files.length > 1 ? "Files added" : "File added");
      });
    },
    onUploadError: (err) => {
      setUploading(false);
      toast.error(err.message);
    },
  });

  const busy = uploading || saving;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // allow re-selecting the same file
          if (files.length === 0) return;
          setUploading(true);
          void startUpload(files);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="size-4" />
        {busy ? "Uploading…" : "Upload file"}
      </Button>
    </div>
  );
}
