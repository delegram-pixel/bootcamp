CREATE TABLE "assessment_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"question_id" text NOT NULL,
	"option_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"intern_id" text NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"passed" boolean NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_option" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"label" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_question" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"prompt" text NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"pass_pct" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_note_id_unique" UNIQUE("note_id")
);
--> statement-breakpoint
ALTER TABLE "note" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill module order for notes that already exist: week ascending (nulls
-- last), then oldest first — the exact order the notes UI already displayed, so
-- nothing visibly reorders on deploy. Global notes (null group_id) are numbered
-- among themselves, so every cohort's path still starts at position 1.
UPDATE "note" n SET "position" = s.rn
FROM (
	SELECT id,
	       ROW_NUMBER() OVER (
	         PARTITION BY COALESCE(group_id, '__global__')
	         ORDER BY week_number NULLS LAST, created_at ASC
	       ) AS rn
	FROM "note"
) s
WHERE n.id = s.id;--> statement-breakpoint
ALTER TABLE "assessment_answer" ADD CONSTRAINT "assessment_answer_attempt_id_assessment_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answer" ADD CONSTRAINT "assessment_answer_question_id_assessment_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_answer" ADD CONSTRAINT "assessment_answer_option_id_assessment_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."assessment_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempt" ADD CONSTRAINT "assessment_attempt_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempt" ADD CONSTRAINT "assessment_attempt_intern_id_user_id_fk" FOREIGN KEY ("intern_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_option" ADD CONSTRAINT "assessment_option_question_id_assessment_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_question" ADD CONSTRAINT "assessment_question_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON DELETE cascade ON UPDATE no action;