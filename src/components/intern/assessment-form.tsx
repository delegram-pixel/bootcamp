"use client";

import { useState, useTransition } from "react";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { submitAttempt, type AttemptResult } from "@/lib/actions/attempts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type QuizQuestion = {
  id: string;
  prompt: string;
  points: number;
  options: { id: string; label: string }[];
};

/**
 * The quiz. Plain `useState` rather than react-hook-form — there is nothing to
 * validate client-side (the score is derived on the server from the answer key),
 * so a record of `questionId → optionId` is the whole state. Mirrors
 * `grading-form.tsx`, which made the same call for the same reason.
 */
export function AssessmentForm({
  assessmentId,
  questions,
  passPct,
}: {
  assessmentId: string;
  questions: QuizQuestion[];
  passPct: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [pending, startTransition] = useTransition();

  const answered = questions.filter((q) => answers[q.id]).length;
  const allAnswered = answered === questions.length;

  function onSubmit() {
    startTransition(async () => {
      const res = await submitAttempt({
        assessmentId,
        answers: questions.map((q) => ({
          questionId: q.id,
          optionId: answers[q.id] ?? null,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data) {
        setResult(res.data);
        // Failing isn't a failure of the app — it's a result, and the banner
        // above spells out what to do about it.
        if (res.data.passed) toast.success(res.message ?? "Passed");
        else toast.warning(res.message ?? "Not passed yet");
      } else {
        toast.success(res.message ?? "Submitted");
      }
    });
  }

  return (
    <div className="space-y-6">
      {result ? <ResultBanner result={result} /> : null}

      <ol className="space-y-6">
        {questions.map((q, i) => (
          <li key={q.id} className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-sm tabular-nums">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{q.prompt}</p>
                <p className="text-muted-foreground text-xs">
                  {q.points} point{q.points === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-6">
              {q.options.map((o) => {
                const id = `q-${q.id}-${o.id}`;
                const checked = answers[q.id] === o.id;
                return (
                  <label
                    key={o.id}
                    htmlFor={id}
                    className={
                      checked
                        ? "border-primary bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                        : "hover:bg-accent/30 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
                    }
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`q-${q.id}`}
                      className="accent-primary size-4 shrink-0"
                      checked={checked}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: o.id }))
                      }
                    />
                    <span>{o.label}</span>
                  </label>
                );
              })}
              {q.options.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  This question has no answer options yet.
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={pending || !allAnswered}>
          {pending ? "Submitting…" : result ? "Submit another attempt" : "Submit answers"}
        </Button>
        <span className="text-muted-foreground text-sm">
          {allAnswered
            ? `${passPct}% needed to pass`
            : `Answered ${answered} of ${questions.length}`}
        </span>
      </div>
    </div>
  );
}

function ResultBanner({ result }: { result: AttemptResult }) {
  const pass = result.passed;
  return (
    <Card className={pass ? "border-primary/40" : "border-destructive/40"}>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        {pass ? (
          <CheckCircle2Icon className="text-primary size-5 shrink-0" />
        ) : (
          <XCircleIcon className="text-destructive size-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {pass ? "Passed" : "Not passed yet"} — {result.score}/{result.total} (
            {result.pct}%)
          </div>
          <div className="text-muted-foreground text-sm">
            {pass
              ? "Your best score counts toward your grade."
              : `You need ${result.passPct}% on a single attempt. Retake it whenever you're ready — your best score is the one that counts.`}
          </div>
        </div>
        <Badge variant={pass ? "default" : "destructive"}>
          Best {result.bestPct}%
        </Badge>
      </CardContent>
    </Card>
  );
}
