"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addOption,
  addQuestion,
  deleteAssessment,
  removeOption,
  removeQuestion,
  setCorrectOption,
  updateOption,
  updateQuestion,
  upsertAssessment,
} from "@/lib/actions/assessments";
import {
  assessmentOptionAddSchema,
  assessmentOptionUpdateSchema,
  assessmentQuestionAddSchema,
  assessmentQuestionUpdateSchema,
  assessmentUpsertSchema,
  type AssessmentOptionAddInput,
  type AssessmentOptionUpdateInput,
  type AssessmentQuestionAddInput,
  type AssessmentQuestionUpdateInput,
  type AssessmentUpsertInput,
} from "@/lib/validations";
import { applyFieldErrors } from "@/lib/apply-field-errors";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A question with its options, as the editor renders it. */
export type EditorQuestion = {
  id: string;
  prompt: string;
  points: number;
  options: { id: string; label: string; isCorrect: boolean }[];
};

export type EditorAssessment = {
  id: string;
  passPct: number;
  questions: EditorQuestion[];
};

export function AssessmentEditor({
  noteId,
  assessment,
}: {
  noteId: string;
  assessment: EditorAssessment | null;
}) {
  const [creating, startCreating] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onCreate() {
    startCreating(async () => {
      const res = await upsertAssessment({ noteId, passPct: "70" });
      if (res.ok) toast.success("Quiz created — add your first question below.");
      else toast.error(res.error);
    });
  }

  if (!assessment) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-muted-foreground mb-3 text-sm">
          This module has no assessment, so it never gates — interns read it and
          move on. Add a quiz to make it a checkpoint.
        </p>
        <Button type="button" size="sm" disabled={creating} onClick={onCreate}>
          <PlusIcon className="size-4" />
          {creating ? "Creating…" : "Add assessment"}
        </Button>
      </div>
    );
  }

  const totalPoints = assessment.questions.reduce((sum, q) => sum + q.points, 0);
  const passPoints = Math.ceil((assessment.passPct / 100) * totalPoints);

  return (
    <div className="space-y-6">
      <PassMarkForm noteId={noteId} passPct={assessment.passPct} />

      {assessment.questions.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {assessment.questions.length} question
          {assessment.questions.length === 1 ? "" : "s"} · {totalPoints} point
          {totalPoints === 1 ? "" : "s"} total · interns need{" "}
          <span className="text-foreground font-medium">{passPoints}</span> to pass.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          No questions yet. A quiz needs at least one before it can gate — until
          then the module stays open.
        </p>
      )}

      <div className="space-y-4">
        {assessment.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            assessmentId={assessment.id}
            question={q}
            index={i}
            canRemove={assessment.questions.length > 1}
          />
        ))}
      </div>

      <AddQuestionForm assessmentId={assessment.id} />

      <div className="border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2Icon className="size-4" />
          Delete assessment
        </Button>
      </div>

      <DeleteAssessmentDialog
        noteId={noteId}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------- pass mark */

