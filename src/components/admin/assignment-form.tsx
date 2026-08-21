"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { createAssignment, updateAssignment } from "@/lib/actions/assignments";
import { assignmentFormSchema, type AssignmentFormInput } from "@/lib/validations";
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
import { Card, CardContent } from "@/components/ui/card";

type Props =
  | { mode: "create"; groupId: string }
  | { mode: "edit"; assignmentId: string; initial: AssignmentFormInput };

const EMPTY: AssignmentFormInput = {
  title: "",
  descriptionMd: "",
  dueAt: "",
  points: "",
  criteria: [],
};

export function AssignmentForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<AssignmentFormInput>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: props.mode === "edit" ? props.initial : EMPTY,
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const watchedCriteria = useWatch({ control: form.control, name: "criteria" });

  function onSubmit(values: AssignmentFormInput) {
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createAssignment({ groupId: props.groupId, ...values })
          : await updateAssignment({ id: props.assignmentId, ...values });

      if (res.ok) {
        toast.success(res.message ?? "Saved");
        const id = res.data?.id ?? (props.mode === "edit" ? props.assignmentId : null);
        if (id) router.push(`/admin/assignments/${id}`);
        router.refresh();
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  const totalRubric = (watchedCriteria ?? []).reduce(
    (sum, c) => sum + (Number(c.maxPoints) || 0),
    0,
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Build a responsive landing page" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dueAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormDescription>Optional. Interns see a countdown.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="points"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Points</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="Optional" {...field} />
                </FormControl>
                <FormDescription>Total the assignment is worth.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descriptionMd"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={10}
                  placeholder="Markdown supported — instructions, requirements, resources…"
                  className="font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <FormDescription>Markdown is rendered for interns.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Rubric */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-medium">Rubric</h2>
              <p className="text-muted-foreground text-sm">
                Optional. Add criteria to grade against{" "}
                {criteria.fields.length > 0 && (
                  <span className="text-foreground font-medium">· {totalRubric} pts total</span>
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                criteria.append({ label: "", maxPoints: 10, description: "" })
              }
            >
              <PlusIcon className="size-4" />
              Add criterion
            </Button>
          </div>

          {criteria.fields.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
              No rubric. Grading will be a single score + comments.
            </p>
          ) : (
            <div className="space-y-3">
              {criteria.fields.map((row, i) => (
                <Card key={row.id}>
                  <CardContent className="grid gap-3 py-4 sm:grid-cols-[1fr_7rem_auto]">
                    <FormField
                      control={form.control}
                      name={`criteria.${i}.label`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Criterion</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Semantic HTML" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`criteria.${i}.maxPoints`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Max points</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              aria-label="Max points"
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove criterion"
                      onClick={() => criteria.remove(i)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                    <FormField
                      control={form.control}
                      name={`criteria.${i}.description`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-3">
                          <FormLabel className="sr-only">Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="What earns full marks? (optional)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : props.mode === "create"
                ? "Create draft"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
