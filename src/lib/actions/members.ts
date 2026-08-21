"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { guardedAction, ok, fail, type ActionResult } from "@/lib/actions/types";
import { createPasswordResetToken, ONBOARD_TOKEN_TTL_MS } from "@/lib/auth/reset";
import {
  addMemberSchema,
  inviteInternSchema,
  membershipRoleSchema,
  type AddMemberInput,
  type InviteInternInput,
} from "@/lib/validations";

const ADMIN = { action: "manage", resource: { kind: "admin" } } as const;

/** Find an existing user by email or create a fresh intern row. */
async function upsertUserByEmail(email: string, name?: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  if (existing) return existing;

  const id = crypto.randomUUID();
  const [created] = await db
    .insert(users)
    .values({ id, email: normalized, name: name?.trim() || null, role: "intern" })
    .returning();
  return created;
}

export async function inviteIntern(
  input: InviteInternInput,
): Promise<ActionResult<{ id: string; setPasswordUrl: string }>> {
  return guardedAction({ ...ADMIN, schema: inviteInternSchema, input }, async (data) => {
    const user = await upsertUserByEmail(data.email, data.name || undefined);
    // Issue a first-password link (longer-lived than a self-service reset) so the
    // admin can hand it over directly — handy before an email domain is verified.
    const { url } = await createPasswordResetToken(user.id, ONBOARD_TOKEN_TTL_MS);
    revalidatePath("/admin/members");
    revalidatePath("/admin");
    return ok({ id: user.id, setPasswordUrl: url }, "Intern added");
  });
}

export async function addMember(input: AddMemberInput): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: addMemberSchema, input }, async (data) => {
    const user = await upsertUserByEmail(data.email, data.name || undefined);
    await db
      .insert(memberships)
      .values({ userId: user.id, groupId: data.groupId, roleInGroup: data.roleInGroup })
      .onConflictDoNothing();
    revalidatePath(`/admin/groups/${data.groupId}`);
    revalidatePath("/admin/members");
    revalidatePath("/admin");
    return ok(undefined, "Member added");
  });
}

const memberRefSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
});

export async function removeMember(
  input: z.infer<typeof memberRefSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: memberRefSchema, input }, async (data) => {
    await db
      .delete(memberships)
      .where(
        and(eq(memberships.groupId, data.groupId), eq(memberships.userId, data.userId)),
      );
    revalidatePath(`/admin/groups/${data.groupId}`);
    revalidatePath("/admin/members");
    return ok(undefined, "Member removed");
  });
}

const roleChangeSchema = memberRefSchema.extend({ roleInGroup: membershipRoleSchema });

export async function updateMemberRole(
  input: z.infer<typeof roleChangeSchema>,
): Promise<ActionResult> {
  return guardedAction({ ...ADMIN, schema: roleChangeSchema, input }, async (data) => {
    const updated = await db
      .update(memberships)
      .set({ roleInGroup: data.roleInGroup })
      .where(
        and(eq(memberships.groupId, data.groupId), eq(memberships.userId, data.userId)),
      )
      .returning({ id: memberships.id });
    if (updated.length === 0) return fail("That membership no longer exists.");
    revalidatePath(`/admin/groups/${data.groupId}`);
    return ok(undefined, "Role updated");
  });
}