function PassMarkForm({ noteId, passPct }: { noteId: string; passPct: number }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<AssessmentUpsertInput>({
    resolver: zodResolver(assessmentUpsertSchema),
    defaultValues: { noteId, passPct: String(passPct) },
  });

  function onSubmit(values: AssessmentUpsertInput) {
    startTransition(async () => {
      const res = await upsertAssessment(values);
      if (res.ok) toast.success(res.message ?? "Saved");
      else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-wrap items-start gap-3"
      >
        <FormField
          control={form.control}
          name="passPct"
          render={({ field }) => (
            <FormItem className="w-32">
              <FormLabel>Pass mark</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={100} {...field} />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" size="sm" className="mt-8" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <FormDescription className="mt-9 max-w-sm text-xs">
          Interns pass on their <span className="font-medium">best</span> attempt.
          Retakes are unlimited.
        </FormDescription>
      </form>
    </Form>
  );
}

/* -------------------------------------------------------------- question */

function QuestionCard({
  assessmentId,
  question,
  index,
  canRemove,
}: {
  assessmentId: string;
  question: EditorQuestion;
  index: number;
  canRemove: boolean;
}) {
  const [saving, startSaving] = useTransition();
  const [marking, startMarking] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);

  const form = useForm<AssessmentQuestionUpdateInput>({
    resolver: zodResolver(assessmentQuestionUpdateSchema),
    defaultValues: {
      id: question.id,
      prompt: question.prompt,
      points: String(question.points),
    },
  });

  const correct = question.options.find((o) => o.isCorrect);

  function onSave(values: AssessmentQuestionUpdateInput) {
    startSaving(async () => {
      const res = await updateQuestion(values);
      if (res.ok) toast.success(res.message ?? "Saved");
      else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  function onMark(optionId: string) {
    startMarking(async () => {
      const res = await setCorrectOption({ questionId: question.id, optionId });
      if (res.ok) toast.success("Correct answer set");
      else toast.error(res.error);
    });
  }

  function onRemoveQuestion() {
    startRemoving(async () => {
      const res = await removeQuestion({ id: question.id, assessmentId });
      if (res.ok) toast.success(res.message ?? "Removed");
      else toast.error(res.error);
    });
  }

  function onRemoveOption(optionId: string) {
    setPendingOptionId(optionId);
    startRemoving(async () => {
      const res = await removeOption({ id: optionId, questionId: question.id });
      if (res.ok) toast.success(res.message ?? "Removed");
      else toast.error(res.error);
      setPendingOptionId(null);
    });
  }

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
          <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Question {index + 1}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="What does semantic HTML mean?"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap items-end gap-3">
            <FormField
              control={form.control}
              name="points"
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormLabel>Points</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={99} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="outline" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save question"}
            </Button>
            {canRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive ml-auto"
                disabled={removing}
                onClick={onRemoveQuestion}
              >
                <Trash2Icon className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </form>
      </Form>

      <div className="space-y-2">
        {question.options.length === 0 ? (
          <p className="text-muted-foreground text-xs">No answer options yet.</p>
        ) : (
          <ul className="space-y-2">
            {question.options.map((o) => (
              <OptionRow
                key={o.id}
                option={o}
                busy={marking || (removing && pendingOptionId === o.id)}
                onMark={() => onMark(o.id)}
                onRemove={() => onRemoveOption(o.id)}
              />
            ))}
          </ul>
        )}

        {!correct && question.options.length > 0 ? (
          <p className="text-destructive flex items-center gap-1.5 text-xs">
            <AlertTriangleIcon className="size-3.5" />
            No correct answer set — pick one, or interns can&rsquo;t score this
            question.
          </p>
        ) : null}

        <AddOptionForm questionId={question.id} noCorrectYet={!correct} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- option */

function OptionRow({
  option,
  busy,
  onMark,
  onRemove,
}: {
  option: { id: string; label: string; isCorrect: boolean };
  busy: boolean;
  onMark: () => void;
  onRemove: () => void;
}) {
  const [saving, startSaving] = useTransition();
  const form = useForm<AssessmentOptionUpdateInput>({
    resolver: zodResolver(assessmentOptionUpdateSchema),
    defaultValues: { id: option.id, label: option.label },
  });

  function onSave(values: AssessmentOptionUpdateInput) {
    startSaving(async () => {
      const res = await updateOption(values);
      if (res.ok) toast.success("Option updated");
      else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="flex items-start gap-2">
      {/* A radio, not a checkbox: one correct answer per question is what the
          scoring rule and the pass mark are built on. */}
      <input
        type="radio"
        name={`correct-${option.id}`}
        className="accent-primary mt-2.5 size-4 shrink-0"
        checked={option.isCorrect}
        disabled={busy}
        onChange={onMark}
        aria-label="Mark as the correct answer"
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="flex flex-1 gap-2">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="sr-only">Option</FormLabel>
                <FormControl>
                  <Input placeholder="Answer choice" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant="ghost" size="sm" disabled={saving}>
            {saving ? "…" : "Save"}
          </Button>
        </form>
      </Form>
      {option.isCorrect ? (
        <Badge variant="secondary" className="mt-1.5 gap-1">
          <CheckCircle2Icon className="size-3" />
          Correct
        </Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${option.label}`}
        disabled={busy}
        onClick={onRemove}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </li>
  );
}

/* ------------------------------------------------------------ add forms */

function AddQuestionForm({ assessmentId }: { assessmentId: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<AssessmentQuestionAddInput>({
    resolver: zodResolver(assessmentQuestionAddSchema),
    defaultValues: { assessmentId, prompt: "", points: "10" },
  });

  function onSubmit(values: AssessmentQuestionAddInput) {
    startTransition(async () => {
      const res = await addQuestion(values);
      if (res.ok) {
        toast.success(res.message ?? "Question added");
        form.reset({ assessmentId, prompt: "", points: values.points });
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-wrap items-start gap-3 rounded-lg border border-dashed p-4"
      >
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem className="min-w-56 flex-1">
              <FormLabel>New question</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Ask something…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="points"
          render={({ field }) => (
            <FormItem className="w-24">
              <FormLabel>Points</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={99} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" className="mt-8" disabled={pending}>
          <PlusIcon className="size-4" />
          {pending ? "Adding…" : "Add"}
        </Button>
        <FormDescription className="mt-9 max-w-xs text-xs">
          Saved right away — then add its answer options.
        </FormDescription>
      </form>
    </Form>
  );
}

function AddOptionForm({
  questionId,
  noCorrectYet,
}: {
  questionId: string;
  noCorrectYet: boolean;
}) {
  const [pending, startPending] = useTransition();
  const form = useForm<AssessmentOptionAddInput>({
    resolver: zodResolver(assessmentOptionAddSchema),
    // If nothing is correct yet, default the new option to being the answer —
    // the likely intent when a question has just been written.
    defaultValues: { questionId, label: "", isCorrect: noCorrectYet },
  });

  function onSubmit(values: AssessmentOptionAddInput) {
    startPending(async () => {
      const res = await addOption(values);
      if (res.ok) {
        toast.success(res.message ?? "Option added");
        form.reset({ questionId, label: "", isCorrect: false });
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-wrap items-start gap-2 pl-6"
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem className="min-w-48 flex-1">
              <FormLabel className="sr-only">New option</FormLabel>
              <FormControl>
                <Input placeholder="Add an answer choice…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isCorrect"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 pt-2">
              <FormControl>
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  aria-label="This is the correct answer"
                />
              </FormControl>
              <FormLabel className="text-muted-foreground text-xs font-normal">
                Correct
              </FormLabel>
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <PlusIcon className="size-4" />
          {pending ? "Adding…" : "Add option"}
        </Button>
      </form>
    </Form>
  );
}

/* -------------------------------------------------------------- deletion */

function DeleteAssessmentDialog({
  noteId,
  open,
  onOpenChange,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startPending] = useTransition();

  function onDelete() {
    startPending(async () => {
      const res = await deleteAssessment({ noteId });
      if (res.ok) {
        toast.success(res.message ?? "Assessment removed");
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheckIcon className="size-4" />
            Delete this assessment?
          </DialogTitle>
          <DialogDescription>
            This removes the quiz, its questions, and{" "}
            <span className="font-medium">
              every intern&rsquo;s attempts and scores
            </span>
            . Those scores leave the grade pool with it. This can&rsquo;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
