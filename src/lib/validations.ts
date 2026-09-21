import { z } from "zod";

/* ----------------------------------------------------------------- groups */

export const groupCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type GroupCreateInput = z.infer<typeof groupCreateSchema>;

export const groupUpdateSchema = groupCreateSchema.extend({
  id: z.string().min(1),
  status: z.enum(["active", "archived"]),
});
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;

/* ------------------------------------------------------------- membership */

export const membershipRoleSchema = z.enum(["mentor", "intern"]);

/** Add already-registered users to a group (multi-select by id). */
export const addMembersSchema = z.object({
  groupId: z.string().min(1),
  userIds: z.array(z.string().min(1)).min(1, "Select at least one person"),
  roleInGroup: membershipRoleSchema.default("intern"),
});
export type AddMembersInput = z.infer<typeof addMembersSchema>;

/** Create an intern user (no group yet). */
export const inviteInternSchema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
});
export type InviteInternInput = z.infer<typeof inviteInternSchema>;

/* ------------------------------------------------------------ assignments */

/** One rubric row. `id` is present when editing an existing criterion. */
export const criterionSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Required").max(120),
  maxPoints: z.number("Enter a number").int().min(1, "Min 1").max(1000),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CriterionInput = z.infer<typeof criterionSchema>;

/**
 * Client-side assignment form. Kept to plain strings so nothing needs to cross
 * the Server Action boundary as a Date — the action schema below coerces.
 */
export const assignmentFormSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(160),
  descriptionMd: z.string().max(20000).optional().or(z.literal("")),
  dueAt: z.string(), // <input type="datetime-local"> value, or ""
  points: z.string(), // integer as text, or ""
  criteria: z.array(criterionSchema),
});
export type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;

/** Coerces the form's strings into typed values. Used by the create/update actions. */
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const dueAtField = z.preprocess((v) => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined → fails .date()
}, z.date().nullable());

const pointsField = z.preprocess(
  (v) => {
    const cleaned = emptyToNull(v);
    if (cleaned == null) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  },
  z.number().int().min(0).max(100000).nullable(),
);

const assignmentCore = {
  title: z.string().trim().min(2, "Title is too short").max(160),
  descriptionMd: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().max(20000),
  ),
  dueAt: dueAtField,
  points: pointsField,
  criteria: z.array(criterionSchema),
};

export const assignmentCreateSchema = z.object({
  groupId: z.string().min(1),
  ...assignmentCore,
});
/**
 * The wire shape the client sends (form strings + groupId). The schema above
 * coerces these into `assignmentCore`'s typed values during validation, so the
 * action body receives Dates/numbers while the client keeps sending strings.
 */
export type AssignmentCreateInput = { groupId: string } & AssignmentFormInput;

export const assignmentUpdateSchema = z.object({
  id: z.string().min(1),
  ...assignmentCore,
});
export type AssignmentUpdateInput = { id: string } & AssignmentFormInput;

/* ------------------------------------------------------- attachments */

/** A link attachment (always available — no upload provider needed). */
export const attachmentLinkSchema = z.object({
  assignmentId: z.string().min(1),
  label: z.string().trim().min(1, "Required").max(160),
  url: z.url("Enter a valid URL"),
});
export type AttachmentLinkInput = z.infer<typeof attachmentLinkSchema>;

/** A file attachment, recorded after UploadThing returns its url + key. */
export const attachmentFileSchema = z.object({
  assignmentId: z.string().min(1),
  label: z.string().trim().min(1).max(255),
  url: z.url(),
  fileKey: z.string().min(1),
  mime: z.string().max(255).optional(),
  size: z.number().int().nonnegative().optional(),
});
export type AttachmentFileInput = z.infer<typeof attachmentFileSchema>;

/* ------------------------------------------------------------ submissions */

/**
 * One submission holds a mix of items of different `kind`. Each kind has its own
 * add-schema (one input shape per tab in the composer). `assignmentId` scopes the
 * write; the owning submission is resolved server-side from (assignment, user).
 * Status is NEVER accepted from the client — the submit action derives it.
 */
export const submissionTextSchema = z.object({
  assignmentId: z.string().min(1),
  content: z.string().trim().min(1, "Write something").max(20000),
});
export type SubmissionTextInput = z.infer<typeof submissionTextSchema>;

export const submissionLinkSchema = z.object({
  assignmentId: z.string().min(1),
  url: z.url("Enter a valid URL"),
  label: z.string().trim().max(200).optional().or(z.literal("")),
});
export type SubmissionLinkInput = z.infer<typeof submissionLinkSchema>;

const isGithubUrl = (u: string) => {
  try {
    return /(^|\.)github\.com$/i.test(new URL(u).hostname);
  } catch {
    return false;
  }
};

