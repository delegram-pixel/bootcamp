"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createNote } from "@/lib/actions/notes";
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
import { Textarea } from "@/components/ui/textarea";
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

type GroupOption = { id: string; name: string };

const EMPTY: NoteFormInput = {
  title: "",
  bodyMd: "",
  groupId: "",
  week: "",
  topic: "",
};

export function NoteForm({ groups }: { groups: GroupOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<NoteFormInput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: EMPTY,
  });

  function onSubmit(values: NoteFormInput) {
    startTransition(async () => {
      const res = await createNote(values);
      if (res.ok) {
        toast.success(res.message ?? "Note posted");
        router.push("/notes");
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="week"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Week</FormLabel>
                <FormControl>
                  <Input placeholder="Optional — e.g. Week 2" {...field} />
                </FormControl>
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
              <FormLabel>Body</FormLabel>
              <FormControl>
                <Textarea
                  rows={18}
                  placeholder="Markdown supported…"
                  className="min-h-96 font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <FormDescription>Markdown is rendered for readers.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Posting…" : "Post note"}
          </Button>
          <Button asChild variant="ghost" type="button">
            <Link href="/notes">Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
