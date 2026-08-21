"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { updateGroup } from "@/lib/actions/groups";
import { groupUpdateSchema, type GroupUpdateInput } from "@/lib/validations";
import { applyFieldErrors } from "@/lib/apply-field-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";

type GroupValues = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
};

export function EditGroupDialog({
  group,
  open,
  onOpenChange,
}: {
  group: GroupValues;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<GroupUpdateInput>({
    resolver: zodResolver(groupUpdateSchema),
    defaultValues: {
      id: group.id,
      name: group.name,
      description: group.description ?? "",
      status: group.status,
    },
  });

  // Re-sync when a different group is edited or the dialog reopens.
  useEffect(() => {
    if (open) {
      form.reset({
        id: group.id,
        name: group.name,
        description: group.description ?? "",
        status: group.status,
      });
    }
  }, [open, group, form]);

  function onSubmit(values: GroupUpdateInput) {
    startTransition(async () => {
      const res = await updateGroup(values);
      if (res.ok) {
        toast.success(res.message ?? "Group updated");
        onOpenChange(false);
      } else {
        applyFieldErrors(form.setError, res);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
          <DialogDescription>Update the cohort’s details.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
