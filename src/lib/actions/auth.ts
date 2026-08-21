"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/actions/types";

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

/** Dev-only. Bound with a specific email from the login screen. */
export async function signInAsDevUser(email: string) {
  await signIn("dev", { email, redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