export const submissionGithubSchema = z.object({
  assignmentId: z.string().min(1),
  url: z.url("Enter a valid URL").refine(isGithubUrl, "Enter a GitHub URL (github.com/…)"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type SubmissionGithubInput = z.infer<typeof submissionGithubSchema>;

/** Recorded after UploadThing returns a url + key (mirrors attachmentFileSchema). */
export const submissionFileSchema = z.object({
  assignmentId: z.string().min(1),
  url: z.url(),
  fileKey: z.string().min(1),
  name: z.string().trim().min(1).max(255),
  mime: z.string().max(255).optional(),
  size: z.number().int().nonnegative().optional(),
});
export type SubmissionFileInput = z.infer<typeof submissionFileSchema>;

/** Refers to an assignment's submission by the assignment (submit / withdraw). */
export const assignmentRefSchema = z.object({ assignmentId: z.string().min(1) });
export type AssignmentRefInput = z.infer<typeof assignmentRefSchema>;

export const removeSubmissionItemSchema = z.object({
  id: z.string().min(1),
  assignmentId: z.string().min(1),
});
export type RemoveSubmissionItemInput = z.infer<typeof removeSubmissionItemSchema>;

/* -------------------------------------------------------------- grading */

/** One rubric criterion's score, as sent by the grading form. */
export const criterionScoreInputSchema = z.object({
  criterionId: z.string().min(1),
  points: z.number().int().min(0),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CriterionScoreInput = z.infer<typeof criterionScoreInputSchema>;

/**
 * Grade payload. When the assignment has a rubric, `criteria` scores every
 * criterion and the total is DERIVED server-side (`overallScore` is ignored);
 * with no rubric, `overallScore` is required and `criteria` is empty. The action
 * re-checks each criterion against its `maxPoints` — the client is never trusted
 * for the score. `feedback`, if present, is posted to the comment thread.
 */
export const gradeSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  overallScore: z.number().int().min(0).optional(),
  criteria: z.array(criterionScoreInputSchema),
  feedback: z.string().trim().max(5000).optional().or(z.literal("")),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

/** Refers to a submission directly (grade / return / comment). */
export const submissionRefSchema = z.object({ submissionId: z.string().min(1) });
export type SubmissionRefInput = z.infer<typeof submissionRefSchema>;

/** A message on a submission's thread — posted by the mentor or the owning intern. */
export const commentCreateSchema = z.object({
  submissionId: z.string().min(1),
  bodyMd: z.string().trim().min(1, "Write a comment").max(5000),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

/* ------------------------------------------------------------------ notes */

export const noteFormSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(160),
  // Optional: a note can be just a title + attachments (e.g. a single PDF), so an
  // empty body is allowed. The column is NOT NULL, so the action stores "".
  bodyMd: z.string().trim().max(20000),
  groupId: z.string(), // "" = all groups (global), else a group id
  // A week number (1–99) typed as a string in the form; the action stores it as
  // an integer for ordering. "" / undefined means "no week" (the General group).
  weekNumber: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]?$/, "Use a week number, e.g. 2")
    .optional()
    .or(z.literal("")),
  // Order within the cohort's module path — the gating order. A string in the
  // form; the action stores an integer. Blank means "append": on create the note
  // lands at the end of its cohort's path, on edit it keeps its current spot.
  position: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{0,3}$/, "Use a whole number, e.g. 3")
    .optional()
    .or(z.literal("")),
  topic: z.string().trim().max(80).optional().or(z.literal("")),
});
export type NoteFormInput = z.infer<typeof noteFormSchema>;

export const noteCreateSchema = noteFormSchema;
export const noteUpdateSchema = noteFormSchema.extend({ id: z.string().min(1) });
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;

/* -------------------------------------------------------- note attachments */

/** A link resource on a note (always available — no upload provider needed). */
export const noteAttachmentLinkSchema = z.object({
  noteId: z.string().min(1),
  label: z.string().trim().min(1, "Required").max(160),
  url: z.url("Enter a valid URL"),
});
export type NoteAttachmentLinkInput = z.infer<typeof noteAttachmentLinkSchema>;

/** A file/image resource, recorded after UploadThing returns its url + key. */
export const noteAttachmentFileSchema = z.object({
  noteId: z.string().min(1),
  label: z.string().trim().min(1).max(255),
  url: z.url(),
  fileKey: z.string().min(1),
  mime: z.string().max(255).optional(),
  size: z.number().int().nonnegative().optional(),
});
export type NoteAttachmentFileInput = z.infer<typeof noteAttachmentFileSchema>;

export const removeNoteAttachmentSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
});
export type RemoveNoteAttachmentInput = z.infer<typeof removeNoteAttachmentSchema>;

