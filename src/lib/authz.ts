import "server-only";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { memberships } from "@/db/schema";
import { auth } from "@/lib/auth";

export type Role = "admin" | "intern";

export interface SessionUser {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/* ------------------------------------------------------------ session */

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

/** Redirects to /login when not signed in. Use in protected loaders/layouts. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects non-admins away from admin surfaces. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/* -------------------------------------------------------- membership */

export async function getMembership(userId: string, groupId: string) {
  return db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)),
  });
}

export async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
  return (await getMembership(userId, groupId)) !== undefined;
}

/* ----------------------------------------------------- authorization */

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type Action =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "submit"
  | "grade"
  | "manage";

export type Resource =
  | { kind: "admin" }
  | { kind: "group"; groupId?: string }
  | { kind: "assignment"; groupId: string; status: "draft" | "published" }
  | { kind: "note"; groupId: string | null }
  | { kind: "announcement"; groupId: string | null }
  | { kind: "submission"; internId: string; groupId: string }
  | { kind: "assessment"; groupId: string };

/**
 * The single source of truth for access decisions. Every loader and Server
 * Action funnels through `authorize()` (which throws) or `can()` (boolean).
 * Never trust the client — these run server-side only.
 *
 * v1 rules:
 *  - admin        → everything.
 *  - intern       → only groups they belong to; only *published* content;
 *                   only their own submissions; never manage/grade.
 */
export async function can(
  user: SessionUser,
  action: Action,
  resource: Resource,
): Promise<boolean> {
  if (user.role === "admin") return true;

  // Interns can never manage or grade, regardless of resource.
  if (action === "manage" || action === "grade") return false;

  switch (resource.kind) {
    case "admin":
      return false;

    case "group":
      // Interns may only *read* a group they belong to; never mutate.
      if (action !== "read" || !resource.groupId) return false;
      return isGroupMember(user.id, resource.groupId);

    case "assignment":
      // Read only, published only, and only within their groups.
      if (action !== "read" || resource.status !== "published") return false;
      return isGroupMember(user.id, resource.groupId);

    case "note":
    case "announcement":
      if (action !== "read") return false;
      // Global content (null group) is visible to everyone signed in.
      if (resource.groupId === null) return true;
      return isGroupMember(user.id, resource.groupId);

    case "submission":
      // Only the owning intern, and only within a group they belong to.
      if (!["read", "create", "update", "submit"].includes(action)) return false;
      if (resource.internId !== user.id) return false;
      return isGroupMember(user.id, resource.groupId);

    case "assessment":
      // Sitting a module's quiz — and seeing your own result. Interns never
      // author or delete one (that path is `manage` on `{kind:"admin"}`, and
      // `manage` is already refused for interns above).
      if (!["read", "create"].includes(action)) return false;
      return isGroupMember(user.id, resource.groupId);

    default:
      return false;
  }
}

/** Throwing variant. Use at the top of mutations and sensitive loaders. */
export async function authorize(
  user: SessionUser,
  action: Action,
  resource: Resource,
): Promise<void> {
  if (!(await can(user, action, resource))) {
    throw new ForbiddenError();
  }
}
