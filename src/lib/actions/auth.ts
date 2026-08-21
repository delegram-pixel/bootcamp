"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { users } from "@/db/schema";
import { signIn, signOut } from "@/lib/auth";
import {
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
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

/** Dev-only. Bound with a specific email from the login screen. */
export async function signInAsDevUser(email: string) {
  await signIn("dev", { email, redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
