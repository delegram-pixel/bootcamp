"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { getGroupByJoinCode } from "@/db/queries/groups";
import { signIn, signOut } from "@/lib/auth";
import {
  joinSchema,
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  type JoinInput,
  type LoginInput,
  type RequestResetInput,
  type ResetPasswordInput,
} from "@/lib/validations";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/actions/types";
import { createPasswordResetToken, redeemPasswordResetToken } from "@/lib/auth/reset";
import { sendEmail } from "@/lib/email/send";
import { PasswordResetEmail } from "@/lib/email/templates";

/**
 * Email + password sign-in. On success `signIn` throws the NEXT_REDIRECT that
 * navigates to "/", so we only ever *return* on failure — a wrong credential
 * surfaces as an `ActionResult` the login form can render, while the redirect is
 * re-thrown so navigation happens.
 */
export async function signInWithPassword(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return ok();
  } catch (error) {
    if (error instanceof AuthError) return fail("Invalid email or password.");
    throw error; // NEXT_REDIRECT — let navigation happen
  }
}

/** Shown regardless of whether the account exists — avoids leaking who's registered. */
const RESET_REQUEST_MESSAGE = "If that email is registered, a reset link is on its way.";

/**
 * "Forgot password" — issue a reset link. Always returns the same success
 * message so a caller can't probe which emails have accounts. When email isn't
 * actually delivered (Resend not configured, or a sandbox recipient), the link
 * is logged server-side so it can still be handed over — never returned to the
 * client.
 */
export async function requestPasswordReset(
  input: RequestResetInput,
): Promise<ActionResult> {
  const parsed = requestResetSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true, name: true },
    });
    if (user?.email) {
      const { url } = await createPasswordResetToken(user.id);
      const res = await sendEmail({
        to: user.email,
        subject: "Reset your Intern Portal password",
        react: PasswordResetEmail({ name: user.name, url }),
      });
      if (!res.sent) console.info(`[password-reset] link for ${user.email}: ${url}`);
    }
  } catch (e) {
    // Never surface internal failures here — that too would leak signal.
    console.error("requestPasswordReset failed (non-fatal):", e);
  }

  return ok(undefined, RESET_REQUEST_MESSAGE);
}

/**
 * Set a new password from a reset link. The token is verified, single-use, and
 * time-boxed server-side; the new password is hashed before it ever touches the
 * database. Used both for "forgot password" and for admin-created interns
 * setting their very first password.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const result = await redeemPasswordResetToken(parsed.data.token, passwordHash);
    if (result === "invalid") {
      return fail("This link is invalid or has expired. Request a new one.");
    }
    if (result === "used") {
      return fail("This link has already been used. Request a new one.");
    }
    return ok(undefined, "Password updated — you can sign in now.");
  } catch (e) {
    console.error("resetPassword failed:", e);
    return fail("Something went wrong. Please try again.");
  }
}

/**
 * Student self-registration via a cohort invite link. Public (no session yet),
 * so it re-derives everything the client shouldn't be trusted with: the code is
 * re-validated to an *active* group here, the role is hard-coded `intern`, and
 * an already-registered email is refused (a shared code must never attach to an
 * existing account). On success the new intern is auto signed-in.
 */
export async function joinWithCode(input: JoinInput): Promise<ActionResult> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }

  const { code, name, password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  // The invite code is the gate. Only *active* cohorts are joinable — a turned-off
  // or archived group's code resolves to nothing.
  const group = await getGroupByJoinCode(code);
  if (!group) {
    return fail(
      "This invite link is invalid or has been turned off. Ask your admin for a new one.",
    );
  }

  // New accounts only. Attaching a shared code to an existing email would be an
  // account-takeover vector — existing users sign in with their own password.
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (existing) {
    return fail("That email already has an account — sign in instead.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email,
      name: name.trim(),
      role: "intern", // server-derived — never taken from the client
      passwordHash,
    });
    await db
      .insert(memberships)
      .values({ userId, groupId: group.id, roleInGroup: "intern" })
      .onConflictDoNothing();

    // Roster + admin counts should reflect the new intern immediately.
    revalidatePath(`/admin/groups/${group.id}`);
    revalidatePath("/admin/members");
    revalidatePath("/admin");
  } catch (e) {
    console.error("joinWithCode failed:", e);
    return fail("Something went wrong creating your account. Please try again.");
  }

  // Auto sign-in. Like signInWithPassword, success throws NEXT_REDIRECT (→ "/"),
  // which we re-throw so navigation happens; only an AuthError is surfaced.
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
    return ok();
  } catch (error) {
    if (error instanceof AuthError) {
      return fail("Account created — please sign in to continue.");
    }
    throw error; // NEXT_REDIRECT — let navigation happen
  }
}

/** Dev-only. Bound with a specific email from the login screen. */
export async function signInAsDevUser(email: string) {
  await signIn("dev", { email, redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
