import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { env } from "@/lib/env";

const APP = env.APP_URL.replace(/\/$/, "");

/** Lifetime of a self-service "forgot password" link. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Longer window for admin-issued "set your first password" links. */
export const ONBOARD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * We persist only a SHA-256 hash of the token — the raw value lives solely in
 * the emailed/handed-over link, so a database leak can't be replayed. The hash
 * is deterministic, which is what lets us look a token up by its hash.
 */
export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a single-use reset token for a user and return the raw token plus the
 * full URL to hand over (emailed, or copied by an admin). Any earlier unused
 * tokens for the same user are burned, so only the newest link works.
 */
export async function createPasswordResetToken(
  userId: string,
  ttlMs: number = RESET_TOKEN_TTL_MS,
): Promise<{ token: string; url: string; expiresAt: Date }> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  const token = randomBytes(32).toString("hex"); // 256-bit, URL-safe
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(passwordResetTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashResetToken(token),
    expiresAt,
  });
  return { token, url: `${APP}/reset-password?token=${token}`, expiresAt };
}

/**
 * Redeem a raw token: confirm it's real, unused and unexpired, then set the
 * user's password hash and burn the token. Claiming the token is a conditional
 * UPDATE, so two concurrent redemptions of the same link can't both win.
 */
export async function redeemPasswordResetToken(
  rawToken: string,
  passwordHash: string,
): Promise<"ok" | "invalid" | "used"> {
  const now = new Date();
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, hashResetToken(rawToken)),
      gt(passwordResetTokens.expiresAt, now),
    ),
  });
  if (!row) return "invalid";
  if (row.usedAt) return "used";

  const [claimed] = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
    .returning({ userId: passwordResetTokens.userId });
  if (!claimed) return "used"; // lost the race to a concurrent redemption

  await db.update(users).set({ passwordHash }).where(eq(users.id, claimed.userId));
  return "ok";
}

/** Cheap read used by the reset page to decide whether to render the form. */
export async function resetTokenStatus(
  rawToken: string,
): Promise<"valid" | "invalid" | "used"> {
  if (!rawToken) return "invalid";
  const row = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, hashResetToken(rawToken)),
    columns: { usedAt: true, expiresAt: true },
  });
  if (!row) return "invalid";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= Date.now()) return "invalid";
  return "valid";
}
