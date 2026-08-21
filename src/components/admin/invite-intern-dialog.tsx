"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, CopyIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { inviteIntern } from "@/lib/actions/members";
import { inviteInternSchema, type InviteInternInput } from "@/lib/validations";
import { applyFieldErrors } from "@/lib/apply-field-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function InviteInternDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Once an intern is created we swap the form for the set-password link so the
  // admin can copy it and send it over (works even before email is configured).
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<InviteInternInput>({
    resolver: zodResolver(inviteInternSchema),
    defaultValues: { email: "", name: "" },
  });

  function reset() {
    form.reset();
    setLink(null);
    setCopied(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onSubmit(values: InviteInternInput) {
    startTransition(async () => {
      const res = await inviteIntern(values);
      if (res.ok) {
        toast.success(res.message ?? "Intern added");
        setLink(res.data?.setPasswordUrl ?? null);
        form.reset();
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy — select the link and copy manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon className="size-4" />
          Invite intern
        </Button>
      </DialogTrigger>
      <DialogContent>
        {link ? (
          <>
            <DialogHeader>
              <DialogTitle>Intern added</DialogTitle>
              <DialogDescription>
                Send this link so they can set their password. It’s single-use and
                expires in 7 days. If email is configured, they’ve also received it.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={copyLink}
                aria-label="Copy link"
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Invite another
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite intern</DialogTitle>
              <DialogDescription>
                Creates an account by email. They join their groups when you add
                them, then set a password with the link you’ll get next.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="intern@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Adding…" : "Add intern"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
