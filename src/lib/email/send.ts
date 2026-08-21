import "server-only";

import type { ReactElement } from "react";
import { Resend } from "resend";

import { env, features } from "@/lib/env";

/**
 * Central email sender. Two hard rules:
 *  1. Gated by `features.email` — when Resend isn't configured we log and no-op,
 *     so the app runs identically with or without email wired up.
 *  2. Never throws. Email is a best-effort side-channel; a delivery failure must
 *     never roll back a grade, a comment, or an announcement. Callers get a
 *     `{ sent }` result they can ignore.
 */
let client: Resend | null = null;

function resend(): Resend | null {
  if (!features.email || !env.RESEND_API_KEY) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export type EmailMessage = {
  to: string;
  subject: string;
  react: ReactElement;
};

export async function sendEmail(
  msg: EmailMessage,
): Promise<{ sent: boolean; error?: string }> {
  const r = resend();
  if (!r) {
    console.info(`[email disabled] would send "${msg.subject}" → ${msg.to}`);
    return { sent: false };
  }
  try {
    const { error } = await r.emails.send({
      from: env.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      react: msg.react,
    });
    if (error) {
      // e.g. resend.dev sandbox rejects recipients other than the account owner.
      console.error(`[email] Resend rejected "${msg.subject}" → ${msg.to}:`, error);
      return { sent: false, error: error.message ?? String(error) };
    }
    return { sent: true };
  } catch (e) {
    console.error(`[email] send threw for "${msg.subject}" → ${msg.to}:`, e);
    return { sent: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}
