"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { requestPasswordReset } from "@/lib/actions/auth";
import { requestResetSchema, type RequestResetInput } from "@/lib/validations";
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

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const form = useForm<RequestResetInput>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: RequestResetInput) {
    startTransition(async () => {
      const res = await requestPasswordReset(values);
      if (res.ok) {
        setSent(true);
        toast.success(res.message ?? "Check your email.");
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  // The action returns the same result whether or not the account exists, so the
  // confirmation view never confirms an address either way.
  if (sent) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground">
          If an account exists for that address, a reset link is on its way. It
          expires soon, so use it promptly.
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </Form>
  );
}
