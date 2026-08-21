"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileIcon,
  GitPullRequest as GithubIcon,
  LinkIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addSubmissionGithub,
  addSubmissionLink,
  addSubmissionText,
  removeSubmissionItem,
  submitSubmission,
  withdrawSubmission,
} from "@/lib/actions/submissions";
import { formatBytes, fromNow } from "@/lib/format";
import {
  submissionStatusMeta,
  type SubmissionStatus,
} from "@/lib/submission-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SubmissionFileUpload } from "@/components/intern/submission-file-upload";

type Item = {
  id: string;
  kind: "file" | "text" | "link" | "github";
  content: string | null;
  url: string | null;
  mime: string | null;
  size: number | null;
  metaJson: Record<string, unknown> | null;
};

/** Server action result, kept local so this client file never imports the
 * server-only actions/types module for its type. */
type Res = { ok: true; message?: string } | { ok: false; error: string };

const KIND_META: Record<Item["kind"], { label: string; Icon: typeof FileIcon }> = {
  file: { label: "File", Icon: FileIcon },
  text: { label: "Text", Icon: TypeIcon },
  link: { label: "Link", Icon: LinkIcon },
  github: { label: "GitHub", Icon: GithubIcon },
};

export function SubmissionComposer({
  assignmentId,
  status,
  submittedAt,
  items,
  uploadsEnabled,
  dueOver,
}: {
  assignmentId: string;
  status: SubmissionStatus | null;
  submittedAt: Date | null;
  items: Item[];
  uploadsEnabled: boolean;
  dueOver: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Add-item inputs (one small controlled form per tab).
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [ghUrl, setGhUrl] = useState("");
  const [ghNote, setGhNote] = useState("");

  const locked = status === "graded";
  const submitted = status === "submitted" || status === "late";
  const hasItems = items.length > 0;

  function run(action: () => Promise<Res>, onOk?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        onOk?.();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Your submission</h2>
        <div className="flex items-center gap-2 text-sm">
          {status ? (
            <Badge variant={submissionStatusMeta[status].variant}>
              {submissionStatusMeta[status].label}
            </Badge>
          ) : (
            <Badge variant="outline">Not started</Badge>
          )}
          {submitted && submittedAt ? (
            <span className="text-muted-foreground">Submitted {fromNow(submittedAt)}</span>
          ) : null}
        </div>
      </div>

      {status === "returned" ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Your mentor sent this back for revision. Update your work and resubmit.
        </p>
      ) : null}

      {/* Current items */}
      {hasItems ? (
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
                          (item.kind === "github" && meta.repo
                            ? meta.repo
                            : item.url) ||
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
                {!locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
                    disabled={pending}
                    onClick={() => run(() => removeSubmissionItem({ id: item.id, assignmentId }))}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nothing added yet. Attach a file, paste a link or GitHub repo, or write a note below.
        </p>
      )}

      {/* Add items — hidden once graded (edit-until-graded) */}
      {!locked ? (
        <Card>
          <CardContent className="py-4">
            <Tabs defaultValue="text">
              <TabsList>
                <TabsTrigger value="text">
                  <TypeIcon /> Text
                </TabsTrigger>
                <TabsTrigger value="link">
                  <LinkIcon /> Link
                </TabsTrigger>
                <TabsTrigger value="github">
                  <GithubIcon /> GitHub
                </TabsTrigger>
                <TabsTrigger value="file">
                  <FileIcon /> File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4 space-y-2">
                <Textarea
                  rows={4}
                  placeholder="Write a note, paste your answer, or describe your work… (markdown supported)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || text.trim() === ""}
                  onClick={() =>
                    run(
                      () => addSubmissionText({ assignmentId, content: text }),
                      () => setText(""),
                    )
                  }
                >
                  Add note
                </Button>
              </TabsContent>

              <TabsContent value="link" className="mt-4 space-y-2">
                <Input
                  type="url"
                  placeholder="https://your-deployed-project.example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Input
                  placeholder="Label (optional) — e.g. Live demo"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || linkUrl.trim() === ""}
                  onClick={() =>
                    run(
                      () => addSubmissionLink({ assignmentId, url: linkUrl, label: linkLabel }),
                      () => {
                        setLinkUrl("");
                        setLinkLabel("");
                      },
                    )
                  }
                >
                  Add link
                </Button>
              </TabsContent>

              <TabsContent value="github" className="mt-4 space-y-2">
                <Input
                  type="url"
                  placeholder="https://github.com/you/repo or …/pull/12"
                  value={ghUrl}
                  onChange={(e) => setGhUrl(e.target.value)}
                />
                <Input
                  placeholder="Note (optional) — e.g. See the README"
                  value={ghNote}
                  onChange={(e) => setGhNote(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || ghUrl.trim() === ""}
                  onClick={() =>
                    run(
                      () => addSubmissionGithub({ assignmentId, url: ghUrl, note: ghNote }),
                      () => {
                        setGhUrl("");
                        setGhNote("");
                      },
                    )
                  }
                >
                  Add GitHub link
                </Button>
              </TabsContent>

              <TabsContent value="file" className="mt-4 space-y-2">
                {uploadsEnabled ? (
                  <SubmissionFileUpload assignmentId={assignmentId} disabled={pending} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    File uploads aren’t configured in this environment. Add a link or GitHub
                    repo instead, or set <code>UPLOADTHING_TOKEN</code>.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground rounded-lg border p-3 text-sm">
          This submission has been graded, so it’s locked. Your feedback appears below once the
          grading view lands.
        </p>
      )}

      {/* Submit / withdraw */}
      {!locked ? (
        <>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            {submitted ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => withdrawSubmission({ assignmentId }))}
                >
                  Move back to draft
                </Button>
                <span className="text-muted-foreground text-sm">
                  You can edit and resubmit any time before it’s graded.
                </span>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={pending || !hasItems}
                  onClick={() => run(() => submitSubmission({ assignmentId }))}
                >
                  {status === "returned" ? "Resubmit" : "Submit"}
                </Button>
                {!hasItems ? (
                  <span className="text-muted-foreground text-sm">
                    Add at least one item to submit.
                  </span>
                ) : dueOver ? (
                  <span className="text-destructive text-sm">
                    Past the due date — submitting now will be marked late.
                  </span>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