/* --------------------------------------------------------- assessments */

/**
 * Quiz authoring. Every field is a string because it arrives from a form input;
 * the actions convert to integers. Deliberately no `.default()` and no
 * `z.coerce`, so `z.infer === z.input` and the client forms can validate against
 * these same schemas — the convention established by the grading schemas.
 */

/** Pass mark for a module's quiz: 1–100, as a whole-number percentage. */
export const assessmentUpsertSchema = z.object({
  noteId: z.string().min(1),
  passPct: z
    .string()
    .trim()
    .regex(/^([1-9][0-9]?|100)$/, "Use a percentage from 1 to 100"),
});
export type AssessmentUpsertInput = z.infer<typeof assessmentUpsertSchema>;

export const assessmentQuestionAddSchema = z.object({
  assessmentId: z.string().min(1),
  prompt: z.string().trim().min(3, "Write the question").max(500),
  points: z
    .string()
    .trim()
    .regex(/^([1-9][0-9]?)$/, "Points must be 1–99"),
});
export type AssessmentQuestionAddInput = z.infer<
  typeof assessmentQuestionAddSchema
>;

/** Editing an existing question — same fields, addressed by its own id. */
export const assessmentQuestionUpdateSchema = assessmentQuestionAddSchema
  .omit({ assessmentId: true })
  .extend({ id: z.string().min(1) });
export type AssessmentQuestionUpdateInput = z.infer<
  typeof assessmentQuestionUpdateSchema
>;

export const assessmentOptionAddSchema = z.object({
  questionId: z.string().min(1),
  label: z.string().trim().min(1, "Required").max(300),
  isCorrect: z.boolean(),
});
export type AssessmentOptionAddInput = z.infer<typeof assessmentOptionAddSchema>;

export const assessmentOptionUpdateSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Required").max(300),
});
export type AssessmentOptionUpdateInput = z.infer<
  typeof assessmentOptionUpdateSchema
>;

/**
 * Mark which option is the right answer. Carries the question too, so the write
 * can clear every other option on that question in the same transaction — one
 * correct answer per question is what makes the radio UI and the scoring agree.
 */
export const assessmentCorrectOptionSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});
export type AssessmentCorrectOptionInput = z.infer<
  typeof assessmentCorrectOptionSchema
>;

export const removeAssessmentSchema = z.object({ noteId: z.string().min(1) });
export type RemoveAssessmentInput = z.infer<typeof removeAssessmentSchema>;

export const removeAssessmentQuestionSchema = z.object({
  id: z.string().min(1),
  assessmentId: z.string().min(1),
});
export type RemoveAssessmentQuestionInput = z.infer<
  typeof removeAssessmentQuestionSchema
>;

export const removeAssessmentOptionSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
});
export type RemoveAssessmentOptionInput = z.infer<
  typeof removeAssessmentOptionSchema
>;

/**
 * Sitting a quiz. The client sends only *which option it picked per question* —
 * never a score. The action re-reads the answer key and derives the score
 * server-side, so a tampered payload can change what is submitted but not what
 * it is worth.
 */
export const attemptAnswerSchema = z.object({
  questionId: z.string().min(1),
  /** null = deliberately left blank; it scores zero and is recorded as such. */
  optionId: z.string().min(1).nullable(),
});
export type AttemptAnswerInput = z.infer<typeof attemptAnswerSchema>;

export const submitAttemptSchema = z.object({
  assessmentId: z.string().min(1),
  answers: z.array(attemptAnswerSchema).max(200),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

/* ---------------------------------------------------------- announcements */

export const announcementCreateSchema = z.object({
  groupId: z.string(), // "" = all groups (global), else a group id
  bodyMd: z.string().trim().min(1, "Write an announcement").max(5000),
});
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

/* ------------------------------------------------------------------ auth */

/** Email + password sign-in. */
export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** "Forgot password" — request a reset link by email. */
export const requestResetSchema = z.object({
  email: z.email("Enter a valid email"),
});
export type RequestResetInput = z.infer<typeof requestResetSchema>;

/**
 * Set a new password from a reset link. `token` is the raw token carried in the
 * emailed URL; the action hashes it to find the stored `passwordResetTokens`
 * row. Used both for "forgot password" and for admin-created interns setting
 * their very first password.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, "At least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Student self-registration via a cohort's shared invite link. `code` is the
 * join code carried in the /join URL — the action re-checks it server-side and
 * hard-codes the `intern` role (never trusts the client for it). Same
 * confirm-password refine as `resetPasswordSchema`.
 */
export const joinSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().trim().min(1, "Enter your name").max(120),
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type JoinInput = z.infer<typeof joinSchema>;
