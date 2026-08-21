import "server-only";

import { z } from "zod";

import { getCurrentUser, authorize, ForbiddenError, type Action, type Resource } from "@/lib/authz";

/** Uniform result shape for Server Actions consumed by client forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Turn a ZodError into the flat fieldErrors shape our forms expect. */
export function zodFieldErrors(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Wraps a mutation body: resolves the current user, enforces `authorize()` for
 * the given (action, resource), validates input against a schema, and funnels
 * every failure into an `ActionResult` instead of throwing across the RSC
 * boundary. The authorization check is the server-side gate — never the client.
 */
export async function guardedAction<TSchema extends z.ZodType, TResult>(
  opts: {
    action: Action;
    resource: Resource;
    schema: TSchema;
    input: unknown;
  },
  run: (input: z.infer<TSchema>, userId: string) => Promise<ActionResult<TResult>>,
): Promise<ActionResult<TResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("You're not signed in.");

  try {
    await authorize(user, opts.action, opts.resource);
  } catch (e) {
    if (e instanceof ForbiddenError) return fail(e.message);
    throw e;
  }

  const parsed = opts.schema.safeParse(opts.input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }

  try {
    return await run(parsed.data, user.id);
  } catch (e) {
    console.error("Action failed:", e);
    return fail("Something went wrong. Please try again.");
  }
}
