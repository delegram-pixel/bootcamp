"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { addSubmissionFile } from "@/lib/actions/submissions";
import { useUploadThing } from "@/lib/uploadthing/client";
import { Button } from "@/components/ui/button";

/**
 * Submission file uploads via UploadThing. Only rendered when uploads are
 * configured (features.uploads). The endpoint checks the user is signed in; the
 * row is persisted through the authorized `addSubmissionFile` action — the client
 * never writes to the DB directly, and `authorize()` runs there.
 */
export function SubmissionFileUpload({
  assignmentId,
  disabled,
}: {
  assignmentId: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);

  const { startUpload } = useUploadThing("submissionFile", {
    onClientUploadComplete: (files) => {
      setUploading(false);
      startSaving(async () => {
        for (const f of files) {
          const res = await addSubmissionFile({
            assignmentId,
            url: f.serverData.url,
            fileKey: f.serverData.key,
            name: f.name,
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
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="size-4" />
        {busy ? "Uploading…" : "Choose a file"}
      </Button>
    </div>
  );
}
