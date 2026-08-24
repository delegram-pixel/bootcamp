"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { joinWithCode } from "@/lib/actions/auth";
import { joinSchema, type JoinInput } from "@/lib/validations";
import { applyFieldErrors } from "@/lib/apply-field-errors";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function JoinForm({ code, groupName }: { code: string; groupName: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<JoinInput>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code, name: "", email: "", password: "", confirmPassword: "" },
  });

  function onSubmit(values: JoinInput) {
    startTransition(async () => {
      const res = await joinWithCode(values);
      // On success the student is signed in and NEXT_REDIRECT navigates away, so
      // we only ever reach here on a real failure.
      if (res && !res.ok) {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* The invite code travels with the form; the action re-validates it. */}
        <input type="hidden" {...form.register("code")} />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Ada Lovelace" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : `Join ${groupName}`}
        </Button>
      </form>
    </Form>
  );
}
