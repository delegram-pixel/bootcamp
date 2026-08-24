"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { groups } from "@/db/schema";
import { newJoinCode } from "@/lib/auth/join-code";
import { guardedAction, ok, type ActionResult } from "@/lib/actions/types";
import {
  groupCreateSchema,
  groupUpdateSchema,
  type GroupCreateInput,
  type GroupUpdateInput,
} from "@/lib/validations";

const ADMIN = { action: "manage", resource: { kind: "admin" } } as const;

function revalidateGroups(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/groups");
  if (id) revalidatePath(`/admin/groups/${id}`);
}

export async function createGroup(
  input: GroupCreateInput,
): Promise<ActionResult<{ id: string }>> {
  return guardedAction({ ...ADMIN, schema: groupCreateSchema, input }, async (data) => {
    const id = crypto.randomUUID();
    await db.insert(groups).values({
      id,
      name: data.name,
      description: data.description || null,
    });
    revalidateGroups(id);
    return ok({ id }, "Group created");
  });
}

export async function updateGroup(input: GroupUpdateInput): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: groupUpdateSchema, input }, async (data) => {
    await db
      .update(groups)
      .set({
        name: data.name,
        description: data.description || null,
        status: data.status,
      })
      .where(eq(groups.id, data.id));
    revalidateGroups(data.id);
    return ok(undefined, "Group updated");
  });
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "archived"]),
});

export async function setGroupStatus(
  input: z.infer<typeof statusSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: statusSchema, input }, async (data) => {
    await db.update(groups).set({ status: data.status }).where(eq(groups.id, data.id));
    revalidateGroups(data.id);
    return ok(undefined, data.status === "archived" ? "Group archived" : "Group restored");
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteGroup(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    // FK cascades remove memberships, assignments, notes, submissions, etc.
    await db.delete(groups).where(eq(groups.id, data.id));
    revalidateGroups();
    return ok(undefined, "Group deleted");
  });
}

/**
 * Create (or rotate) a cohort's shareable invite link. Regenerating replaces the
 * old code, so any previously shared link stops working. Returns the fresh code
 * so the UI can display the full link immediately.
 */
export async function generateJoinCode(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult<{ code: string }>> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    const code = newJoinCode();
    await db.update(groups).set({ joinCode: code }).where(eq(groups.id, data.id));
    revalidateGroups(data.id);
    return ok({ code }, "Invite link ready");
  });
}

/** Turn off a cohort's invite link — clears the code so /join stops accepting it. */
export async function disableJoinCode(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: idSchema, input }, async (data) => {
    await db.update(groups).set({ joinCode: null }).where(eq(groups.id, data.id));
    revalidateGroups(data.id);
    return ok(undefined, "Invite link turned off");
  });
}
