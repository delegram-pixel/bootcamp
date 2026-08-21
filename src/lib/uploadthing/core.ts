import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { getCurrentUser } from "@/lib/authz";

const f = createUploadthing();

/**
 * Upload endpoints. Auth is enforced in `.middleware()` (server-side) — a client
 * can't reach these without an admin session. Rows are persisted by an authorized
 * Server Action (`addAttachmentFile`) from the client's onComplete, so all writes
 * still funnel through `authorize()`.
 */
export const ourFileRouter = {
  assignmentAttachment: f({
    blob: { maxFileSize: "16MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      const user = await getCurrentUser();
      if (!user || user.role !== "admin") {
        throw new UploadThingError("Not authorized to upload here.");
      }
      return { userId: user.id };
    })
    .onUploadComplete(async ({ file }) => {
      // The client persists the attachment via a Server Action; nothing to do here.
      return { url: file.url, key: file.key, name: file.name, size: file.size };
    }),

  /**
   * Intern submission files. Any signed-in user may upload; the *real* gate — is
   * this intern allowed to submit to this assignment? — runs in the authorized
   * `addSubmissionFile` action that persists the row from onClientUploadComplete.
   */
  submissionFile: f({
    blob: { maxFileSize: "32MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      const user = await getCurrentUser();
      if (!user) throw new UploadThingError("Sign in to upload.");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, key: file.key, name: file.name, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
