/**
 * Drizzle schema — Intern Portal (v1)
 *
 * See PLAN.md §5 for field-level notes. Design seams worth remembering:
 *  - `submissionItems.kind` is what makes "all submission types" work — one table, one submit UI.
 *  - `memberships` is what makes "several groups at once" work.
 *  - `submissionItems.metaJson` on a github item stores { repo, prNumber, commitSha }
 *    — the seam for the future diff / auto-grade features.
 *
 * IDs are text UUIDs (crypto.randomUUID) so they line up with the Auth.js adapter tables.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

import type { BadgeKey } from "@/lib/scoring";

const uuid = () => text().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp("created_at", { mode: "date" }).notNull().defaultNow();

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum("user_role", ["admin", "intern"]);
export const groupStatus = pgEnum("group_status", ["active", "archived"]);
export const membershipRole = pgEnum("membership_role", ["mentor", "intern"]);
export const assignmentStatus = pgEnum("assignment_status", ["draft", "published"]);
export const attachmentKind = pgEnum("attachment_kind", ["file", "link"]);
export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "submitted",
  "late",
  "graded",
  "returned",
]);
export const submissionItemKind = pgEnum("submission_item_kind", [
  "file",
  "text",
  "link",
  "github",
]);

/* ------------------------------------------------------ Auth.js + users */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // Email+password auth: a bcrypt hash. Null for accounts an admin created that
  // haven't set a password yet — they set one via the reset / set-password email.
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("intern"),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/**
 * Password reset / set-password tokens. We store only a SHA-256 *hash* of the
 * token — the raw token lives solely in the emailed link, so a DB leak can't be
 * replayed. Single-use (`usedAt`) and time-boxed (`expiresAt`). Admin-created
 * interns set their first password through this same flow.
 */
