"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SaveIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";

import { gradeSubmission, returnForRevision } from "@/lib/actions/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Criterion = {
  id: string;
  label: string;
  description: string | null;
  maxPoints: number;
};

type ExistingScore = { criterionId: string; points: number; comment: string | null };

type Status = "draft" | "submitted" | "late" | "graded" | "returned";

type Res = { ok: true; message?: string } | { ok: false; error: string };

/** Parse an input value to a non-negative integer, clamped to [0, max]. */
function clampInt(value: string, max: number) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

export function GradingForm({
  submissionId,
  criteria,
  points,
  status,
  existing,
}: {
  submissionId: string;
  criteria: Criterion[];
  points: number | null;
  status: Status;
  existing: { score: number; criterionScores: ExistingScore[] } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasRubric = criteria.length > 0;
  const rubricTotal = useMemo(
    () => criteria.reduce((sum, c) => sum + c.maxPoints, 0),
    [criteria],
  );

  const existingById = useMemo(
    () => new Map((existing?.criterionScores ?? []).map((s) => [s.criterionId, s])),
    [existing],
  );

  // Per-criterion state (rubric path). Values are strings for controlled inputs.
  const [scores, setScores] = useState<Record<string, { points: string; comment: string }>>(
    () =>
      Object.fromEntries(
        criteria.map((c) => {
          const s = existingById.get(c.id);
          return [c.id, { points: s ? String(s.points) : "", comment: s?.comment ?? "" }];
        }),
      ),
  );

  // Single-score state (no-rubric path).
  const [overall, setOverall] = useState(
    existing && !hasRubric ? String(existing.score) : "",
  );

  const [feedback, setFeedback] = useState("");

  const liveTotal = hasRubric
    ? criteria.reduce((sum, c) => sum + clampInt(scores[c.id]?.points ?? "", c.maxPoints), 0)
    : clampInt(overall, points ?? Number.MAX_SAFE_INTEGER);

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

  function save() {
    const criteriaPayload = hasRubric
      ? criteria.map((c) => ({
          criterionId: c.id,
          points: clampInt(scores[c.id]?.points ?? "", c.maxPoints),
          comment: scores[c.id]?.comment?.trim() || "",
        }))
      : [];
    run(
      () =>
        gradeSubmission({
          submissionId,
          criteria: criteriaPayload,
          overallScore: hasRubric ? undefined : clampInt(overall, points ?? Number.MAX_SAFE_INTEGER),
          feedback: feedback.trim() || "",
        }),
      () => setFeedback(""),
    );
  }

  const graded = status === "graded";

  return (
    <div className="space-y-5">
      {hasRubric ? (
        <ul className="space-y-3">
          {criteria.map((c) => (
            <li key={c.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  {c.description ? (
                    <div className="text-muted-foreground text-xs">{c.description}</div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={c.maxPoints}
                    inputMode="numeric"
                    className="w-20 text-right tabular-nums"
                    aria-label={`Points for ${c.label} (max ${c.maxPoints})`}
                    value={scores[c.id]?.points ?? ""}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], points: e.target.value },
                      }))
                    }
                  />
                  <span className="text-muted-foreground text-sm">/ {c.maxPoints}</span>
                </div>
              </div>
              <Input
                placeholder="Comment on this criterion (optional)"
                value={scores[c.id]?.comment ?? ""}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [c.id]: { ...prev[c.id], comment: e.target.value },
                  }))
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="overall-score">Score</Label>
          <div className="flex items-center gap-2">
            <Input
              id="overall-score"
              type="number"
              min={0}
              max={points ?? undefined}
              inputMode="numeric"
              className="w-28 text-right tabular-nums"
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
            />
            {points != null ? (
              <span className="text-muted-foreground text-sm">/ {points} pts</span>
            ) : (
              <span className="text-muted-foreground text-sm">pts</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="grade-feedback">Feedback comment (optional)</Label>
        <Textarea
          id="grade-feedback"
          rows={3}
          placeholder="Add a note to the intern — posts to the comment thread."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={save}>
          <SaveIcon className="size-4" />
          {graded ? "Update grade" : "Save grade"}
        </Button>
        {hasRubric ? (
          <span className="text-muted-foreground text-sm tabular-nums">
            Total: {liveTotal} / {rubricTotal} pts
          </span>
        ) : null}
        {status !== "draft" && status !== "returned" ? (
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            disabled={pending}
            onClick={() => run(() => returnForRevision({ submissionId }))}
          >
            <Undo2Icon className="size-4" />
            Return for revision
          </Button>
        ) : null}
      </div>
    </div>
  );
}
