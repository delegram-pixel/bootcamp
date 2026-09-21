"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createNote, updateNote } from "@/lib/actions/notes";
import { noteFormSchema, type NoteFormInput } from "@/lib/validations";
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
import { NoteBodyEditor } from "@/components/admin/note-body-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select forbids an empty-string item value, so the "everyone" option
// uses a sentinel that maps to "" (global) in the form value.
const ALL_GROUPS = "__all__";

const BODY_ID = "note-body";

type GroupOption = { id: string; name: string };

/** An existing note to edit. When omitted, the form creates a new note. */
type ExistingNote = {
  id: string;
  title: string;
  bodyMd: string;
  groupId: string | null;
  weekNumber: number | null;
  position: number;
  topic: string | null;
};

const EMPTY: NoteFormInput = {
  title: "",
  bodyMd: "",
  groupId: "",
  weekNumber: "",
  position: "",
  topic: "",
};

function toDefaults(note: ExistingNote): NoteFormInput {
  return {
    title: note.title,
    bodyMd: note.bodyMd,
    groupId: note.groupId ?? "",
    weekNumber: note.weekNumber != null ? String(note.weekNumber) : "",
    position: String(note.position),
    topic: note.topic ?? "",
  };
}

export function NoteForm({
  groups,
  note,
}: {
  groups: GroupOption[];
  note?: ExistingNote;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(note);
  const form = useForm<NoteFormInput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: note ? toDefaults(note) : EMPTY,
  });

  function onSubmit(values: NoteFormInput) {
    startTransition(async () => {
      // The form validates the shared fields; each action re-validates the full
      // shape server-side. On create we route to the new note's edit page so the
      // admin can attach files/images/links (which need a persisted note).
      if (note) {
        const res = await updateNote({ ...values, id: note.id });
        if (res.ok) {
          toast.success(res.message ?? "Note updated");
          router.push("/notes");
          router.refresh();
        } else {
          applyFieldErrors(form.setError, res);
          toast.error(res.error);
        }
        return;
      }

      const res = await createNote(values);
      if (res.ok) {
        toast.success(res.message ?? "Note posted");
        router.push(res.data ? `/notes/${res.data.id}/edit` : "/notes");
        router.refresh();
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

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
                <Input placeholder="e.g. Week 2 — Flexbox deep dive" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="groupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Audience</FormLabel>
              <Select
                value={field.value === "" ? ALL_GROUPS : field.value}
                onValueChange={(v) => field.onChange(v === ALL_GROUPS ? "" : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Post to one group, or to everyone.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="weekNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Week</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    placeholder="Optional — e.g. 2"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Groups notes by week for readers.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Path order</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={9999}
                    placeholder={isEdit ? "Keeps current" : "Appends"}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Place in the cohort&rsquo;s module path.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic</FormLabel>
                <FormControl>
                  <Input placeholder="Optional — e.g. CSS" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="bodyMd"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={BODY_ID}>Body</FormLabel>
              <NoteBodyEditor
                id={BODY_ID}
                value={field.value}
                onChange={field.onChange}
              />
              <FormDescription>
                Optional — format with the toolbar; readers see the rendered
                markdown. You can also attach files, images, and links.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? isEdit
                ? "Saving…"
                : "Posting…"
              : isEdit
                ? "Save changes"
                : "Post note"}
          </Button>
          <Button asChild variant="ghost" type="button">
            <Link href="/notes">Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
