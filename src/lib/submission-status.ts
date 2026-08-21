/**
 * Submission status presentation + the intern-side "what do I do about this?"
 * bucketing. Pure data — no `server-only`, so both client components (the
 * submission composer) and server components (dashboards, grading screen) share
 * one source of truth for labels and colors. The union mirrors the
 * `submission_status` pgEnum in the schema.
 */
export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "late"
  | "graded"
  | "returned";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const submissionStatusMeta: Record<
  SubmissionStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "outline" },
  submitted: { label: "Submitted", variant: "secondary" },
  late: { label: "Submitted late", variant: "destructive" },
  graded: { label: "Graded", variant: "default" },
  returned: { label: "Returned for revision", variant: "outline" },
};

/** Which bucket an assignment falls into for a given intern, from their submission. */
export type InternActionState =
  | "not_started" // no submission row yet
  | "in_progress" // a draft with content, not yet submitted
  | "returned" // sent back by the mentor — needs revision
  | "awaiting" // submitted (or late) — waiting on grading
  | "graded"; // done

/** True for the buckets that need the intern to *do* something. */
export function needsAction(state: InternActionState): boolean {
  return (
    state === "not_started" || state === "in_progress" || state === "returned"
  );
}

export function internActionState(
  status: SubmissionStatus | null | undefined,
): InternActionState {
  switch (status) {
    case "draft":
      return "in_progress";
    case "returned":
      return "returned";
    case "submitted":
    case "late":
      return "awaiting";
    case "graded":
      return "graded";
    default:
      return "not_started";
  }
}