export const passwordResetTokens = pgTable("password_reset_token", {
  id: uuid().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------- groups */

export const groups = pgTable("group", {
  id: uuid().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: groupStatus("status").notNull().default("active"),
  // Shareable cohort invite code. Null = no active invite link. Students who
  // open /join?code=… self-register straight into this group as interns.
  // Plaintext (the admin re-displays it to copy); rotate/disable to invalidate.
  joinCode: text("join_code").unique(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "membership",
  {
    id: uuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    roleInGroup: membershipRole("role_in_group").notNull().default("intern"),
    createdAt: createdAt(),
  },
  (t) => [unique("membership_user_group_uq").on(t.userId, t.groupId)],
);

/* -------------------------------------------------------- assignments */

export const assignments = pgTable("assignment", {
  id: uuid().primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  descriptionMd: text("description_md").notNull().default(""),
  dueAt: timestamp("due_at", { mode: "date" }),
  points: integer("points"),
  status: assignmentStatus("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { mode: "date" }),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const assignmentAttachments = pgTable("assignment_attachment", {
  id: uuid().primaryKey(),
  assignmentId: text("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  kind: attachmentKind("kind").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  fileKey: text("file_key"),
  mime: text("mime"),
  size: integer("size"),
  createdAt: createdAt(),
});

export const rubrics = pgTable("rubric", {
  id: uuid().primaryKey(),
  assignmentId: text("assignment_id")
    .notNull()
    .unique()
    .references(() => assignments.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const rubricCriteria = pgTable("rubric_criterion", {
  id: uuid().primaryKey(),
  rubricId: text("rubric_id")
    .notNull()
    .references(() => rubrics.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description"),
  maxPoints: integer("max_points").notNull(),
  order: integer("sort_order").notNull().default(0),
});

/* -------------------------------------------------------- submissions */

export const submissions = pgTable(
  "submission",
  {
    id: uuid().primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    internId: text("intern_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: submissionStatus("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { mode: "date" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique("submission_assignment_intern_uq").on(t.assignmentId, t.internId)],
);

export const submissionItems = pgTable("submission_item", {
  id: uuid().primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  kind: submissionItemKind("kind").notNull(),
  content: text("content"),
  url: text("url"),
  fileKey: text("file_key"),
  mime: text("mime"),
  size: integer("size"),
  metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------ grading */

export const grades = pgTable("grade", {
  id: uuid().primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .unique()
    .references(() => submissions.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  gradedById: text("graded_by_id")
    .notNull()
    .references(() => users.id),
  gradedAt: timestamp("graded_at", { mode: "date" }).notNull().defaultNow(),
});

export const criterionScores = pgTable(
  "criterion_score",
  {
    id: uuid().primaryKey(),
    gradeId: text("grade_id")
      .notNull()
      .references(() => grades.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id")
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    comment: text("comment"),
  },
  (t) => [unique("criterion_score_grade_criterion_uq").on(t.gradeId, t.criterionId)],
);

export const comments = pgTable("comment", {
  id: uuid().primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  bodyMd: text("body_md").notNull(),
  createdAt: createdAt(),
});

/* ---------------------------------------------------- notes & comms */

export const notes = pgTable("note", {
  id: uuid().primaryKey(),
  groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  week: text("week"),
  weekNumber: integer("week_number"),
  /**
   * Position within the cohort's module path — the gating order. A note pinned
   * to a group is a module in that cohort's path; ordering is `(position,
   * createdAt)` so gaps and ties are both harmless. Global notes (`groupId`
   * null) sit outside every path and are never gated.
   */
  position: integer("position").notNull().default(0),
  topic: text("topic"),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

/** Files/images/links attached to a note. Mirror of `assignmentAttachments`. */
export const noteAttachments = pgTable("note_attachment", {
  id: uuid().primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  kind: attachmentKind("kind").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  fileKey: text("file_key"),
  mime: text("mime"),
  size: integer("size"),
  createdAt: createdAt(),
});

/* -------------------------------------------------------- assessments */

/**
 * A note's end-of-module quiz. 1:1 with a cohort note via the unique `noteId`,
 * so "does this module gate?" is a plain existence check — a note with no
 * assessment row is ungated reading. Only cohort notes can carry one (a global
 * note has no path to gate), enforced in the actions, not here.
 *
 * `passPct` is the threshold the *best* attempt is measured against.
 */
export const assessments = pgTable("assessment", {
  id: uuid().primaryKey(),
  noteId: text("note_id")
    .notNull()
    .unique()
    .references(() => notes.id, { onDelete: "cascade" }),
  passPct: integer("pass_pct").notNull().default(70),
  createdAt: createdAt(),
});

export const assessmentQuestions = pgTable("assessment_question", {
  id: uuid().primaryKey(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  points: integer("points").notNull().default(1),
  order: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/**
 * One answer choice. `isCorrect` is the scoring truth — it never leaves the
 * server before an attempt is graded (the intern-facing loader strips it).
 */
export const assessmentOptions = pgTable("assessment_option", {
  id: uuid().primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => assessmentQuestions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  order: integer("sort_order").notNull().default(0),
});

/**
 * One sitting. Retakes are unlimited, so there is no unique key — "the score
 * that counts" is the max-scoring attempt, resolved in the query layer.
 *
 * `total` is snapshotted at submit time, so an admin editing question points
 * later can't retroactively change an old attempt's denominator.
 */
export const assessmentAttempts = pgTable("assessment_attempt", {
  id: uuid().primaryKey(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  internId: text("intern_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  passed: boolean("passed").notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date" }).notNull().defaultNow(),
  createdAt: createdAt(),
});

/** What the intern picked, so a graded attempt can be reviewed question by question. */
export const assessmentAnswers = pgTable("assessment_answer", {
  id: uuid().primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => assessmentQuestions.id, { onDelete: "cascade" }),
  /** Null when the question was left unanswered. */
  optionId: text("option_id").references(() => assessmentOptions.id, {
    onDelete: "cascade",
  }),
  createdAt: createdAt(),
});

export const announcements = pgTable("announcement", {
  id: uuid().primaryKey(),
  groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  bodyMd: text("body_md").notNull(),
  createdAt: createdAt(),
});

export type NotificationType =
  | "assignment_published"
  | "graded"
  | "returned"
  | "comment"
  | "announcement"
  | "due_soon"
  | "badge_earned"
  | "level_up"
  | "assessment_passed"
  | "module_unlocked";

export const notifications = pgTable("notification", {
  id: uuid().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<NotificationType>().notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  readAt: timestamp("read_at", { mode: "date" }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------- gamification */

/**
 * Badges an intern has been *awarded* — the single piece of scoring state we
 * persist; grade %, XP, level and the live badge set are all derived on the fly
 * in `lib/scoring.ts`. This table exists only as a notification ledger: earning
 * a badge is a pure function of graded work, so after each grade/submit we
 * recompute the earned set and insert whatever's new here. The unique
 * (user, badge) key makes that idempotent — a re-grade re-awards nothing and so
 * fires no duplicate notification. `badgeKey` is typed to the `scoring` registry
 * so an unknown key can't be stored.
 */
export const earnedBadges = pgTable(
  "earned_badge",
  {
    id: uuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key").$type<BadgeKey>().notNull(),
    earnedAt: timestamp("earned_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique("earned_badge_user_key_uq").on(t.userId, t.badgeKey)],
);

/* ---------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  submissions: many(submissions),
  assessmentAttempts: many(assessmentAttempts),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  memberships: many(memberships),
  assignments: many(assignments),
  notes: many(notes),
  announcements: many(announcements),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  group: one(groups, { fields: [memberships.groupId], references: [groups.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  group: one(groups, { fields: [assignments.groupId], references: [groups.id] }),
  createdBy: one(users, { fields: [assignments.createdById], references: [users.id] }),
  attachments: many(assignmentAttachments),
  rubric: one(rubrics),
  submissions: many(submissions),
}));

export const assignmentAttachmentsRelations = relations(
  assignmentAttachments,
  ({ one }) => ({
    assignment: one(assignments, {
      fields: [assignmentAttachments.assignmentId],
      references: [assignments.id],
    }),
  }),
);

export const rubricsRelations = relations(rubrics, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [rubrics.assignmentId],
    references: [assignments.id],
  }),
  criteria: many(rubricCriteria),
}));

export const rubricCriteriaRelations = relations(rubricCriteria, ({ one }) => ({
  rubric: one(rubrics, { fields: [rubricCriteria.rubricId], references: [rubrics.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  intern: one(users, { fields: [submissions.internId], references: [users.id] }),
  items: many(submissionItems),
  comments: many(comments),
  grade: one(grades),
}));

export const submissionItemsRelations = relations(submissionItems, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionItems.submissionId],
    references: [submissions.id],
  }),
}));

export const gradesRelations = relations(grades, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [grades.submissionId],
    references: [submissions.id],
  }),
  gradedBy: one(users, { fields: [grades.gradedById], references: [users.id] }),
  criterionScores: many(criterionScores),
}));

export const criterionScoresRelations = relations(criterionScores, ({ one }) => ({
  grade: one(grades, { fields: [criterionScores.gradeId], references: [grades.id] }),
  criterion: one(rubricCriteria, {
    fields: [criterionScores.criterionId],
    references: [rubricCriteria.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  submission: one(submissions, {
    fields: [comments.submissionId],
    references: [submissions.id],
  }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  group: one(groups, { fields: [notes.groupId], references: [groups.id] }),
  createdBy: one(users, { fields: [notes.createdById], references: [users.id] }),
  attachments: many(noteAttachments),
  assessment: one(assessments),
}));

export const noteAttachmentsRelations = relations(noteAttachments, ({ one }) => ({
  note: one(notes, { fields: [noteAttachments.noteId], references: [notes.id] }),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  note: one(notes, { fields: [assessments.noteId], references: [notes.id] }),
  questions: many(assessmentQuestions),
  attempts: many(assessmentAttempts),
}));

export const assessmentQuestionsRelations = relations(
  assessmentQuestions,
  ({ one, many }) => ({
    assessment: one(assessments, {
      fields: [assessmentQuestions.assessmentId],
      references: [assessments.id],
    }),
    options: many(assessmentOptions),
  }),
);

export const assessmentOptionsRelations = relations(assessmentOptions, ({ one }) => ({
  question: one(assessmentQuestions, {
    fields: [assessmentOptions.questionId],
    references: [assessmentQuestions.id],
  }),
}));

export const assessmentAttemptsRelations = relations(
  assessmentAttempts,
  ({ one, many }) => ({
    assessment: one(assessments, {
      fields: [assessmentAttempts.assessmentId],
      references: [assessments.id],
    }),
    intern: one(users, {
      fields: [assessmentAttempts.internId],
      references: [users.id],
    }),
    answers: many(assessmentAnswers),
  }),
);

export const assessmentAnswersRelations = relations(assessmentAnswers, ({ one }) => ({
  attempt: one(assessmentAttempts, {
    fields: [assessmentAnswers.attemptId],
    references: [assessmentAttempts.id],
  }),
  question: one(assessmentQuestions, {
    fields: [assessmentAnswers.questionId],
    references: [assessmentQuestions.id],
  }),
  option: one(assessmentOptions, {
    fields: [assessmentAnswers.optionId],
    references: [assessmentOptions.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  group: one(groups, { fields: [announcements.groupId], references: [groups.id] }),
  author: one(users, { fields: [announcements.authorId], references: [users.id] }),
}));

/* ------------------------------------------------------------- types */

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type AssignmentAttachment = typeof assignmentAttachments.$inferSelect;
export type Rubric = typeof rubrics.$inferSelect;
export type RubricCriterion = typeof rubricCriteria.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionItem = typeof submissionItems.$inferSelect;
export type Grade = typeof grades.$inferSelect;
export type CriterionScore = typeof criterionScores.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NoteAttachment = typeof noteAttachments.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type AssessmentOption = typeof assessmentOptions.$inferSelect;
export type AssessmentAttempt = typeof assessmentAttempts.$inferSelect;
export type AssessmentAnswer = typeof assessmentAnswers.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type EarnedBadge = typeof earnedBadges.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
